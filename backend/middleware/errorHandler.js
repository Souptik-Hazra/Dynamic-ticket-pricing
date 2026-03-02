/**
 * Centralized Error Handler Middleware
 * Handles all application errors with consistent response format
 */

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handling middleware
 * Must be added as the last middleware in the app
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const environment = process.env.NODE_ENV || 'development';

  // Log error details
  console.error(`\n❌ [${new Date().toISOString()}] Error (${statusCode}):`, {
    message,
    path: req.path,
    method: req.method,
    details: err.details,
    ...(environment === 'development' && { stack: err.stack })
  });

  // Prepare response
  const response = {
    success: false,
    error: message,
    statusCode
  };

  // Add details in development
  if (environment === 'development' && err.details) {
    response.details = err.details;
  }

  // Don't expose stack trace in production
  if (environment === 'production' && statusCode === 500) {
    response.error = 'An unexpected error occurred. Please try again later.';
  }

  res.status(statusCode).json(response);
};

/**
 * Async error wrapper for route handlers
 * Catches unhandled promise rejections
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  ApiError,
  errorHandler,
  asyncHandler
};
