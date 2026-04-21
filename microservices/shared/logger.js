import { AsyncLocalStorage } from 'async_hooks';

/**
 * 📝 Expert Service Logger
 * Provides high-verbosity request/response logging and distributed tracing.
 */
export const traceStorage = new AsyncLocalStorage();

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'cvv', 'key', 'creditCard'];

const maskData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const masked = { ...data };
  Object.keys(masked).forEach(key => {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      masked[key] = '********';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskData(masked[key]);
    }
  });
  return masked;
};

export const requestLogger = (serviceName) => (req, res, next) => {
  const start = Date.now();
  const traceId = req.headers['x-request-id'] || `req-${Math.random().toString(36).substring(2, 9)}`;
  
  // Store traceId in AsyncLocalStorage so downstream interservice calls can find it
  traceStorage.run({ traceId }, () => {
    // 1. Log Incoming Request
    console.log(`[${serviceName}] 📥 [${traceId}] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`[${serviceName}] 📦 [${traceId}] Body:`, JSON.stringify(maskData(req.body)));
    }

    // 2. Wrap res.end to log outgoing response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      const color = res.statusCode >= 400 ? '❌' : '✅';
      console.log(`[${serviceName}] ${color} [${traceId}] ${res.statusCode} | ${duration}ms`);
      
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  });
};

export default requestLogger;
