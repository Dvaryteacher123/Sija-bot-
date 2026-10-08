/**
 * =====================================================
 *  ROUTES: web
 *  Public pages: index, dashboard, status, commands,
 *  settings, sessions, error
 * =====================================================
 */

'use strict';

const express = require('express');
const router = express.Router();

const config = require('../config/config');
const Session = require('../database/models/Session');
const User = require('../database/models/User');
const Setting = require('../database/models/Setting');

// =====================================================
//  HOME / LANDING
// =====================================================
router.get('/', async (req, res) => {
  try {
    let stats = { sessions: 0, connected: 0, users: 0 };
    try {
      stats.sessions = await Session.countDocuments({ isActive: true });
      stats.connected = await Session.countDocuments({ isActive: true, status: 'connected' });
      stats.users = await User.countDocuments({ isActive: true });
    } catch (_) {}

    return res.render('index', {
      title: `${config.bot.name} - Home`,
      stats
    });
  } catch (err) {
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
});

// =====================================================
//  DASHBOARD
// =====================================================
router.get('/dashboard', async (req, res) => {
  try {
    const botManager = req.app.get('botManager');

    let dbSessions = [];
    try {
      dbSessions = await Session.listAllActive();
    } catch (_) {}

    const memCount = botManager?.getSessionCount?.() ?? 0;
    const connectedCount = dbSessions.filter((s) => s.status === 'connected').length;

    const stats = {
      totalSessions: dbSessions.length,
      inMemory: memCount,
      connected: connectedCount,
      pairing: dbSessions.filter((s) => s.status === 'pairing').length,
      disconnected: dbSessions.filter((s) => s.status === 'disconnected').length
    };

    return res.render('dashboard', {
      title: `Dashboard - ${config.bot.name}`,
      stats,
      sessions: dbSessions.slice(0, 20)
    });
  } catch (err) {
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
});

// =====================================================
//  STATUS
// =====================================================
router.get('/status', async (req, res) => {
  try {
    const botManager = req.app.get('botManager');

    const memSessions = botManager?.listSessions?.() ?? [];
    const dbSessions = await Session.listAllActive().catch(() => []);

    return res.render('status', {
      title: `Status - ${config.bot.name}`,
      memSessions,
      dbSessions,
      uptime: process.uptime(),
      mem: process.memoryUsage()
    });
  } catch (err) {
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
});

// =====================================================
//  SESSIONS
// =====================================================
router.get('/sessions', async (req, res) => {
  try {
    let sessions = [];
    try {
      sessions = await Session.listAllActive();
    } catch (_) {}

    return res.render('sessions', {
      title: `Sessions - ${config.bot.name}`,
      sessions
    });
  } catch (err) {
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
});

// =====================================================
//  COMMANDS
// =====================================================
router.get('/commands', async (req, res) => {
  try {
    const { listCommands, loadCommands } = require('../bot/handler');
    loadCommands();
    const commands = listCommands();

    // group by category
    const grouped = {};
    for (const c of commands) {
      const cat = c.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    }

    return res.render('commands', {
      title: `Commands - ${config.bot.name}`,
      commands,
      grouped,
      total: commands.length
    });
  } catch (err) {
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
});

// =====================================================
//  SETTINGS
// =====================================================
router.get('/settings', async (req, res) => {
  try {
    let global = null;
    try {
      global = await Setting.getGlobal();
    } catch (_) {}

    return res.render('settings', {
      title: `Settings - ${config.bot.name}`,
      global,
      config
    });
  } catch (err) {
    return res.status(500).render('error', {
      code: 500,
      title: 'Server Error',
      message: err.message
    });
  }
});

module.exports = router;
