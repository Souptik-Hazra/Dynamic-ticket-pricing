import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';
import SystemLog from './models/SystemLog.js';

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

/**
 * Persistence helper — writes to DB asynchronously.
 */
export const persistLog = async (logData) => {
  try {
    // 🛡️ Safety: Skip persistence if DB is not connected yet
    if (mongoose.connection.readyState !== 1) return;

    // Only persist errors or critical warnings to avoid DB bloat
    if (logData.level === 'INFO') return;
    
    await SystemLog.create(logData);
  } catch (err) {
    // Fail silently in DB persistence to avoid crashing the business flow
    console.warn('[Logger] Database persistence failed:', err.message);
  }
};

export const requestLogger = (serviceName) => (req, res, next) => {
  const start = Date.now();
  const traceId = req.headers['x-request-id'] || `req-${Math.random().toString(36).substring(2, 9)}`;
  
  // Store traceId in AsyncLocalStorage so downstream interservice calls can find it
  traceStorage.run({ traceId }, () => {
    // 1. Log Incoming Request
    console.log(`[${serviceName}] 📥 [${traceId}] ${req.method} ${req.originalUrl}`);
    
    // 2. Wrap res.end to log outgoing response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const color = statusCode >= 400 ? '❌' : '✅';
      
      console.log(`[${serviceName}] ${color} [${traceId}] ${statusCode} | ${duration}ms`);
      
      // Auto-persist errors or slow requests
      if (statusCode >= 400 || duration > 2000) {
        persistLog({
          service: serviceName,
          level: statusCode >= 500 ? 'ERROR' : 'WARN',
          message: `HTTP ${statusCode} on ${req.method} ${req.originalUrl}`,
          traceId,
          context: {
            method: req.method,
            url: req.originalUrl,
            statusCode,
            ip: req.ip
          }
        });
      }
      
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  });
};

export default requestLogger;
