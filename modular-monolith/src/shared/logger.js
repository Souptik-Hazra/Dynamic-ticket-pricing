import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';
import SystemLog from './models/SystemLog.js';

export const traceStorage = new AsyncLocalStorage();

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'cvv', 'key', 'creditCard'];

const maskData = (data, depth = 0) => {
  if (!data || typeof data !== 'object' || depth > 3) return data;
  const masked = Array.isArray(data) ? [...data] : { ...data };
  const keys = Object.keys(masked);
  if (keys.length > 100) return '[Object too large for safe masking]';
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f))) {
      masked[key] = '********';
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskData(masked[key], depth + 1);
    }
  }
  return masked;
};

export const persistLog = async (logData) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (logData.level === 'INFO') return;
    await SystemLog.create(maskData(logData));
  } catch (err) {
    console.warn('[Logger] Database persistence failed:', err.message);
  }
};

export const requestLogger = (moduleName) => (req, res, next) => {
  const start = Date.now();
  const traceId = req.headers['x-request-id'] || `req-${Math.random().toString(36).substring(2, 9)}`;
  
  traceStorage.run({ traceId }, () => {
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const color = statusCode >= 400 ? '❌' : '✅';
      
      const isHealthCheck = req.originalUrl.includes('/health');
      if (!isHealthCheck || statusCode >= 400) {
        console.log(`[${moduleName}] ${color} [${traceId}] ${req.method} ${req.originalUrl} | ${statusCode} | ${duration}ms`);
      }
      
      if (statusCode >= 400 || duration > 2000) {
        persistLog({
          service: moduleName,
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
