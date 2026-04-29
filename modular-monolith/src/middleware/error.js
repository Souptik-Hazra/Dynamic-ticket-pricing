import mongoose from 'mongoose';
import config from '../shared/config/index.js';
import { logError, logSecurity } from '../shared/utils/logger.js';
import { AppError } from '../shared/utils/errors.js';

const MONGO_DUPLICATE_KEY = 11000;

/**
 * Global Error Handler
 * 
 * Standard Synchronous Express 4 Error Handler.
 * Initiates persistent logging in the background.
 */
export const errorHandler = (err, req, res, _next) => {
  const traceId = req.headers['x-trace-id'] || `trace-${Date.now()}`;

  const sendError = (status, code, message, extra = {}) => {
    return res.status(status).json({
      error: { code, message, traceId, ...extra }
    });
  };

  // 1. Handle Custom AppErrors
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logError('Server', `AppError: ${err.message}`, err, { traceId, path: req.path }).catch(() => null);
    }
    return sendError(err.status, err.code, err.message, err.extra);
  }

  // 2. Log the error persistently (Fire and Forget with safety)
  if (err.status >= 500 || !err.status) {
      logError('Server', `Unhandled Exception: ${err.message}`, err, { traceId, path: req.path })
        .catch((logErr) => logError('Server', 'Failed to persist error log', logErr, { traceId, path: req.path }));
  }

  // 2. Mongoose Cast Errors (Invalid IDs)
  if (err instanceof mongoose.Error.CastError) {
    return sendError(400, 'INVALID_PARAMETER', `Invalid value '${err.value}' for field '${err.path}'`);
  }

  // 3. Validation Errors
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return sendError(400, 'VALIDATION_FAILED', 'Input validation failed', { details });
  }

  // 4. Duplicate Keys
  if (err.code === MONGO_DUPLICATE_KEY) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(409, 'CONFLICT', `The provided ${field} is already in use.`);
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(401, 'INVALID_TOKEN', 'Session invalid. Please log in again.');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(401, 'TOKEN_EXPIRED', 'Session expired. Please refresh your token.');
  }

  // 6. Security & Rate Limits
  if (err.status === 429) {
      logSecurity('Sentinel', `Rate limit exceeded for IP ${req.ip}`, { path: req.path })
        .catch(() => null);
      return sendError(429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded. Please wait before retrying.');
  }

  // 7. Default Internal Server Error
  const status = err.status || 500;
  const message = (status === 500 && config.isProd) 
    ? 'An unexpected system error occurred' 
    : err.message;
  
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      traceId
    }
  });
};

export const notFound = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The requested path '${req.path}' was not found on this server.`
    }
  });
};
