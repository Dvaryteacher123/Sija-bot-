/**
 * =====================================================
 *  ROUTES: pair
 *  Web-based WhatsApp pairing (multi-user)
 *  GET  /pair       -> pair page
 *  POST /pair/start -> create session + return sessionId
 *  GET  /pair/qr    -> get QR code (base64 image)
 *  POST /pair/code  -> request pairing code by phone
 *  GET  /pair/status/:sessionId -> session status
 * =====================================================
 */

'use strict';

const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

const config = require('../config/config');
const logger = require('../utils/logger');
const Session = require('../database/models/Session');
const User = require('../database/models/User');

const rateLimit = require('../middleware/rateLimit');

// =====================================================
//  GET /pair — page
// =====================================================
router.get('/', async (req, res) => {
  return res.render('pair', {
    title: `Pair - ${config.bot.name}`,
    sessionId: req.query.session || null
  });
});

// =====================================================
//  POST /pair/start — create new session
// =====================================================
router.post('/start', rateLimit.pair, async (req, res) => {
  try {
    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({
        success: false,
        message: 'Bot manager not ready. Try again in a moment.'
      });
    }

    // owner user: from session if logged in, else fallback to first owner
    let userId = req.session?.user?._id || null;
    let ownerTag = req.session?.user?.username || 'guest';

    if (!userId) {
      // Try find an owner user
      let owner = null;
      try {
        owner = await User.findOne({ role: 'owner', isActive: true });
      } catch (_) {}

      if (!owner) {
        // bootstrap a guest owner if none exists
        try {
          owner = await User.ensureOwner(
            process.env.OWNER_USERNAME || 'owner',
            process.env.OWNER_PASSWORD || 'owner12345'
          );
        } catch (_) {}
      }

      if (owner) {
        userId = owner._id;
        ownerTag = owner.username;
      }
    }

    if (!userId) {
      return res.status(500).json({
        success: false,
        message: 'No owner account found. Set OWNER_USERNAME & OWNER_PASSWORD in .env'
      });
    }

    const { sessionId } = await botManager.createSession({
      userId,
      ownerTag,
      method: 'qr'
    });

    return res.json({
      success: true,
      sessionId,
      message: 'Session created. Scan QR or request a pairing code.'
    });
  } catch (err) {
    logger.error(`[pair/start] ${err.message}`);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create session'
    });
  }
});

// =====================================================
//  GET /pair/qr?session=<id> — latest QR as data URL
// =====================================================
router.get('/qr', rateLimit.pair, async (req, res) => {
  try {
    const sessionId = String(req.query.session || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'session is required' });
    }

    const botManager = req.app.get('botManager');
    const conn = botManager?.getSession?.(sessionId);

    if (!conn) {
      return res.status(404).json({ success: false, message: 'Session not running' });
    }

    const qr = conn._lastQR || null;
    if (!qr) {
      return res.json({
        success: false,
        message: 'QR not ready yet. Please wait...',
        qr: null
      });
    }

    const dataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 8
    });

    return res.json({
      success: true,
      qr,
      image: dataUrl
    });
  } catch (err) {
    logger.error(`[pair/qr] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
//  POST /pair/code — request pairing code
//  body: { session, phone }
// =====================================================
router.post('/code', rateLimit.pair, async (req, res) => {
  try {
    const sessionId = String(req.body?.session || '').trim();
    const phone = String(req.body?.phone || '').replace(/[^\d]/g, '');

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'session is required' });
    }

    if (!phone || phone.length < 8 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Include country code.'
      });
    }

    const botManager = req.app.get('botManager');
    const conn = botManager?.getSession?.(sessionId);

    if (!conn) {
      return res.status(404).json({ success: false, message: 'Session not running' });
    }

    const sock = conn.getSocket?.();
    if (!sock) {
      return res.status(500).json({ success: false, message: 'Socket not ready' });
    }

    // already registered?
    if (sock.authState?.creds?.registered) {
      return res.status(400).json({
        success: false,
        message: 'Session is already linked to a number.'
      });
    }

    // request code
    let code;
    try {
      await new Promise((r) => setTimeout(r, 800));
      code = await sock.requestPairingCode(phone);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: `Failed to get pairing code: ${err.message}`
      });
    }

    if (!code) {
      return res.status(500).json({ success: false, message: 'No code returned' });
    }

    const pretty = String(code).match(/.{1,4}/g)?.join('-') || code;

    return res.json({
      success: true,
      code: pretty,
      raw: code,
      phone,
      message: 'Enter the code on your WhatsApp → Linked Devices.'
    });
  } catch (err) {
    logger.error(`[pair/code] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
//  GET /pair/status/:sessionId
// =====================================================
router.get('/status/:sessionId', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    const doc = await Session.findBySessionId(sessionId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const botManager = req.app.get('botManager');
    const conn = botManager?.getSession?.(sessionId);

    const live = conn?.getStatus ? conn.getStatus() : null;

    return res.json({
      success: true,
      sessionId,
      db: {
        status: doc.status,
        phoneNumber: doc.phoneNumber || '',
        pushName: doc.pushName || '',
        isActive: doc.isActive
      },
      live: live || doc.status
    });
  } catch (err) {
    logger.error(`[pair/status] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
