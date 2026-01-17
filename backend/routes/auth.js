const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

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

    if (password.length < 6) {
      console.log('❌ Validation failed: Password too short');
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    // Generate token
    const token = generateToken(user._id);

    console.log('✅ Token generated, sending response');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
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

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
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
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Not authorized' });
  }
});

// @route   POST /api/auth/create-admin
// @desc    Create admin user (temporary - remove in production)
// @access  Public (SHOULD BE PROTECTED IN PRODUCTION)
router.post('/create-admin', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    const token = generateToken(admin._id);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

module.exports = router;
