const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Token blacklist (in production, use Redis)
const tokenBlacklist = new Set();

// Add token to blacklist
const blacklistToken = (token) => {
  tokenBlacklist.add(token);
  // Auto-cleanup after 7 days
  setTimeout(() => tokenBlacklist.delete(token), 7 * 24 * 60 * 60 * 1000);
};

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Check if token is blacklisted
      if (tokenBlacklist.has(token)) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check token expiration
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return res.status(401).json({ error: 'Token has expired' });
      }

      // Get user from token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ error: 'User account is inactive' });
      }

      // Store token for potential blacklisting
      req.token = token;

      next();
    } catch (error) {
      console.error('Auth error:', error);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
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
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

module.exports = { protect, admin, generateToken, blacklistToken };
