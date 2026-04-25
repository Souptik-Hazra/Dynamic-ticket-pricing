/**
 * 📝 JSend-Style API Response Utility (Platinum Version)
 * 
 * Standardizes all API outputs and error tracking across the monolith.
 */

export const success = (res, data = {}, message = 'Operation successful', statusCode = 200) => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data
  });
};

/**
 * Enhanced Error Response
 * @param {object} res - Express Response object
 * @param {string} message - Human readable error
 * @param {number} statusCode - HTTP status code
 * @param {string} errorSlug - Machine readable error code (e.g. ERR_INVALID_AUTH)
 * @param {object} details - Additional debug/validation info
 */
export const error = (res, message = 'An error occurred', statusCode = 500, errorSlug = 'ERR_INTERNAL_SERVER', details = null) => {
  const response = {
    status: 'error',
    code: errorSlug,
    message
  };
  
  if (details) response.details = details;

  // Add Retry-After hint for rate limiting or busy server
  if (statusCode === 429 || statusCode === 503) {
    res.setHeader('Retry-After', '30');
  }

  return res.status(statusCode).json(response);
};

export const fail = (res, data = {}, statusCode = 400) => {
  return res.status(statusCode).json({
    status: 'fail',
    data
  });
};

export default {
  success,
  error,
  fail
};
