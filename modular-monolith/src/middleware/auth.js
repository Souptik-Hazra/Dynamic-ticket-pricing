import jwt from 'jsonwebtoken';
import config from '../shared/config/index.js';
import { logSecurity, logWarn, logError } from '../shared/utils/logger.js';
import { ROLES } from '../shared/constants/roles.js';
import { ROLE_PERMISSIONS } from '../shared/constants/permissions.js';

/**
 * Auth Middleware
 * 
 * Verifies JWT and attaches user to request.
 * Hardened with async error handling and persistent logging.
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = authHeader.split(' ')[1];
    const secret = config.jwt.secret;

    // Diamond Step: Check Blacklist
    const { isTokenBlacklisted } = await import('../shared/utils/cache.js');
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Session revoked. Please log in again.' });
    }
    
    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    // Diamond Step: Adaptive Security Friction (Phase 8)
    if (decoded.botScore > 5) {
      const delay = Math.min(5000, (decoded.botScore - 5) * 500);
      logWarn('Auth', `Suspected bot (Score: ${decoded.botScore}). Injecting ${delay}ms delay.`, { botScore: decoded.botScore, delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    next();
  } catch (err) {
    // 🔥 PERSISTENT SECURITY LOGGING
    // We don't await this to keep the response fast, but we catch internal errors
    logSecurity('Auth', `Blocked Attempt: ${err.name}`, { ip: req.ip, path: req.path })
      .catch((logErr) => logError('Auth', 'Failed to log security event', logErr, { path: req.path }));

    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid token. Please log in again.';
    
    return res.status(401).json({ error: message });
  }
};

/**
 * Require a specific role
 */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  
  // Admin is superuser
  if (req.user.role === ROLES.ADMIN) return next();
  
  if (req.user.role !== role) {
    return res.status(403).json({ 
      error: `Forbidden: Requires ${role} privileges.` 
    });
  }
  next();
};

/**
 * Require a specific permission
 */
export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  
  // Admin bypass
  if (req.user.role === ROLES.ADMIN) return next();
  
  const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
  if (!userPermissions.includes(permission)) {
    return res.status(403).json({ 
      error: `Forbidden: Missing required permission: ${permission}` 
    });
  }
  next();
};

export default authMiddleware;
