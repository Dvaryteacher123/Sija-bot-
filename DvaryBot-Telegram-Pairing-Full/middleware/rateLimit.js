/**
 * =====================================================
 *  MIDDLEWARE: rateLimit
 *  Global, pair, and API rate limiters
 * =====================================================
 */

'use strict';

const rateLimitLib = require('express-rate-limit');
const config = require('../config/config');
const logger = require('../utils/logger');

const isDev = config.isDev;

// =====================================================
//  GLOBAL LIMITER
// =====================================================
const global = rateLimitLib({
  windowMs: config.rateLimit.windowMs,
  max: isDev ? 10000 : config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // never rate-limit static assets
    if (req.path.startsWith('/public')) return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn(`[RateLimit] Global limit hit: ${req.ip} ${req.originalUrl}`);
    if (
      req.path.startsWith('/api') ||
      req.xhr ||
      (req.headers.accept || '').includes('application/json')
    ) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.'
      });
    }
    return res.status(429).render('error', {
      code: 429,
      title: 'Too Many Requests',
      message: 'You are doing that too often. Please try again later.'
    });
  }
});

// =====================================================
//  PAIR LIMITER (strict — pairing is heavy)
// =====================================================
const pair = rateLimitLib({
  windowMs: config.rateLimit.windowMs,
  max: isDev ? 100 : config.rateLimit.pairMax, // e.g. 5 per 15min in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // key by IP (fallback to connection)
    return req.ip || req.connection?.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    logger.warn(`[RateLimit] Pair limit hit: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message:
        'Too many pairing attempts. Please wait before trying again.'
    });
  }
});

// =====================================================
//  API LIMITER
// =====================================================
const api = rateLimitLib({
  windowMs: 60 * 1000, // 1 min
  max: isDev ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`[RateLimit] API limit hit: ${req.ip} ${req.originalUrl}`);
    return res.status(429).json({
      success: false,
      message: 'API rate limit exceeded. Try again in a minute.'
    });
  }
});

// =====================================================
//  AUTH LIMITER (login attempts)
// =====================================================
const auth = rateLimitLib({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`[RateLimit] Auth limit hit: ${req.ip}`);
    return res.status(429).json({
      success: false,
      message: 'Too many attempts. Try again later.'
    });
  }
});

// =====================================================
//  EXPORTS
// =====================================================
module.exports = {
  global,
  pair,
  api,
  auth
};
