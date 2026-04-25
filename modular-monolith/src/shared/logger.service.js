import SystemLog from './models/SystemLog.js';

/**
 * Logger Service
 * 
 * Centralized service for system observability and audit logging.
 * Replaces the need for modules to use HTTP POST routes for logging.
 */

export const logEvent = async (service, type, message, metadata = {}, severity = 'info') => {
  try {
    const log = await SystemLog.create({
      service,
      type,
      message,
      metadata,
      severity,
      timestamp: new Date()
    });
    return log;
  } catch (err) {
    // Fallback to console if DB write fails
    console.error(`[LoggerService] Failed to persist log: ${err.message}`);
    console.info(`[FallbackLog] ${service} | ${type} | ${message}`);
  }
};

export const logError = (service, message, error, metadata = {}) => {
  return logEvent(service, 'error', message, { 
    ...metadata, 
    errorMessage: error?.message, 
    stack: error?.stack 
  }, 'error');
};

export const logSecurity = (service, message, metadata = {}) => {
  return logEvent(service, 'security', message, metadata, 'warning');
};

export const logAudit = (service, userId, action, metadata = {}) => {
  return logEvent(service, 'audit', `${userId} performed ${action}`, {
    ...metadata,
    userId
  }, 'info');
};

export default { logEvent, logError, logSecurity, logAudit };
