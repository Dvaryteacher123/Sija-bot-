/**
 * =====================================================
 *  CONTROLLER: bot
 *  Handles bot session actions (start/stop/delete/restart)
 * =====================================================
 */

'use strict';

const config = require('../config/config');
const logger = require('../utils/logger');
const Session = require('../database/models/Session');
const User = require('../database/models/User');

// =====================================================
//  HELPER: resolve current user
// =====================================================
async function resolveUser(req) {
  if (req.session?.user?._id) {
    return await User.findById(req.session.user._id).lean();
  }
  let owner = null;
  try {
    owner = await User.findOne({ role: 'owner', isActive: true }).lean();
  } catch (_) {}
  return owner;
}

// =====================================================
//  LIST SESSIONS (JSON)
// =====================================================
async function listSessions(req, res) {
  try {
    const botManager = req.app.get('botManager');

    let docs = [];
    try {
      docs = await Session.listAllActive();
    } catch (_) {}

    return res.json({
      success: true,
      inMemory: botManager?.listSessions?.() ?? [],
      inDatabase: docs.map((d) => ({
        sessionId: d.sessionId,
        status: d.status,
        phoneNumber: d.phoneNumber,
        pushName: d.pushName,
        isActive: d.isActive,
        ownerTag: d.ownerTag,
        jid: d.jid,
        lastConnectedAt: d.lastConnectedAt,
        createdAt: d.createdAt
      }))
    });
  } catch (err) {
    logger.error(`[bot.controller.list] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  GET ONE
// =====================================================
async function getSession(req, res) {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    const doc = await Session.findBySessionId(sessionId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const botManager = req.app.get('botManager');
    const conn = botManager?.getSession?.(sessionId);

    return res.json({
      success: true,
      session: {
        sessionId: doc.sessionId,
        phoneNumber: doc.phoneNumber,
        pushName: doc.pushName,
        jid: doc.jid,
        lid: doc.lid,
        status: doc.status,
        isActive: doc.isActive,
        lastError: doc.lastError,
        lastConnectedAt: doc.lastConnectedAt,
        lastSeenAt: doc.lastSeenAt,
        messagesSent: doc.messagesSent,
        messagesReceived: doc.messagesReceived,
        commandsUsed: doc.commandsUsed,
        createdAt: doc.createdAt
      },
      live: {
        running: conn ? conn.isRunning?.() : false,
        status: conn?.getStatus?.() || 'not-running',
        uptime: conn?.getUptime?.() || 0
      }
    });
  } catch (err) {
    logger.error(`[bot.controller.get] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  START
// =====================================================
async function startSession(req, res) {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({ success: false, message: 'Bot manager not ready' });
    }

    await botManager.startSession(sessionId);
    return res.json({ success: true, message: 'Session starting' });
  } catch (err) {
    logger.error(`[bot.controller.start] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// =====================================================
//  STOP
// =====================================================
async function stopSession(req, res) {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    const logout = !!req.body?.logout;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({ success: false, message: 'Bot manager not ready' });
    }

    await botManager.stopSession(sessionId, { logout });
    return res.json({ success: true, message: 'Session stopped' });
  } catch (err) {
    logger.error(`[bot.controller.stop] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// =====================================================
//  RESTART
// =====================================================
async function restartSession(req, res) {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({ success: false, message: 'Bot manager not ready' });
    }

    await botManager.stopSession(sessionId, { logout: false });
    await new Promise((r) => setTimeout(r, 1500));
    await botManager.startSession(sessionId);

    return res.json({ success: true, message: 'Session restarting' });
  } catch (err) {
    logger.error(`[bot.controller.restart] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// =====================================================
//  DELETE
// =====================================================
async function deleteSession(req, res) {
  try {
    const sessionId = String(req.body?.sessionId || req.params.sessionId || '').trim();
    const logout = req.body?.logout !== false;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({ success: false, message: 'Bot manager not ready' });
    }

    await botManager.deleteSession(sessionId, { logout });
    return res.json({ success: true, message: 'Session deleted permanently' });
  } catch (err) {
    logger.error(`[bot.controller.delete] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// =====================================================
//  EXPORTS
// =====================================================
module.exports = {
  listSessions,
  getSession,
  startSession,
  stopSession,
  restartSession,
  deleteSession,
  resolveUser
};
