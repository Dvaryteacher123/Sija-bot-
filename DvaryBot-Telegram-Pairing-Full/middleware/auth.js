/**
 * =====================================================
 *  MIDDLEWARE: auth
 *  Session-based access guards
 *  - requireAuth   : user must be logged in
 *  - optional      : attach user if logged in, else continue
 *  - requireOwner  : user must be owner role
 *  - requireAdmin  : admin or owner
 * =====================================================
 */

'use strict';

const config = require('../config/config');
const logger = require('../utils/logger');
const User = require('../database/models/User');

// =====================================================
//  HELPERS
// =====================================================
function wantsJSON(req) {
  return (
    req.path.startsWith('/api') ||
    req.xhr ||
    (req.headers.accept || '').includes('application/json')
  );
}

function deny(req, res, status, message) {
  if (wantsJSON(req)) {
    return res.status(status).json({ success: false, message });
  }
  try {
    return res.status(status).render('error', {
      code: status,
      title: status === 401 ? 'Unauthorized' : 'Forbidden',
      message
    });
  } catch (_) {
    return res.status(status).type('text/plain').send(message);
  }
}

// =====================================================
//  OPTIONAL — attach user if logged in
// =====================================================
async function optional(req, res, next) {
  try {
    if (req.session?.user?._id) {
      // refresh from DB (in case role changed)
      const fresh = await User.findById(req.session.user._id)
        .select('-password')
        .lean();

      if (!fresh || !fresh.isActive) {
        req.session.user = null;
      } else {
        req.session.user = {
          _id: fresh._id,
          username: fresh.username,
          email: fresh.email,
          displayName: fresh.displayName,
          role: fresh.role,
          isActive: fresh.isActive
        };
      }
    }
    return next();
  } catch (err) {
    logger.warn(`[auth.optional] ${err.message}`);
    return next();
  }
}

// =====================================================
//  REQUIRED
// =====================================================
function requireAuth(req, res, next) {
  if (!req.session?.user?._id) {
    return deny(req, res, 401, 'Login required.');
  }
  return next();
}

// =====================================================
//  OWNER
// =====================================================
function requireOwner(req, res, next) {
  if (!req.session?.user?._id) {
    return deny(req, res, 401, 'Login required.');
  }
  if (req.session.user.role !== 'owner') {
    return deny(req, res, 403, 'Owner access only.');
  }
  return next();
}

// =====================================================
//  ADMIN / OWNER
// =====================================================
function requireAdmin(req, res, next) {
  if (!req.session?.user?._id) {
    return deny(req, res, 401, 'Login required.');
  }
  const r = req.session.user.role;
  if (r !== 'admin' && r !== 'owner') {
    return deny(req, res, 403, 'Admin access only.');
  }
  return next();
}

// =====================================================
//  LOGIN / LOGOUT HELPERS
// =====================================================
async function login(req, username, password) {
  const user = await User.findByLogin(username).select('+password');
  if (!user) return { ok: false, message: 'Invalid credentials' };
  if (!user.isActive) return { ok: false, message: 'Account disabled' };

  const valid = await user.comparePassword(password);
  if (!valid) return { ok: false, message: 'Invalid credentials' };

  req.session.user = {
    _id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive
  };

  try {
    await user.markLogin(req.ip);
  } catch (_) {}

  return { ok: true, user };
}

function logout(req) {
  return new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });
}

// =====================================================
//  EXPORTS
// =====================================================
module.exports = {
  optional,
  requireAuth,
  requireOwner,
  requireAdmin,
  login,
  logout
};
