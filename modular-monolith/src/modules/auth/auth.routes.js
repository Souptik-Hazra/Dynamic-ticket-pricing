import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware from '../../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

const issueToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

const safeUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  city: u.city || '',
  birthdate: u.birthdate || null,
  subscription: u.subscription || { plan: 'none', isActive: false },
  createdAt: u.createdAt,
});

// ── Auth Handlers ─────────────────────────────────────────────────────────

const registerHandler = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'password must be at least 6 characters' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role: role || 'user' });
    const token = issueToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) { next(err); }
};

const loginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: issueToken(user), user: safeUser(user) });
  } catch (err) { next(err); }
};

// ── Routes ────────────────────────────────────────────────────────────────

router.post('/signup', requireDB, registerHandler);
router.post('/register', requireDB, registerHandler);
router.post('/login', requireDB, loginHandler);
router.post('/signin', requireDB, loginHandler);

router.get('/me', requireDB, authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

router.put('/update-profile', requireDB, authMiddleware, async (req, res, next) => {
  try {
    const { name, email, city, birthdate, password } = req.body;
    const fields = {};
    if (name) fields.name = name;
    if (email) fields.email = email;
    if (city !== undefined) fields.city = city;
    if (birthdate) fields.birthdate = new Date(birthdate);
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      fields.password = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(req.user.id, fields, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

router.post('/refresh', requireDB, authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ token: issueToken(user), user: safeUser(user) });
  } catch (err) { next(err); }
});

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, decoded: req.user });
});

router.post('/logout', (req, res) => res.json({ message: 'Logged out' }));

export default router;
