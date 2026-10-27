// Holds the site in memory and persists it through a storage driver.
// Content and stats are separate records so a burst of click counting can
// never overwrite an edit that was being saved at the same moment.

import { defaultData } from './defaults.js';
import { hashPassword, randomToken, deriveSecret } from './auth.js';

const emptyStats = () => ({ views: 0, clicks: {}, daily: {} });

export class Store {
  constructor(storage) {
    this.storage = storage;
    this.data = null;    // site / theme / header / sections
    this.stats = null;
    this.auth = null;
    this.flushTimer = null;
  }

  async init({ initialPassword } = {}) {
    await this.storage.init();

    const seed = defaultData();
    let stored = await this.storage.readJson('site');
    let fresh = false;
    if (!stored) {
      stored = seed;
      fresh = true;
    }

    // Older files kept stats and credentials inside the content record.
    const { auth: storedAuth, stats: inlineStats, ...content } = stored;
    this.data = {
      version: 1,
      site: { ...seed.site, ...content.site },
      theme: { ...seed.theme, ...content.theme },
      header: { ...seed.header, ...content.header },
      sections: Array.isArray(content.sections) ? content.sections : [],
    };
    this.stats = (await this.storage.readJson('stats')) || inlineStats || emptyStats();
    this.stats.clicks ||= {};
    this.stats.daily ||= {};

    this.auth = this.resolveAuth(storedAuth, initialPassword);
    if (fresh || inlineStats || storedAuth) await this.saveContent();
    return this.data;
  }

  /**
   * On a server with a disk the credentials live beside the content. On Vercel
   * the content record is a public blob, so they come from environment
   * variables instead and the admin cannot rewrite them.
   */
  resolveAuth(storedAuth, initialPassword) {
    const envPassword = process.env.ADMIN_PASSWORD;
    const envHash = process.env.ADMIN_PASSWORD_HASH;

    if (this.storage.kind !== 'file') {
      const password = envPassword || 'linkhub1234';
      return {
        passwordHash: envHash || hashPassword(password),
        // Derived, not random: every serverless instance must sign sessions
        // the same way, or a cold start would log the owner straight out.
        sessionSecret: process.env.SESSION_SECRET || deriveSecret(envHash || password),
        isDefaultPassword: !envPassword && !envHash,
        canChangePassword: false,
      };
    }

    const auth = storedAuth || {};
    return {
      passwordHash: auth.passwordHash || hashPassword(envPassword || initialPassword || 'linkhub1234'),
      sessionSecret: auth.sessionSecret || randomToken(32),
      isDefaultPassword: auth.passwordHash ? !!auth.isDefaultPassword : !envPassword,
      canChangePassword: true,
    };
  }

  /** The editable site: everything the admin and the renderer see. */
  publicData() {
    return this.data;
  }

  /** Credentials and stats are never client-supplied; config objects merge so a
   *  partial payload cannot wipe settings it leaves out. */
  async replaceContent(next) {
    const { auth, stats, site, theme, header, sections, ...rest } = next || {};
    this.data = {
      ...this.data,
      ...rest,
      site: { ...this.data.site, ...site },
      theme: { ...this.data.theme, ...theme },
      header: { ...this.data.header, ...header },
      sections: Array.isArray(sections) ? sections : this.data.sections,
      version: 1,
    };
    await this.saveContent();
    return this.data;
  }

  async setPassword(password) {
    if (!this.auth.canChangePassword) throw new Error('read-only-auth');
    this.auth.passwordHash = hashPassword(password);
    this.auth.isDefaultPassword = false;
    this.auth.sessionSecret = randomToken(32); // signs every existing cookie out
    await this.saveContent();
  }

  saveContent() {
    const record = { ...this.data };
    if (this.storage.kind === 'file') {
      record.auth = {
        passwordHash: this.auth.passwordHash,
        sessionSecret: this.auth.sessionSecret,
        isDefaultPassword: this.auth.isDefaultPassword,
      };
    }
    return this.storage.writeJson('site', record);
  }

  today() {
    return new Date().toISOString().slice(0, 10);
  }

  recordView() {
    this.stats.views = (this.stats.views || 0) + 1;
    (this.stats.daily[this.today()] ||= { views: 0, clicks: 0 }).views++;
    this.scheduleStatsFlush();
  }

  recordClick(id) {
    if (!id || typeof id !== 'string' || id.length > 64) return;
    this.stats.clicks[id] = (this.stats.clicks[id] || 0) + 1;
    (this.stats.daily[this.today()] ||= { views: 0, clicks: 0 }).clicks++;
    this.scheduleStatsFlush();
  }

  async resetStats() {
    this.stats = emptyStats();
    await this.storage.writeJson('stats', this.stats);
  }

  /** Counters are flushed on a timer; serverless keeps that window short. */
  scheduleStatsFlush(delay = this.storage.kind === 'file' ? 3000 : 400) {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushStats().catch((err) => console.error('[store] stats flush:', err.message));
    }, delay);
    this.flushTimer.unref?.();
  }

  async flushStats() {
    // Keep only the last 180 days of per-day counters.
    const daily = this.stats.daily;
    const keys = Object.keys(daily).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 180))) delete daily[k];
    await this.storage.writeJson('stats', this.stats);
  }

  async close() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    await this.flushStats().catch(() => {});
  }
}
