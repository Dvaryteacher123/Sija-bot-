/**
 * =====================================================
 *  CONTROLLER: pair
 *  Handles web-based multi-user WhatsApp pairing:
 *  - creates new Session (unique sessionId)
 *  - requests pairing code
 *  - returns QR / status
 *
 *  All auth state is saved in local files (data/auth)
 *  via BotConnection (file-based auth)
 * =====================================================
 */

'use strict';

const QRCode = require('qrcode');

const config = require('../config/config');
const logger = require('../utils/logger');
const Session = require('../database/models/Session');
const User = require('../database/models/User');
const BotManager = require('../bot/manager');

// =====================================================
//  RESOLVE USER
// =====================================================
async function resolveUser(req) {
  if (req.session?.user?._id) {
    return await User.findById(req.session.user._id).lean();
  }
  let owner = null;
  try {
    owner = await User.findOne({ role: 'owner', isActive: true }).lean();
  } catch (_) {}

  if (!owner) {
    try {
      const created = await User.ensureOwner(
        process.env.OWNER_USERNAME || 'owner',
        process.env.OWNER_PASSWORD || 'owner12345'
      );
      if (created) owner = created.toObject ? created.toObject() : created;
    } catch (_) {}
  }
  return owner;
}

// =====================================================
//  RENDER PAGE
// =====================================================
async function renderPairPage(req, res) {
  try {
    const sessionId = String(req.query.session || '').trim() || null;
    return res.render('pair', {
      title: `Pair - ${config.bot.name}`,
      sessionId
    });
  } catch (err) {
    logger.error(`[pair.controller.render] ${err.message}`);
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
}

// =====================================================
//  START SESSION
// =====================================================
async function startSession(req, res) {
  try {
    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({
        success: false,
        message: 'Bot manager not ready'
      });
    }

    const user = await resolveUser(req);
    if (!user) {
      return res.status(500).json({
        success: false,
        message: 'No user account. Set OWNER_USERNAME / OWNER_PASSWORD in .env'
      });
    }

    const method = req.body?.method === 'pair' ? 'pair' : 'qr';
    const phoneNumber = String(req.body?.phone || '').replace(/[^\d]/g, '');

    // If pairing method, phone is required
    if (method === 'pair' && (!phoneNumber || phoneNumber.length < 8)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for pairing code method'
      });
    }

    const { sessionId } = await botManager.createSession({
      userId: user._id,
      ownerTag: user.username,
      phoneNumber,
      method
    });

    return res.json({
      success: true,
      sessionId,
      method,
      message: 'Session created. Awaiting QR / pairing code...'
    });
  } catch (err) {
    logger.error(`[pair.controller.start] ${err.message}`);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create session'
    });
  }
}

// =====================================================
//  GET QR (base64 image)
// =====================================================
async function getQR(req, res) {
  try {
    const sessionId = String(req.query.session || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'session is required' });
    }

    const botManager = req.app.get('botManager');
    const conn = botManager?.getSession?.(sessionId);

    if (!conn) {
      return res.status(404).json({
        success: false,
        message: 'Session not running'
      });
    }

    const qr = conn._lastQR || null;

    if (!qr) {
      return res.json({
        success: false,
        message: 'QR not ready yet. Wait a moment...',
        image: null
      });
    }

    const dataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return res.json({
      success: true,
      qr,
      image: dataUrl
    });
  } catch (err) {
    logger.error(`[pair.controller.qr] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  REQUEST PAIR CODE
// =====================================================
async function requestCode(req, res) {
  try {
    const sessionId = String(req.body?.session || '').trim();
    const phone = String(req.body?.phone || '').replace(/[^\d]/g, '');

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'session is required' });
    }

    if (!phone || phone.length < 8 || phone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number (include country code)'
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

    if (sock.authState?.creds?.registered) {
      return res.status(400).json({
        success: false,
        message: 'This session is already linked to a phone number'
      });
    }

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
      return res.status(500).json({
        success: false,
        message: 'No pairing code returned'
      });
    }

    const pretty = String(code).match(/.{1,4}/g)?.join('-') || code;

    return res.json({
      success: true,
      code: pretty,
      raw: code,
      phone,
      message: 'Enter this code in WhatsApp → Linked Devices'
    });
  } catch (err) {
    logger.error(`[pair.controller.code] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  STATUS
// =====================================================
async function getStatus(req, res) {
  try {
    const sessionId = String(req.params.sessionId || req.query.session || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const doc = await Session.findBySessionId(sessionId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const botManager = req.app.get('botManager');
    const conn = botManager?.getSession?.(sessionId);
    const live = conn?.getStatus?.() || doc.status;

    return res.json({
      success: true,
      sessionId,
      status: live,
      isActive: doc.isActive,
      phoneNumber: doc.phoneNumber,
      pushName: doc.pushName,
      jid: doc.jid,
      lid: doc.lid,
      lastConnectedAt: doc.lastConnectedAt,
      lastSeenAt: doc.lastSeenAt,
      connected: live === 'connected'
    });
  } catch (err) {
    logger.error(`[pair.controller.status] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  CANCEL / DELETE (during pairing)
// =====================================================
async function cancelSession(req, res) {
  try {
    const sessionId = String(req.body?.session || req.params.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({ success: false, message: 'Bot manager not ready' });
    }

    await botManager.deleteSession(sessionId, { logout: false });
    return res.json({ success: true, message: 'Session cancelled' });
  } catch (err) {
    logger.error(`[pair.controller.cancel] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  EXPORTS
// =====================================================
module.exports = {
  renderPairPage,
  startSession,
  getQR,
  requestCode,
  getStatus,
  cancelSession
};
