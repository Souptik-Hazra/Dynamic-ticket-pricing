const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'default_secret';

const User = require('../models/User');

const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// (Removed duplicate protect middleware declaration)
// Simplified protect middleware: verify JWT and attach user
const protect = async (req, res, next) => {
  let token = null;
  // Accept token from Authorization header (Bearer) or from query/body for flexibility
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  } else if (req.body && req.body.token) {
    token = req.body.token;
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

module.exports = { protect, admin, generateToken };
