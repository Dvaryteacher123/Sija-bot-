/**
 * =====================================================
 *  ROUTES: bot
 *  Actions on bot sessions (start, stop, delete, restart)
 *  GET  /bot                    -> list sessions (JSON)
 *  POST /bot/start              -> start session by id
 *  POST /bot/stop               -> stop session by id
 *  POST /bot/delete             -> delete session by id
 *  POST /bot/restart            -> restart session
 *  GET  /bot/:sessionId         -> session details
 * =====================================================
 */

'use strict';

const express = require('express');
const router = express.Router();

const config = require('../config/config');
const logger = require('../utils/logger');
const Session = require('../database/models/Session');

const authMiddleware = require('../middleware/auth');

// =====================================================
//  LIST (JSON)
// =====================================================
router.get('/', async (req, res) => {
  try {
    const docs = await Session.listAllActive().catch(() => []);
    const botManager = req.app.get('botManager');
    const memList = botManager?.listSessions?.() ?? [];

    return res.json({
      success: true,
      inMemory: memList,
      inDatabase: docs.map((d) => ({
        sessionId: d.sessionId,
        status: d.status,
        phoneNumber: d.phoneNumber,
        pushName: d.pushName,
        isActive: d.isActive,
        ownerTag: d.ownerTag
      }))
    });
  } catch (err) {
    logger.error(`[bot/list] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
//  DETAILS
// =====================================================
router.get('/:sessionId', async (req, res) => {
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
    logger.error(`[bot/info] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
//  START
// =====================================================
router.post('/start', authMiddleware.optional, async (req, res) => {
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
    logger.error(`[bot/start] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// =====================================================
//  STOP
// =====================================================
router.post('/stop', authMiddleware.optional, async (req, res) => {
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
    logger.error(`[bot/stop] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// =====================================================
//  DELETE (SECURED)
// =====================================================
router.post('/delete', authMiddleware.optional, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    const logout = req.body?.logout !== false; // default true
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    // 1. Tafuta session kwenye database kwanza ili ujue mmiliki wake
    const sessionDoc = await Session.findBySessionId(sessionId);
    if (!sessionDoc) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // 2. Hakiki kama mtumiaji aliyelogin ndiye mmiliki halisi wa session hii
    const currentUserId = req.user?.id || req.user?._id || req.user?.phoneNumber;
    
    if (currentUserId && sessionDoc.userId && sessionDoc.userId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Hauruhusiwi kufuta au kusimamia session ya mtumiaji mwingine!' 
      });
    }

    const botManager = req.app.get('botManager');
    if (!botManager) {
      return res.status(500).json({ success: false, message: 'Bot manager not ready' });
    }

    await botManager.deleteSession(sessionId, { logout });
    return res.json({ success: true, message: 'Session deleted permanently' });
  } catch (err) {
    logger.error(`[bot/delete] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
});

// =====================================================
//  RESTART
// =====================================================
router.post('/restart', authMiddleware.optional, async (req, res) => {
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
    logger.error(`[bot/restart] ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;

