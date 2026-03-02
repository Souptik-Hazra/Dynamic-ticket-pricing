/**
 * Retry utility for external service calls
 * Implements exponential backoff with jitter
 */

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  initialDelay: 100,     // ms
  maxDelay: 5000,        // ms
  backoffMultiplier: 2,
  jitter: true,
  retryOn: (error) => true  // Retry on all errors by default
};

/**
 * Execute a function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!config.retryOn(error)) {
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
      delay = Math.min(delay, config.maxDelay);
      
      // Add jitter to prevent thundering herd
      if (config.jitter) {
        delay = delay * (0.5 + Math.random());
      }
      
      console.log(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP request with retry logic
 * @param {Function} requestFn - Function that returns an axios request promise
 * @param {Object} options - Retry options
 */
async function fetchWithRetry(requestFn, options = {}) {
  const retryConfig = {
    maxRetries: options.maxRetries || 3,
    initialDelay: options.initialDelay || 200,
    // Only retry on network errors or 5xx responses
    retryOn: (error) => {
      if (!error.response) {
        // Network error
        return true;
      }
      const status = error.response.status;
      // Retry on server errors (5xx) but not client errors (4xx)
      return status >= 500 && status < 600;
    },
    ...options
  };
  
  return withRetry(requestFn, retryConfig);
}

/**
 * Execute ML API call with retry and fallback
 * @param {Function} mlRequestFn - Function that makes ML API request
 * @param {*} fallbackValue - Value to return if all retries fail
 * @param {Function} onFailure - Optional callback on failure (for notifications)
 */
async function callMLWithFallback(mlRequestFn, fallbackValue, onFailure = null) {
  try {
    return await fetchWithRetry(mlRequestFn, {
      maxRetries: 2,
      initialDelay: 100,
      maxDelay: 1000
    });
  } catch (error) {
    console.error('ML API call failed after retries:', error.message);
    
    // Call failure callback for admin notification
    if (onFailure) {
      try {
        await onFailure(error);
      } catch (notifyError) {
        console.error('Failed to send ML failure notification:', notifyError.message);
      }
    }
    
    return { fallback: true, value: fallbackValue };
  }
}

module.exports = {
  withRetry,
  fetchWithRetry,
  callMLWithFallback,
  sleep
};
