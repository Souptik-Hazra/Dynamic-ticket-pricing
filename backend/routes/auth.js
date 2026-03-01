
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');
const bcryptjs = require('bcryptjs');

// @route   PUT /api/auth/update-profile
// @desc    Update user profile
// @access  Private
router.put('/update-profile', protect, async (req, res) => {
  try {
    const user = req.user;
    
    // Allow updating name, email, icon, city, birthdate, and password
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.icon) user.icon = req.body.icon;
    if (req.body.city) user.city = req.body.city;
    if (req.body.birthdate) user.birthdate = req.body.birthdate;
    
    // Hash password if provided
    if (req.body.password) {
      if (req.body.password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const salt = await bcryptjs.genSalt(10);
      user.password = await bcryptjs.hash(req.body.password, salt);
    }
    
    await user.save();
    res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    console.log('📝 Signup request received:', { name: req.body.name, email: req.body.email });
    
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      console.log('❌ Validation failed: Missing fields');
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    if (password.length < 8) {
      console.log('❌ Validation failed: Password too short');
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Check for at least one number and one letter
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      console.log('❌ Validation failed: Password must contain letters and numbers');
      return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: 'user'  // Default role
    });

    console.log('✅ User created successfully:', user._id);

    await user.save();

    // Store user in session
    req.session.user = user.toJSON();

    console.log('✅ User created and session established');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// @route   POST /api/auth/signin
// @desc    Login user
// @access  Public
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Find user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is inactive. Please contact support.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Store user in session
    req.session.user = user.toJSON();

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscription: user.subscription?.plan || 'free'
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        subscription: user.subscription,
        icon: user.icon,
        city: user.city,
        birthdate: user.birthdate
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Not authorized' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Public
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out, please try again' });
    }
    res.clearCookie('connect.sid'); // default express-session cookie name
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;
