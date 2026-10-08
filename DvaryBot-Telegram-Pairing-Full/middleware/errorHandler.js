/**
 * =====================================================
 *  MIDDLEWARE: errorHandler
 *  Global error handler for Express
 * =====================================================
 */

'use strict';

const config = require('../config/config');
const logger = require('../utils/logger');

// =====================================================
//  MAIN HANDLER
// =====================================================
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log
  logger.error(`[HTTP ${status}] ${req.method} ${req.originalUrl} → ${message}`);
  if (status >= 500 && err.stack) {
    logger.error(err.stack);
  }

  // API / JSON path
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/pair/') ||
    req.path.startsWith('/bot/') ||
    req.path.startsWith('/sessions/') ||
    req.xhr ||
    (req.headers.accept || '').includes('application/json')
  ) {
    return res.status(status).json({
      success: false,
      status,
      message,
      path: req.originalUrl,
      ...(config.isDev && { stack: err.stack })
    });
  }

  // HTML page render
  try {
    return res.status(status).render('error', {
      code: status,
      title: status === 404 ? 'Not Found' : 'Error',
      message,
      ...(config.isDev && { stack: err.stack })
    });
  } catch (renderErr) {
    // last-resort
    return res.status(status).type('text/plain').send(
      `Error ${status}: ${message}`
    );
  }
}

// =====================================================
//  NOT FOUND
// =====================================================
function notFound(req, res, next) {
  const err = new Error(`Not Found: ${req.originalUrl}`);
  err.status = 404;
  return next(err);
}

// =====================================================
//  ASYNC WRAPPER
// =====================================================
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = errorHandler;
module.exports.notFound = notFound;
module.exports.asyncHandler = asyncHandler;
