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
  // ── Mongoose CastError (e.g. invalid ObjectId in :id param) ───────────
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: `Invalid value '${err.value}' for field '${err.path}'`,
    });
  }

  // ── Mongoose ValidationError ──────────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details });
  }

  // ── MongoDB duplicate key (unique index) ──────────────────────────────
  if (err.code === MONGO_DUPLICATE_KEY) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || '';
    return res.status(409).json({ error: `'${value}' is already registered for ${field}` });
  }

  // ── JWT errors ────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  // ── Express/body-parser — malformed JSON ─────────────────────────────
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }

  // ── Custom application errors with explicit status ───────────────────
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  // ── Unknown / server error ────────────────────────────────────────────
  const traceId = traceStorage.getStore()?.traceId || 'unknown';
  
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

  res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
};

/**
 * 404 handler — mount before errorHandler after all routes:
 *   app.use(notFound)
 *   app.use(errorHandler)
 */
export const notFound = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
};
