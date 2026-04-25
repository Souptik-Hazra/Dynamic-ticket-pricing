import mongoose from 'mongoose';
import { persistLog, traceStorage } from '../shared/logger.js';

const MONGO_DUPLICATE_KEY = 11000;

export const errorHandler = (err, req, res, _next) => {
  const traceId = traceStorage.getStore()?.traceId || 'no-trace';

  const sendError = (status, code, message, extra = {}) => {
    return res.status(status).json({
      error: { code, message, traceId, ...extra }
    });
  };

  if (err instanceof mongoose.Error.CastError) {
    return sendError(400, 'INVALID_PARAMETER', `Invalid value '${err.value}' for field '${err.path}'`);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return sendError(400, 'VALIDATION_FAILED', 'Input validation failed', { details });
  }

  if (err.code === MONGO_DUPLICATE_KEY) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || '';
    return sendError(409, 'CONFLICT', `'${value}' is already registered for ${field}`);
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(401, 'INVALID_TOKEN', 'Invalid token. Please log in again.');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(401, 'TOKEN_EXPIRED', 'Session expired. Please log in again.');
  }

  if (err.type === 'entity.parse.failed') {
    return sendError(400, 'MALFORMED_JSON', 'Malformed JSON in request body');
  }

  if (err.status && err.status < 500) {
    return sendError(err.status, 'APP_ERROR', err.message);
  }

  console.error(`[${new Date().toISOString()}] Unhandled error [${traceId}]:`, err.message, '\n', err.stack);
  
  persistLog({
    service: req.moduleName || 'MonolithCore',
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

export const notFound = (req, res) => {
  res.status(404).json({ 
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      traceId: 'no-trace'
    }
  });
};
