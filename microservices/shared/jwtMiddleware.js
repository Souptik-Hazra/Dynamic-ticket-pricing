import jwt from 'jsonwebtoken';

/**
 * Express middleware — validates JWT from Authorization header.
 * Sets req.user = { id, email, role } on success.
 */
const jwtMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[JWT] CRITICAL: JWT_SECRET environment variable is missing.');
      return res.status(500).json({ error: 'Internal Server Error: Secure configuration missing.' });
    }
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, email, role, iat, exp }
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid token. Please log in again.';
    return res.status(401).json({ error: message });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  
  // Admin bypass: Admins can access everything
  if (req.user.role === 'admin') return next();

  if (req.user.role !== role) {
    return res.status(403).json({ 
      error: `Forbidden: This resource requires ${role} privileges. Your role: ${req.user.role}` 
    });
  }
  
  next();
};

export default jwtMiddleware;
