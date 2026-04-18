import express from 'express';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Helper to generate token
const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

// Helper to format user response (strip password)
const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  city: user.city || '',
  birthdate: user.birthdate || null,
  subscription: user.subscription || { plan: 'none', isActive: false },
  createdAt: user.createdAt
});

// Register (legacy endpoint)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role: role || 'user' });
    await user.save();

    const token = generateToken(user);
    res.status(201).json({ message: 'User registered successfully', token, user: formatUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Signup (frontend-compatible alias for register)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role: role || 'user' });
    await user.save();

    const token = generateToken(user);
    res.status(201).json({ message: 'Signup successful', token, user: formatUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login (legacy endpoint)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({ message: 'Login successful', token, user: formatUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Signin (frontend-compatible alias for login)
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({ message: 'Login successful', token, user: formatUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get current user (me)
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    User.findById(decoded.id).select('-password').then((user) => {
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: formatUser(user) });
    }).catch((err) => res.status(500).json({ error: err.message }));
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Update profile (name, email, city, birthdate, password)
router.put('/update-profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, email, city, birthdate, password } = req.body;

    const updateFields = {};
    if (name)      updateFields.name = name;
    if (email)     updateFields.email = email;
    if (city !== undefined) updateFields.city = city;
    if (birthdate) updateFields.birthdate = new Date(birthdate);
    if (password && password.length >= 6) {
      updateFields.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      decoded.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: formatUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Token refresh — re-verify current token and issue a new one
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const headerToken = req.headers.authorization?.split(' ')[1];
  const tokenToVerify = headerToken || refreshToken;

  if (!tokenToVerify) return res.status(401).json({ error: 'No token provided' });
  try {
    // We use the same JWT as refresh (stateless — just re-issue if still valid)
    const decoded = jwt.verify(tokenToVerify, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newToken = generateToken(user);
    res.json({ token: newToken, user: formatUser(user) });
  } catch (err) {
    res.status(401).json({ error: 'Token invalid or expired. Please log in again.' });
  }
});

// Verify token
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, decoded });
  } catch (err) {
    res.status(401).json({ valid: false, error: err.message });
  }
});

// Logout (stateless JWT — just acknowledge)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;

