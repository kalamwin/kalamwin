// Password hashing (scrypt) and stateless signed session cookies.

import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
export const COOKIE_NAME = 'lh_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

/** A stable secret derived from the password, for places that cannot store one. */
export function deriveSecret(input) {
  return createHmac('sha256', 'linkhub/session/v1').update(String(input)).digest('base64url');
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltB64, keyB64] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(keyB64, 'base64url');
    const actual = scryptSync(String(password), salt, expected.length, SCRYPT);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(secret) {
  const payload = `${Date.now() + SESSION_TTL_MS}.${randomToken(12)}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(payload, secret);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = Number(payload.split('.')[0]);
  return Number.isFinite(exp) && exp > Date.now();
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(value, { secure, maxAge = SESSION_TTL_MS / 1000 } = {}) {
  const bits = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${value ? maxAge : 0}`,
  ];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}
