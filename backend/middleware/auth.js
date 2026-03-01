// Simplified session-based protect middleware
const protect = async (req, res, next) => {
  // Check if session has user data
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authorized, please login' });
  }

  req.user = req.session.user;
  next();
};

// Admin only middleware
const admin = (req, res, next) => {
  if (req.session?.user?.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin only.' });
  }
};

module.exports = { protect, admin };
