/**
 * =====================================================
 *  DVARY BOT - FILE SESSION STORE
 *  Express-session store that keeps website login sessions
 *  in a local JSON file (replaces connect-mongo).
 * =====================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { DATA_DIR } = require('./fileStore');

const DIR = path.join(DATA_DIR, 'web-sessions');
const FILE = path.join(DIR, 'sessions.json');

class FileSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttlMs = Number(options.ttlMs) || 7 * 24 * 60 * 60 * 1000;
    this.sessions = {};
    this.timer = null;

    fs.mkdirSync(DIR, { recursive: true });

    try {
      if (fs.existsSync(FILE)) {
        this.sessions = JSON.parse(fs.readFileSync(FILE, 'utf8') || '{}') || {};
      }
    } catch (_) {
      this.sessions = {};
    }

    this._cleanup();

    const interval = setInterval(() => this._cleanup(), 60 * 60 * 1000);
    if (interval.unref) interval.unref();

    process.on('exit', () => this._flushSync());
  }

  _expiresAt(sess) {
    if (sess && sess.cookie && sess.cookie.expires) {
      const t = new Date(sess.cookie.expires).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return Date.now() + this.ttlMs;
  }

  _cleanup() {
    const now = Date.now();
    let changed = false;
    for (const sid of Object.keys(this.sessions)) {
      if (this.sessions[sid].expiresAt <= now) {
        delete this.sessions[sid];
        changed = true;
      }
    }
    if (changed) this._schedule();
  }

  _schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this._flushSync();
    }, 500);
    if (this.timer.unref) this.timer.unref();
  }

  _flushSync() {
    try {
      const tmp = `${FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.sessions));
      fs.renameSync(tmp, FILE);
    } catch (_) {}
  }

  get(sid, cb) {
    const entry = this.sessions[sid];
    if (!entry) return cb(null, null);
    if (entry.expiresAt <= Date.now()) {
      delete this.sessions[sid];
      this._schedule();
      return cb(null, null);
    }
    return cb(null, entry.data);
  }

  set(sid, sess, cb) {
    this.sessions[sid] = { data: sess, expiresAt: this._expiresAt(sess) };
    this._schedule();
    if (cb) cb(null);
  }

  touch(sid, sess, cb) {
    const entry = this.sessions[sid];
    if (entry) {
      entry.expiresAt = this._expiresAt(sess);
      this._schedule();
    }
    if (cb) cb(null);
  }

  destroy(sid, cb) {
    delete this.sessions[sid];
    this._schedule();
    if (cb) cb(null);
  }

  length(cb) {
    cb(null, Object.keys(this.sessions).length);
  }

  clear(cb) {
    this.sessions = {};
    this._schedule();
    if (cb) cb(null);
  }
}

module.exports = FileSessionStore;
