import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';
import SystemLog from '../models/systemLog.model.js';

export const traceStorage = new AsyncLocalStorage();

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'cvv', 'key', 'creditCard'];

const maskData = (data) => {
  if (!data || typeof data !== 'object' || data instanceof Date) return data;

  const result = Array.isArray(data) ? [...data] : { ...data };
  for (const key in result) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      result[key] = '********';
    }
  }
  return result;
};

const safeStringify = (value) => {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatMessage = (level, service, message) => {
  const timestamp = new Date().toISOString();
  return `${timestamp} [${service}] [${level}] ${message}`;
};

const logToConsole = (level, service, message, metadata = {}) => {
  const formatted = formatMessage(level, service, message);
  const metaString = metadata && Object.keys(metadata).length
    ? ` | ${safeStringify(maskData(metadata))}`
    : '';

  if (level === 'ERROR') return console.error(formatted + metaString);
  if (level === 'WARN') return console.warn(formatted + metaString);
  if (level === 'DEBUG') return console.debug ? console.debug(formatted + metaString) : console.log(formatted + metaString);
  return console.log(formatted + metaString);
};

export const persistLog = async (logData) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await SystemLog.create(maskData(logData));
  } catch (err) {
    logToConsole('WARN', 'Logger', 'Database persistence failed', { message: err.message });
  }
};

export const logEvent = async (service, type, message, metadata = {}, severity = 'INFO') => {
  logToConsole(severity.toUpperCase(), service, message, metadata);
  return persistLog({
    service,
    level: severity.toUpperCase(),
    type,
    message,
    context: metadata,
    timestamp: new Date()
  });
};

export const logInfo = (service, message, metadata = {}) => logEvent(service, 'INFO', message, metadata, 'INFO');
export const logWarn = (service, message, metadata = {}) => logEvent(service, 'WARN', message, metadata, 'WARN');
export const logDebug = (service, message, metadata = {}) => logEvent(service, 'DEBUG', message, metadata, 'DEBUG');

export const logError = (service, message, error, metadata = {}) => {
  logToConsole('ERROR', service, message, { ...metadata, errorMessage: error?.message, stack: error?.stack });
  return persistLog({
    service,
    level: 'ERROR',
    type: 'ERROR',
    message,
    context: {
      ...metadata,
      errorMessage: error?.message,
      stack: error?.stack
    },
    timestamp: new Date()
  });
};

export const logSecurity = (service, message, metadata = {}) => {
  logToConsole('WARN', service, message, metadata);
  return logEvent(service, 'SECURITY', message, metadata, 'WARN');
};

export const logAudit = (service, userId, action, metadata = {}) => {
  const message = `${userId} performed ${action}`;
  logToConsole('INFO', service, message, metadata);
  return logEvent(service, 'AUDIT', message, { ...metadata, userId }, 'INFO');
};

export const requestLogger = (moduleName) => (req, res, next) => {
  const start = Date.now();
  const traceId = req.headers['x-request-id'] || `req-${Math.random().toString(36).substring(2, 9)}`;

  traceStorage.run({ traceId }, () => {
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const baseMeta = {
        traceId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        duration
      };
      const isHealthCheck = req.originalUrl.includes('/health');

      if (!isHealthCheck || statusCode >= 400) {
        if (statusCode >= 500) {
          logError(moduleName, `HTTP ${statusCode} ${req.method} ${req.originalUrl}`, null, baseMeta);
        } else if (statusCode >= 400) {
          logWarn(moduleName, `HTTP ${statusCode} ${req.method} ${req.originalUrl}`, baseMeta);
        } else {
          logInfo(moduleName, `${req.method} ${req.originalUrl}`, baseMeta);
        }
      } else {
        logDebug(moduleName, `${req.method} ${req.originalUrl}`, baseMeta);
      }

      if (statusCode >= 400 || duration > 2000) {
        persistLog({
          service: moduleName,
          level: statusCode >= 500 ? 'ERROR' : 'WARN',
          type: 'HTTP',
          message: `HTTP ${statusCode} on ${req.method} ${req.originalUrl}`,
          traceId,
          context: baseMeta,
          timestamp: new Date()
        });
      }
      return originalEnd.call(this, chunk, encoding);
    };
    next();
  });
};

export const createLogger = (service) => ({
  info: (message, metadata = {}) => logInfo(service, message, metadata),
  warn: (message, metadata = {}) => logWarn(service, message, metadata),
  debug: (message, metadata = {}) => logDebug(service, message, metadata),
  error: (message, error, metadata = {}) => logError(service, message, error, metadata),
  security: (message, metadata = {}) => logSecurity(service, message, metadata),
});

export default { requestLogger, logEvent, logError, logSecurity, logAudit, logInfo, logWarn, logDebug, createLogger };
