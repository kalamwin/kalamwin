#!/usr/bin/env node
// LinkHub — a link-in-bio landing page with a built-in admin.
// Pure Node, no dependencies: `node server.js` and you are live.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { stat, writeFile, readdir, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import { Store } from './lib/store.js';
import { renderPage } from './lib/render.mjs';
import {
  COOKIE_NAME, createSession, parseCookies, sessionCookie, verifyPassword, verifySession,
} from './lib/auth.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SECURE_COOKIE = process.env.SECURE_COOKIE === '1' || process.env.NODE_ENV === 'production';
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024;
const MAX_BODY = 4 * 1024 * 1024;

const store = new Store(DATA_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};
const UPLOAD_EXT = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/avif': '.avif', 'image/svg+xml': '.svg',
};

/* ------------------------------------------------------------- utilities */

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  res.writeHead(status, {
    'Content-Length': payload.length,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

const json = (res, status, obj, headers) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', ...headers });

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid json'), { status: 400 });
  }
}

function isAuthed(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  return verifySession(token, store.data.auth.sessionSecret);
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  json(res, 401, { error: 'unauthorized' });
  return false;
}

async function serveFile(res, filePath, { cache = 'public, max-age=300' } = {}) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a URL path inside a directory, refusing anything that escapes it. */
function safeJoin(dir, urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const full = path.resolve(dir, rel);
  return full === dir || full.startsWith(dir + path.sep) ? full : null;
}

/* ------------------------------------------------------------ API routes */

async function handleApi(req, res, url) {
  const route = url.pathname;

  if (route === '/api/session' && req.method === 'GET') {
    return json(res, 200, {
      authed: isAuthed(req),
      isDefaultPassword: !!store.data.auth.isDefaultPassword,
    });
  }

  if (route === '/api/login' && req.method === 'POST') {
    const { password } = await readJson(req);
    if (!verifyPassword(password || '', store.data.auth.passwordHash)) {
      await new Promise((r) => setTimeout(r, 400)); // slow down guessing
      return json(res, 401, { error: 'รหัสผ่านไม่ถูกต้อง' });
    }
    const token = createSession(store.data.auth.sessionSecret);
    return json(res, 200, { ok: true, isDefaultPassword: !!store.data.auth.isDefaultPassword },
      { 'Set-Cookie': sessionCookie(token, { secure: SECURE_COOKIE }) });
  }

  if (route === '/api/logout' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', { secure: SECURE_COOKIE }) });
  }

  if (route === '/api/click' && req.method === 'POST') {
    const { id, view } = await readJson(req);
    if (view) store.recordView();
    if (id) store.recordClick(String(id));
    return json(res, 204, {});
  }

  // Everything below needs a session.
  if (route.startsWith('/api/')) {
    if (route === '/api/data' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      return json(res, 200, store.publicData());
    }

    if (route === '/api/data' && req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const body = await readJson(req);
      if (!body || typeof body !== 'object' || !Array.isArray(body.sections)) {
        return json(res, 400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
      }
      const saved = await store.replaceContent(body);
      return json(res, 200, { ok: true, data: saved });
    }

    if (route === '/api/password' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const { current, next } = await readJson(req);
      if (!verifyPassword(current || '', store.data.auth.passwordHash)) {
        return json(res, 401, { error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
      }
      if (!next || String(next).length < 8) {
        return json(res, 400, { error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร' });
      }
      await store.setPassword(String(next));
      await store.rotateSessionSecret();
      const token = createSession(store.data.auth.sessionSecret);
      return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, { secure: SECURE_COOKIE }) });
    }

    if (route === '/api/upload' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = UPLOAD_EXT[type];
      if (!ext) return json(res, 415, { error: 'รองรับเฉพาะไฟล์รูป JPG, PNG, WebP, GIF, AVIF, SVG' });
      let buf;
      try {
        buf = await readBody(req, MAX_UPLOAD);
      } catch (err) {
        if (err.status === 413) return json(res, 413, { error: `ไฟล์ใหญ่เกิน ${MAX_UPLOAD / 1024 / 1024} MB` });
        throw err;
      }
      if (!buf.length) return json(res, 400, { error: 'ไม่มีข้อมูลไฟล์' });
      const name = `${Date.now().toString(36)}-${randomBytes(5).toString('hex')}${ext}`;
      await writeFile(path.join(store.uploads, name), buf);
      return json(res, 200, { ok: true, url: `/u/${name}`, size: buf.length });
    }

    if (route === '/api/uploads' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const files = await readdir(store.uploads).catch(() => []);
      const list = [];
      for (const f of files) {
        if (f.startsWith('.')) continue;
        const info = await stat(path.join(store.uploads, f)).catch(() => null);
        if (info?.isFile()) list.push({ url: `/u/${f}`, size: info.size, mtime: info.mtimeMs });
      }
      list.sort((a, b) => b.mtime - a.mtime);
      return json(res, 200, { files: list });
    }

    if (route === '/api/uploads' && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return;
      const { url: target } = await readJson(req);
      const name = path.basename(String(target || ''));
      const full = safeJoin(store.uploads, name);
      if (!full) return json(res, 400, { error: 'ชื่อไฟล์ไม่ถูกต้อง' });
      await unlink(full).catch(() => {});
      return json(res, 200, { ok: true });
    }

    if (route === '/api/stats' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      return json(res, 200, store.data.stats);
    }

    if (route === '/api/stats' && req.method === 'DELETE') {
      if (!requireAuth(req, res)) return;
      await store.resetStats();
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'not found' });
  }
  return json(res, 404, { error: 'not found' });
}

/* --------------------------------------------------------------- routing */

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname.replace(/\/+$/, '') || '/';

  if (route.startsWith('/api/')) return handleApi(req, res, url);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': MIME['.txt'], Allow: 'GET, HEAD' });
  }

  if (route === '/healthz') return json(res, 200, { ok: true, uptime: process.uptime() });

  // The public landing page, server-rendered for SEO and link previews.
  if (route === '/') {
    const html = renderPage(store.publicData());
    return send(res, 200, html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
  }

  // Admin app.
  if (route === '/admin' || route.startsWith('/admin/')) {
    const sub = route.slice('/admin'.length);
    if (!sub || sub === '/') {
      return (await serveFile(res, path.join(PUBLIC_DIR, 'admin', 'index.html'), { cache: 'no-cache' }))
        || send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
    }
    const file = safeJoin(path.join(PUBLIC_DIR, 'admin'), sub);
    if (file && await serveFile(res, file, { cache: 'no-cache' })) return;
    return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
  }

  // Uploaded media.
  if (route.startsWith('/u/')) {
    const file = safeJoin(store.uploads, route.slice(3));
    if (file && await serveFile(res, file, { cache: 'public, max-age=31536000, immutable' })) return;
    return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
  }

  // The renderer itself, shared with the admin live preview.
  if (route === '/shared/render.mjs') {
    if (await serveFile(res, path.join(ROOT, 'lib', 'render.mjs'), { cache: 'no-cache' })) return;
  }

  // Static assets for the public page.
  const asset = safeJoin(PUBLIC_DIR, route);
  if (asset && await serveFile(res, asset)) return;

  return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
}

/* ----------------------------------------------------------------- boot */

const initialPassword = process.env.ADMIN_PASSWORD || 'linkhub1234';
await store.init({ initialPassword });

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[server]', err);
    if (!res.headersSent) json(res, status, { error: status >= 500 ? 'internal error' : err.message });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  LinkHub พร้อมใช้งานแล้ว`);
  console.log(`  หน้าบ้าน : http://localhost:${PORT}/`);
  console.log(`  หลังบ้าน : http://localhost:${PORT}/admin`);
  if (store.data.auth.isDefaultPassword) {
    console.log(`\n  รหัสผ่านเริ่มต้น : ${initialPassword}`);
    console.log(`  (เข้าหลังบ้านแล้วเปลี่ยนรหัสผ่านทันที หรือรันด้วย ADMIN_PASSWORD=... node server.js)`);
  }
  console.log('');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    server.close();
    await store.close();
    process.exit(0);
  });
}
