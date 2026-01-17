// Input validation middleware
const validator = require('validator');

// Validate email
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  
  next();
};

// Validate password strength
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  
  if (!password || password.length < 8) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters long' 
    });
  }
  
  // Check for at least one number and one letter
  if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return res.status(400).json({ 
      error: 'Password must contain at least one letter and one number' 
    });
  }
  
  next();
};

// Validate MongoDB ObjectId
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    next();
  };
};

// Validate numeric input
const validateNumeric = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body[field];
      
      if (value !== undefined && value !== null) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) {
          return res.status(400).json({ 
            error: `${field} must be a positive number` 
          });
        }
      }
    }
    
    next();
  };
};

// Validate required fields
const validateRequired = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      if (!req.body[field]) {
        return res.status(400).json({ 
          error: `${field} is required` 
        });
      }
    }
    
    next();
  };
};

// Sanitize string input
const sanitizeString = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Remove HTML tags
      value = value.replace(/<[^>]*>/g, '');
      // Remove script tags
      value = value.replace(/<script[^>]*>.*?<\/script>/gi, '');
      // Remove javascript: protocol
      value = value.replace(/javascript:/gi, '');
      // Remove on* event handlers
      value = value.replace(/on\w+\s*=/gi, '');
      // Trim whitespace
      value = value.trim();
    }
    return value;
  };

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      req.body[key] = sanitizeValue(req.body[key]);
    }
  }

  // Sanitize query
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      req.query[key] = sanitizeValue(req.query[key]);
    }
  }

  next();
};

// Prevent NoSQL injection
const preventNoSQLInjection = (req, res, next) => {
  const checkForInjection = (obj) => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        // Check for $where, $regex, and other potentially dangerous operators
        if (key.startsWith('$')) {
          return true;
        }
        if (typeof obj[key] === 'object') {
          if (checkForInjection(obj[key])) {
            return true;
          }
        }
      }
    }
    return false;
  };

  if (checkForInjection(req.body) || checkForInjection(req.query)) {
    return res.status(400).json({ 
      error: 'Potential security threat detected' 
    });
  }

  next();
};

// Validate date
const validateDate = (fieldName) => {
  return (req, res, next) => {
    const dateValue = req.body[fieldName];
    
    if (dateValue) {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ 
          error: `${fieldName} must be a valid date` 
        });
      }
      
      // Ensure date is not in the past (for events)
      if (date < new Date()) {
        return res.status(400).json({ 
          error: `${fieldName} cannot be in the past` 
        });
      }
    }
    
    next();
  };
};

// Rate limit per user
const userRateLimit = new Map();
const createUserRateLimit = (maxRequests = 10, windowMs = 60000) => {
  return (req, res, next) => {
    if (!req.user) return next();
    
    const userId = req.user.id || req.user._id;
    const now = Date.now();
    
    if (!userRateLimit.has(userId)) {
      userRateLimit.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userRequests = userRateLimit.get(userId);
    
    if (now > userRequests.resetTime) {
      userRateLimit.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userRequests.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please slow down.' 
      });
    }
    
    userRequests.count++;
    next();
  };
};

// Cleanup rate limit map
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userRateLimit.entries()) {
    if (now > data.resetTime) {
      userRateLimit.delete(userId);
    }
  }
}, 300000);

module.exports = {
  validateEmail,
  validatePassword,
  validateObjectId,
  validateNumeric,
  validateRequired,
  sanitizeString,
  preventNoSQLInjection,
  validateDate,
  createUserRateLimit
};
