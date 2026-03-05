const jwt = require('jsonwebtoken');

// SECURITY: JWT_SECRET is required - do not use fallback in production
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('\x1b[31m%s\x1b[0m', '❌ CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('\x1b[33m%s\x1b[0m', '   Set JWT_SECRET in your .env file with a strong random string (32+ characters)');
  console.error('\x1b[33m%s\x1b[0m', '   Example: JWT_SECRET=your-super-secret-key-here-make-it-long-and-random');
  process.exit(1);
}

const User = require('../models/User');

// Reduced token lifetime for security (default 1 hour, refresh before expiry)
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

// Protect middleware: verify JWT and attach user
// Accept token from Authorization header (Bearer) or cookies
const protect = async (req, res, next) => {
  let token = null;

  // Prefer Authorization header, fallback to cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ error: 'User not found' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin only middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin only.' });
  }
};

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: JWT_EXPIRE
  });
};

// Generate refresh token (longer lived)
const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, jwtSecret, {
    expiresIn: JWT_REFRESH_EXPIRE
  });
};

// Verify refresh token and issue new access token
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, jwtSecret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      token: generateToken(user._id),
      user: user.toJSON()
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = { protect, admin, generateToken, generateRefreshToken, refreshAccessToken };
