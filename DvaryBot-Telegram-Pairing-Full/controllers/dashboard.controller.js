/**
 * =====================================================
 *  CONTROLLER: dashboard
 *  Aggregated data for web dashboard
 * =====================================================
 */

'use strict';

const os = require('os');

const config = require('../config/config');
const logger = require('../utils/logger');
const Session = require('../database/models/Session');
const User = require('../database/models/User');
const Setting = require('../database/models/Setting');
const Ban = require('../database/models/Ban');

// =====================================================
//  STATS
// =====================================================
async function getStats(req, res) {
  try {
    const botManager = req.app.get('botManager');

    const totalSessions = await Session.countDocuments({ isActive: true }).catch(() => 0);
    const connected = await Session.countDocuments({
      isActive: true,
      status: 'connected'
    }).catch(() => 0);
    const pairing = await Session.countDocuments({
      isActive: true,
      status: 'pairing'
    }).catch(() => 0);
    const disconnected = await Session.countDocuments({
      isActive: true,
      status: 'disconnected'
    }).catch(() => 0);

    const totalUsers = await User.countDocuments({ isActive: true }).catch(() => 0);
    const totalBans = await Ban.countDocuments({ isActive: true }).catch(() => 0);

    const memCount = botManager?.getSessionCount?.() ?? 0;

    return res.json({
      success: true,
      stats: {
        sessions: {
          total: totalSessions,
          connected,
          pairing,
          disconnected,
          inMemory: memCount
        },
        users: totalUsers,
        bans: totalBans,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus()?.length || 0,
          totalMem: os.totalmem(),
          freeMem: os.freemem(),
          loadavg: os.loadavg()
        }
      }
    });
  } catch (err) {
    logger.error(`[dashboard.stats] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  RECENT SESSIONS
// =====================================================
async function getRecentSessions(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const sessions = await Session.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        phoneNumber: s.phoneNumber,
        pushName: s.pushName,
        ownerTag: s.ownerTag,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt
      }))
    });
  } catch (err) {
    logger.error(`[dashboard.recent] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  ACTIVITY (recent commands used etc.)
// =====================================================
async function getActivity(req, res) {
  try {
    const sessions = await Session.find({ isActive: true })
      .sort({ lastSeenAt: -1 })
      .limit(15)
      .lean();

    const activity = sessions.map((s) => ({
      sessionId: s.sessionId,
      phone: s.phoneNumber,
      push: s.pushName,
      commands: s.commandsUsed || 0,
      sent: s.messagesSent || 0,
      received: s.messagesReceived || 0,
      lastSeen: s.lastSeenAt,
      status: s.status
    }));

    return res.json({ success: true, activity });
  } catch (err) {
    logger.error(`[dashboard.activity] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  GLOBAL SETTINGS
// =====================================================
async function getGlobalSettings(req, res) {
  try {
    const global = await Setting.getGlobal().catch(() => null);
    return res.json({
      success: true,
      settings: global || null
    });
  } catch (err) {
    logger.error(`[dashboard.settings] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  UPDATE GLOBAL SETTINGS
// =====================================================
async function updateGlobalSettings(req, res) {
  try {
    const patch = req.body || {};
    // Whitelist fields
    const allowed = [
      'prefix',
      'mode',
      'autoRead',
      'autoTyping',
      'autoRecording',
      'autoOnline',
      'autoRejectCall',
      'selfMode',
      'footer'
    ];

    const safe = {};
    for (const k of allowed) {
      if (k in patch) safe[k] = patch[k];
    }

    const doc = await Setting.updateSetting('global', safe);
    return res.json({ success: true, settings: doc });
  } catch (err) {
    logger.error(`[dashboard.updateSettings] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// =====================================================
//  EXPORTS
// =====================================================
module.exports = {
  getStats,
  getRecentSessions,
  getActivity,
  getGlobalSettings,
  updateGlobalSettings
};
