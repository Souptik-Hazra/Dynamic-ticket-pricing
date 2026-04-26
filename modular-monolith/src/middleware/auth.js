import jwt from 'jsonwebtoken';
import config from '../shared/config/index.js';
import { logSecurity } from '../shared/utils/logger.js';

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
      console.warn(`🛡️ [Security:Friction] Suspected bot (Score: ${decoded.botScore}). Injecting ${delay}ms delay.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    next();
  } catch (err) {
    // 🔥 PERSISTENT SECURITY LOGGING
    // We don't await this to keep the response fast, but we catch internal errors
    logSecurity('Auth', `Blocked Attempt: ${err.name}`, { ip: req.ip, path: req.path })
      .catch(logErr => console.error(`[AuthLog] Failed to log security event: ${logErr.message}`));

    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid token. Please log in again.';
    
    return res.status(401).json({ error: message });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role === 'admin') return next();
  if (req.user.role !== role) {
    return res.status(403).json({ 
      error: `Forbidden: Requires ${role} privileges.` 
    });
  }
  next();
};

export default authMiddleware;
