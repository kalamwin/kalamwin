// The whole request handler. server.js runs it behind a Node http server;
// api/index.js runs the same function as a Vercel Function.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import { Store } from './store.js';
import { createStorage } from './storage.js';
import { renderPage } from '../public/shared/render.mjs';
import {
  COOKIE_NAME, createSession, parseCookies, sessionCookie, verifyPassword, verifySession,
} from './auth.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const SECURE_COOKIE = process.env.SECURE_COOKIE === '1' || process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024;
const MAX_BODY = 4 * 1024 * 1024;

export const store = new Store(createStorage({
  dataDir: DATA_DIR,
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,
}));

let readyPromise = null;
/** Init runs once per process; every request waits on the same promise. */
export function ready() {
  readyPromise ||= store.init({ initialPassword: process.env.ADMIN_PASSWORD || 'linkhub1234' })
    .catch((err) => { readyPromise = null; throw err; });
  return readyPromise;
}

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
  // A Vercel Function may have parsed the body already.
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
    return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
  }
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

async function readJsonBody(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid json'), { status: 400 });
  }
}

function isAuthed(req) {
  return verifySession(parseCookies(req.headers.cookie)[COOKIE_NAME], store.auth.sessionSecret);
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
    const headers = {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    };
    if (info.size > 512 * 1024) {
      res.writeHead(200, headers);
      createReadStream(filePath).pipe(res);
    } else {
      send(res, 200, await readFile(filePath), headers);
    }
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

/** Minimal vCard 3.0 — enough for iOS and Android to file the contact. */
function buildVcard(section, name) {
  const escape = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escape(name)}`];
  const parts = String(name).trim().split(/\s+/);
  lines.push(`N:${escape(parts.slice(1).join(' '))};${escape(parts[0] || '')};;;`);
  if (section.org) lines.push(`ORG:${escape(section.org)}`);
  if (section.role) lines.push(`TITLE:${escape(section.role)}`);
  if (section.phone) lines.push(`TEL;TYPE=CELL:${escape(section.phone)}`);
  if (section.email) lines.push(`EMAIL;TYPE=INTERNET:${escape(section.email)}`);
  if (section.website) lines.push(`URL:${escape(section.website)}`);
  if (section.address) lines.push(`ADR;TYPE=WORK:;;${escape(section.address)};;;;`);
  if (section.note) lines.push(`NOTE:${escape(section.note)}`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------ API routes */

async function handleApi(req, res, url) {
  const route = url.pathname;

  if (route === '/api/session' && req.method === 'GET') {
    return json(res, 200, {
      authed: isAuthed(req),
      isDefaultPassword: !!store.auth.isDefaultPassword,
      canChangePassword: !!store.auth.canChangePassword,
      storage: store.storage.kind,
    });
  }

  if (route === '/api/login' && req.method === 'POST') {
    const { password } = await readJsonBody(req);
    if (!verifyPassword(password || '', store.auth.passwordHash)) {
      await new Promise((r) => setTimeout(r, 400)); // slow down guessing
      return json(res, 401, { error: 'รหัสผ่านไม่ถูกต้อง' });
    }
    const token = createSession(store.auth.sessionSecret);
    return json(res, 200, { ok: true, isDefaultPassword: !!store.auth.isDefaultPassword },
      { 'Set-Cookie': sessionCookie(token, { secure: SECURE_COOKIE }) });
  }

  if (route === '/api/logout' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', { secure: SECURE_COOKIE }) });
  }

  if (route === '/api/click' && req.method === 'POST') {
    const { id, view } = await readJsonBody(req);
    if (view) store.recordView();
    if (id) store.recordClick(String(id));
    // Serverless freezes the instance at response time, so flush before replying.
    if (store.storage.kind !== 'file') await store.flushStats().catch(() => {});
    return json(res, 204, {});
  }

  if (route === '/api/data' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, 200, store.publicData());
  }

  if (route === '/api/data' && req.method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object' || !Array.isArray(body.sections)) {
      return json(res, 400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
    }
    const saved = await store.replaceContent(body);
    return json(res, 200, { ok: true, data: saved });
  }

  if (route === '/api/password' && req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    if (!store.auth.canChangePassword) {
      return json(res, 409, {
        error: 'เว็บนี้รันบน Vercel — เปลี่ยนรหัสผ่านที่ Environment Variable ชื่อ ADMIN_PASSWORD แล้ว Redeploy',
      });
    }
    const { current, next } = await readJsonBody(req);
    if (!verifyPassword(current || '', store.auth.passwordHash)) {
      return json(res, 401, { error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }
    if (!next || String(next).length < 8) {
      return json(res, 400, { error: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร' });
    }
    await store.setPassword(String(next));
    const token = createSession(store.auth.sessionSecret);
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
    const saved = await store.storage.saveUpload(name, buf, type);
    return json(res, 200, { ok: true, url: saved.url, size: buf.length });
  }

  if (route === '/api/uploads' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, 200, { files: await store.storage.listUploads() });
  }

  if (route === '/api/uploads' && req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    const { url: target } = await readJsonBody(req);
    await store.storage.deleteUpload(target);
    return json(res, 200, { ok: true });
  }

  if (route === '/api/stats' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, 200, store.stats);
  }

  if (route === '/api/stats' && req.method === 'DELETE') {
    if (!requireAuth(req, res)) return;
    await store.resetStats();
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}

/* --------------------------------------------------------------- routing */

export async function handle(req, res) {
  await ready();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname.replace(/\/+$/, '') || '/';

  if (route.startsWith('/api/')) return handleApi(req, res, url);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': MIME['.txt'], Allow: 'GET, HEAD' });
  }

  if (route === '/healthz') {
    return json(res, 200, { ok: true, storage: store.storage.kind, uptime: process.uptime() });
  }

  // The public landing page, server-rendered for SEO and link previews.
  if (route === '/') {
    return send(res, 200, renderPage(store.publicData()), {
      'Content-Type': MIME['.html'],
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
  }

  // Downloadable contact card for a `contact` section.
  if (route.startsWith('/vcard/')) {
    const id = decodeURIComponent(route.slice('/vcard/'.length)).replace(/\.vcf$/i, '');
    const section = (store.data.sections || []).find((s) => s.id === id && s.type === 'contact');
    if (!section) return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
    const name = section.name || store.data.header?.title || 'contact';
    return send(res, 200, buildVcard(section, name), {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]+/g, '_') || 'contact'}.vcf"`,
      'Cache-Control': 'no-cache',
    });
  }

  // Admin app.
  if (route === '/admin' || route.startsWith('/admin/')) {
    const sub = route.slice('/admin'.length);
    const file = !sub || sub === '/'
      ? path.join(PUBLIC_DIR, 'admin', 'index.html')
      : safeJoin(path.join(PUBLIC_DIR, 'admin'), sub);
    if (file && await serveFile(res, file, { cache: 'no-cache' })) return;
    return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
  }

  // Uploaded media (only when this process owns the files).
  if (route.startsWith('/u/')) {
    if (store.storage.servesUploads) {
      const file = safeJoin(store.storage.uploadsDir, route.slice(3));
      if (file && await serveFile(res, file, { cache: 'public, max-age=31536000, immutable' })) return;
    }
    return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
  }

  // Static assets for the public page and the shared renderer.
  const asset = safeJoin(PUBLIC_DIR, route);
  if (asset && await serveFile(res, asset)) return;

  return send(res, 404, 'Not Found', { 'Content-Type': MIME['.txt'] });
}

/** One entry point that turns any thrown error into a response. */
export async function respond(req, res) {
  try {
    await handle(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[app]', err);
    if (!res.headersSent) json(res, status, { error: status >= 500 ? 'internal error' : err.message });
    else res.end();
  }
}
