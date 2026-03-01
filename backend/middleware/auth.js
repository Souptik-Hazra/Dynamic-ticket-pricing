const User = require('../models/User');

// Simplified session-based protect middleware
const protect = async (req, res, next) => {
  // Check if session has user ID
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authorized, please login' });
  }

  try {
    req.user = await User.findById(req.session.userId).select('-password');
    if (!req.user) {
      return res.status(401).json({ error: 'User not found in session' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Session authentication failed' });
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

// Simplified: No JWT needed
const generateToken = (id) => {
  return 'session-based';
};

module.exports = { protect, admin, generateToken };

module.exports = { protect, admin, generateToken };
