import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';
import SystemLog from '../models/systemLog.model.js';

export const traceStorage = new AsyncLocalStorage();

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'cvv', 'key', 'creditCard'];

const maskData = (data) => {
  if (!data || typeof data !== 'object' || data instanceof Date) return data;
  
  // Performance Fix: Avoid deep recursion on every log entry
  const result = Array.isArray(data) ? [...data] : { ...data };
  for (const key in result) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      result[key] = '********';
    }
  }
  return result;
};

export const persistLog = async (logData) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await SystemLog.create(maskData(logData));
  } catch (err) {
    console.warn('[Logger] Database persistence failed:', err.message);
  }
};

export const logEvent = async (service, type, message, metadata = {}, severity = 'INFO') => {
  return persistLog({
    service,
    level: severity.toUpperCase(),
    message,
    context: metadata,
    timestamp: new Date()
  });
};

export const logError = (service, message, error, metadata = {}) => {
  return logEvent(service, 'ERROR', message, { 
    ...metadata, 
    errorMessage: error?.message, 
    stack: error?.stack 
  }, 'ERROR');
};

export const logSecurity = (service, message, metadata = {}) => {
  return logEvent(service, 'SECURITY', message, metadata, 'WARN');
};

export const logAudit = (service, userId, action, metadata = {}) => {
  return logEvent(service, 'AUDIT', `${userId} performed ${action}`, {
    ...metadata,
    userId
  }, 'INFO');
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

export default { requestLogger, logEvent, logError, logSecurity, logAudit };
