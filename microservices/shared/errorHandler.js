import mongoose from 'mongoose';
import { persistLog, traceStorage } from './logger.js';

// ── Mongoose error codes ───────────────────────────────────────────────────
const MONGO_DUPLICATE_KEY = 11000;

/**
 * Centralized Express error-handling middleware.
 * Mount LAST in every service: app.use(errorHandler)
 *
 * Handles:
 *  - Mongoose CastError        → 400 (invalid ObjectId / type)
 *  - Mongoose ValidationError  → 400 (schema validation failures)
 *  - MongoDB duplicate key     → 409 (unique index violation)
 *  - JWT errors                → 401
 *  - Express body-parser       → 400 (malformed JSON)
 *  - Custom { status, message} → forwarded as-is
 *  - Everything else           → 500
 */
export const errorHandler = (err, req, res, _next) => {
  const traceId = traceStorage.getStore()?.traceId || 'no-trace';

  // ── Helper: Standardized Error Envelope ────────────────────────────────
  const sendError = (status, code, message, extra = {}) => {
    return res.status(status).json({
      error: {
        code,
        message,
        traceId,
        ...extra
      }
    });
  };

  // ── Mongoose CastError ──────────────────────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    return sendError(400, 'INVALID_PARAMETER', `Invalid value '${err.value}' for field '${err.path}'`);
  }

  // ── Mongoose ValidationError ──────────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return sendError(400, 'VALIDATION_FAILED', 'Input validation failed', { details });
  }

  // ── MongoDB duplicate key (unique index) ──────────────────────────────
  if (err.code === MONGO_DUPLICATE_KEY) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || '';
    return sendError(409, 'CONFLICT', `'${value}' is already registered for ${field}`);
  }

  // ── JWT errors ────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return sendError(401, 'INVALID_TOKEN', 'Invalid token. Please log in again.');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(401, 'TOKEN_EXPIRED', 'Session expired. Please log in again.');
  }

  // ── Express/body-parser — malformed JSON ─────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return sendError(400, 'MALFORMED_JSON', 'Malformed JSON in request body');
  }

  // ── Custom application errors with explicit status ───────────────────
  if (err.status && err.status < 500) {
    return sendError(err.status, 'APP_ERROR', err.message);
  }

  // ── Unknown / server error ────────────────────────────────────────────
  
  console.error(`[${new Date().toISOString()}] Unhandled error [${traceId}]:`, err.message, '\n', err.stack);
  
  // Persist severe errors to DB
  persistLog({
    service: req.serviceName || 'UnknownService',
    level: 'CRITICAL',
    message: err.message,
    stack: err.stack,
    traceId,
    context: {
        method: req.method,
        url: req.originalUrl,
        statusCode: 500,
        ip: req.ip
    }
  });

  res.status(500).json({ 
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      traceId
    }
  });
};

/**
 * 404 handler — mount before errorHandler after all routes:
 *   app.use(notFound)
 *   app.use(errorHandler)
 */
export const notFound = (req, res) => {
  res.status(404).json({ 
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      traceId: 'no-trace'
    }
  });
};
