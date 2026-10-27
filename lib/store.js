// JSON-file store. Small enough that the whole site config lives in memory and
// is flushed atomically; stats writes are debounced so a burst of clicks does
// not hammer the disk.

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defaultData } from './defaults.js';
import { hashPassword, randomToken } from './auth.js';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'site.json');
    this.uploads = path.join(dir, 'uploads');
    this.data = null;
    this.flushTimer = null;
    this.writing = Promise.resolve();
  }

  async init({ initialPassword }) {
    await mkdir(this.uploads, { recursive: true });
    let raw = null;
    try {
      raw = await readFile(this.file, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    if (raw) {
      this.data = JSON.parse(raw);
    } else {
      this.data = defaultData();
      this.data.auth = {
        passwordHash: hashPassword(initialPassword),
        sessionSecret: randomToken(32),
        isDefaultPassword: true,
      };
      await this.flush();
    }

    // Backfill anything a hand-edited or older file may be missing.
    const base = defaultData();
    this.data.site = { ...base.site, ...this.data.site };
    this.data.theme = { ...base.theme, ...this.data.theme };
    this.data.header = { ...base.header, ...this.data.header };
    this.data.sections ||= [];
    this.data.stats ||= { views: 0, clicks: {}, daily: {} };
    this.data.stats.clicks ||= {};
    this.data.stats.daily ||= {};
    this.data.auth ||= { passwordHash: hashPassword(initialPassword), sessionSecret: randomToken(32), isDefaultPassword: true };
    this.data.auth.sessionSecret ||= randomToken(32);
    return this.data;
  }

  /** Everything except credentials — what the admin UI and renderer see. */
  publicData() {
    const { auth, ...rest } = this.data;
    return rest;
  }

  /** Replace the editable content. Credentials and stats are never client-supplied.
   *  Config objects are merged so a partial payload cannot wipe settings it omits;
   *  `sections` is the one list the client owns outright. */
  async replaceContent(next) {
    const { auth, stats, site, theme, header, ...rest } = next || {};
    this.data = {
      ...this.data,
      ...rest,
      site: { ...this.data.site, ...site },
      theme: { ...this.data.theme, ...theme },
      header: { ...this.data.header, ...header },
      version: 1,
    };
    await this.flush();
    return this.publicData();
  }

  async setPassword(password) {
    this.data.auth.passwordHash = hashPassword(password);
    this.data.auth.isDefaultPassword = false;
    await this.flush();
  }

  /** Invalidate every existing admin cookie. */
  async rotateSessionSecret() {
    this.data.auth.sessionSecret = randomToken(32);
    await this.flush();
  }

  today() {
    return new Date().toISOString().slice(0, 10);
  }

  recordView() {
    const s = this.data.stats;
    s.views = (s.views || 0) + 1;
    const day = (s.daily[this.today()] ||= { views: 0, clicks: 0 });
    day.views++;
    this.scheduleFlush();
  }

  recordClick(id) {
    if (!id || typeof id !== 'string' || id.length > 64) return;
    const s = this.data.stats;
    s.clicks[id] = (s.clicks[id] || 0) + 1;
    const day = (s.daily[this.today()] ||= { views: 0, clicks: 0 });
    day.clicks++;
    this.scheduleFlush();
  }

  async resetStats() {
    this.data.stats = { views: 0, clicks: {}, daily: {} };
    await this.flush();
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((err) => console.error('[store] flush failed:', err.message));
    }, 3000);
    this.flushTimer.unref?.();
  }

  /** Serialised atomic write: temp file then rename. */
  flush() {
    this.writing = this.writing.then(async () => {
      // Keep only the last 180 days of per-day counters.
      const daily = this.data.stats?.daily;
      if (daily) {
        const keys = Object.keys(daily).sort();
        for (const k of keys.slice(0, Math.max(0, keys.length - 180))) delete daily[k];
      }
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      await rename(tmp, this.file);
    }).catch((err) => {
      console.error('[store] write failed:', err.message);
    });
    return this.writing;
  }

  async close() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    await this.flush();
  }
}
