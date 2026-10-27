// Two places the site can live:
//   - FileStorage: a data/ folder on disk (running on your own machine or a VPS)
//   - BlobStorage: Vercel Blob (serverless, where the filesystem is read-only)
// The rest of the app only sees readJson / writeJson / upload helpers.

import { readFile, writeFile, rename, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

export function createStorage({ dataDir, blobToken }) {
  return blobToken ? new BlobStorage(blobToken) : new FileStorage(dataDir);
}

export class FileStorage {
  kind = 'file';
  /** Uploads are served by us, from disk. */
  servesUploads = true;

  constructor(dir) {
    this.dir = dir;
    this.uploadsDir = path.join(dir, 'uploads');
    this.writing = Promise.resolve();
  }

  async init() {
    await mkdir(this.uploadsDir, { recursive: true });
  }

  file(key) {
    return path.join(this.dir, `${key}.json`);
  }

  async readJson(key) {
    try {
      return JSON.parse(await readFile(this.file(key), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Serialised temp-file-then-rename, so a crash can never leave half a file. */
  writeJson(key, value) {
    this.writing = this.writing.then(async () => {
      const target = this.file(key);
      const tmp = `${target}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
      await rename(tmp, target);
    }).catch((err) => {
      console.error('[storage] write failed:', err.message);
    });
    return this.writing;
  }

  async saveUpload(name, buffer) {
    await writeFile(path.join(this.uploadsDir, name), buffer);
    return { url: `/u/${name}`, id: name };
  }

  async listUploads() {
    const names = await readdir(this.uploadsDir).catch(() => []);
    const out = [];
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const info = await stat(path.join(this.uploadsDir, name)).catch(() => null);
      if (info?.isFile()) out.push({ url: `/u/${name}`, id: name, size: info.size, mtime: info.mtimeMs });
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  }

  async deleteUpload(ref) {
    const name = path.basename(String(ref || ''));
    if (!name || name === '.' || name === '..') return;
    const full = path.resolve(this.uploadsDir, name);
    if (full !== this.uploadsDir && full.startsWith(this.uploadsDir + path.sep)) {
      await unlink(full).catch(() => {});
    }
  }
}

export class BlobStorage {
  kind = 'blob';
  /** Blob hands out its own public CDN URLs; nothing is served through us. */
  servesUploads = false;

  constructor(token, { ttl = 5000 } = {}) {
    this.token = token;
    this.ttl = ttl;
    this.cache = new Map();
    this.sdkPromise = null;
  }

  async init() {
    await this.sdk(); // fail fast if the package is missing
  }

  sdk() {
    this.sdkPromise ||= import('@vercel/blob');
    return this.sdkPromise;
  }

  key(name) {
    return `config/${name}.json`;
  }

  async readJson(name) {
    const pathname = this.key(name);
    const hit = this.cache.get(pathname);
    if (hit && Date.now() - hit.at < this.ttl) return hit.value;

    const { list } = await this.sdk();
    const { blobs } = await list({ prefix: pathname, limit: 10, token: this.token });
    const blob = blobs.find((b) => b.pathname === pathname);
    if (!blob) {
      this.cache.set(pathname, { value: null, at: Date.now() });
      return null;
    }
    // Blob URLs sit behind a CDN, so the upload time doubles as a cache buster:
    // without it a save could keep serving the previous version for a minute.
    const stamp = new Date(blob.uploadedAt).getTime();
    const res = await fetch(`${blob.url}?v=${stamp}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`blob read failed (${res.status})`);
    const value = await res.json();
    this.cache.set(pathname, { value, at: Date.now() });
    return value;
  }

  async writeJson(name, value) {
    const pathname = this.key(name);
    const { put } = await this.sdk();
    await put(pathname, JSON.stringify(value, null, 2), {
      access: 'public',
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      token: this.token,
    });
    this.cache.set(pathname, { value, at: Date.now() });
  }

  async saveUpload(name, buffer, contentType) {
    const { put } = await this.sdk();
    const blob = await put(`uploads/${name}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
      token: this.token,
    });
    return { url: blob.url, id: blob.url };
  }

  async listUploads() {
    const { list } = await this.sdk();
    const { blobs } = await list({ prefix: 'uploads/', limit: 500, token: this.token });
    return blobs
      .map((b) => ({ url: b.url, id: b.url, size: b.size, mtime: new Date(b.uploadedAt).getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
  }

  async deleteUpload(ref) {
    const url = String(ref || '');
    if (!/^https?:\/\//.test(url)) return;
    const { del } = await this.sdk();
    await del(url, { token: this.token });
  }
}
