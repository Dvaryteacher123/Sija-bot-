/**
 * =====================================================
 *  DVARY BOT - PAIR PAGE CLIENT SCRIPT
 *  Optional external script — pair.ejs also has inline JS
 *  This file provides reusable helpers for pairing pages.
 * =====================================================
 */

(function (global) {
  'use strict';

  // =====================================================
  //  CONFIG
  // =====================================================
  const DEFAULTS = {
    qrPollMs: 2500,
    statusPollMs: 3000,
    maxPolls: 40
  };

  // =====================================================
  //  HELPERS
  // =====================================================
  function $(id) {
    return document.getElementById(id);
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return res.json();
  }

  async function getJSON(url) {
    const res = await fetch(url);
    return res.json();
  }

  // =====================================================
  //  PAIR CLIENT
  // =====================================================
  function createClient(options = {}) {
    const opts = Object.assign({}, DEFAULTS, options);

    const state = {
      sessionId: null,
      mode: 'qr',
      pollTimer: null,
      pollCount: 0,
      onStatus: null,
      onQR: null,
      onCode: null,
      onError: null,
      onConnected: null
    };

    // ---------- SESSION ----------
    async function start(mode) {
      try {
        state.mode = mode || 'qr';
        const data = await postJSON('/pair/start', { method: state.mode });
        if (!data.success) throw new Error(data.message || 'Failed');
        state.sessionId = data.sessionId;
        return state.sessionId;
      } catch (err) {
        if (state.onError) state.onError(err);
        throw err;
      }
    }

    async function requestCode(phone) {
      if (!state.sessionId) throw new Error('No session started');
      const clean = String(phone || '').replace(/[^\d]/g, '');
      if (!clean || clean.length < 8) throw new Error('Invalid phone number');

      const data = await postJSON('/pair/code', {
        session: state.sessionId,
        phone: clean
      });
      if (!data.success) throw new Error(data.message || 'Failed');
      if (state.onCode) state.onCode(data.code);
      return data.code;
    }

    // ---------- POLLING ----------
    function startQRPolling() {
      stopPolling();
      state.pollCount = 0;

      state.pollTimer = setInterval(async () => {
        if (!state.sessionId) return;
        state.pollCount++;

        try {
          const qr = await getJSON(
            `/pair/qr?session=${encodeURIComponent(state.sessionId)}`
          );
          if (qr.success && qr.image && state.onQR) {
            state.onQR(qr.image, qr.qr);
          }

          const status = await getJSON(
            `/pair/status/${encodeURIComponent(state.sessionId)}`
          );
          if (status.success) {
            if (state.onStatus) state.onStatus(status.status);
            if (status.status === 'connected') {
              stopPolling();
              if (state.onConnected) state.onConnected(status);
            }
          }
        } catch (_) {}

        if (state.pollCount >= opts.maxPolls) stopPolling();
      }, opts.qrPollMs);
    }

    function startStatusPolling() {
      stopPolling();
      state.pollCount = 0;

      state.pollTimer = setInterval(async () => {
        if (!state.sessionId) return;
        state.pollCount++;

        try {
          const status = await getJSON(
            `/pair/status/${encodeURIComponent(state.sessionId)}`
          );
          if (status.success) {
            if (state.onStatus) state.onStatus(status.status);
            if (status.status === 'connected') {
              stopPolling();
              if (state.onConnected) state.onConnected(status);
            }
          }
        } catch (_) {}

        if (state.pollCount >= opts.maxPolls) stopPolling();
      }, opts.statusPollMs);
    }

    function stopPolling() {
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
    }

    // ---------- CANCEL ----------
    async function cancel() {
      if (!state.sessionId) return;
      try {
        await postJSON('/pair/cancel', { session: state.sessionId });
      } catch (_) {}
      stopPolling();
      state.sessionId = null;
    }

    // ---------- EVENTS ----------
    function on(event, handler) {
      if (event === 'status') state.onStatus = handler;
      if (event === 'qr') state.onQR = handler;
      if (event === 'code') state.onCode = handler;
      if (event === 'error') state.onError = handler;
      if (event === 'connected') state.onConnected = handler;
      return api;
    }

    // ---------- PUBLIC API ----------
    const api = {
      start,
      requestCode,
      startQRPolling,
      startStatusPolling,
      stopPolling,
      cancel,
      on,
      get sessionId() {
        return state.sessionId;
      },
      get state() {
        return state;
      }
    };

    return api;
  }

  // =====================================================
  //  UTILITY: Copy to clipboard
  // =====================================================
  async function copyText(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    // fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }

  // =====================================================
  //  UTILITY: Toast
  // =====================================================
  function showToast(msg, type = 'ok', duration = 3200) {
    let el = document.getElementById('dvary-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dvary-toast';
      el.style.cssText = `
        position: fixed; bottom: 30px; right: 30px;
        padding: 14px 22px; border-radius: 14px;
        background: rgba(20, 20, 40, 0.95);
        backdrop-filter: blur(18px);
        font-size: 0.9rem; font-weight: 600; color: #fff;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        opacity: 0; transform: translateY(20px);
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 9999; pointer-events: none;
        max-width: 380px;
        font-family: Inter, -apple-system, sans-serif;
      `;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.border = type === 'err'
      ? '1px solid rgba(239, 68, 68, 0.5)'
      : '1px solid rgba(34, 197, 94, 0.5)';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';

    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
    }, duration);
  }

  // =====================================================
  //  EXPORT
  // =====================================================
  global.DvaryPair = {
    createClient,
    copyText,
    showToast,
    postJSON,
    getJSON
  };
})(window);
