import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware from '../../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '15m';
const REFRESH_EXPIRE = process.env.REFRESH_EXPIRE || '7d';

export const issueToken = (user) => 
  jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

export const issueRefreshToken = (user) => 
  jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: REFRESH_EXPIRE });

// ── Auth Handlers ─────────────────────────────────────────────────────────

const registerHandler = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role: role === 'organizer' ? 'organizer' : 'user' });
    
    const token = issueToken(user);
    const refreshToken = issueRefreshToken(user);
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.status(201).json({ token, refreshToken, userId: user._id });
  } catch (err) { 
    if (err.code === 11000) return res.status(409).json({ error: 'Email already registered.' });
    next(err); 
  }
};

const loginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = issueToken(user);
    const refreshToken = issueRefreshToken(user);
    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.json({ token, refreshToken, userId: user._id });
  } catch (err) { next(err); }
};

// ── Routes ────────────────────────────────────────────────────────────────

router.post(['/signup', '/register'], requireDB, registerHandler);
router.post(['/login', '/signin'], requireDB, loginHandler);

router.post('/refresh', requireDB, async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const newToken = issueToken(user);
    const newRefreshToken = issueRefreshToken(user);
    user.refreshToken = await bcrypt.hash(newRefreshToken, 10);
    await user.save();

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) { res.status(401).json({ error: 'Expired session' }); }
});

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, decoded: req.user });
});

router.post('/logout', requireDB, authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $unset: { refreshToken: 1 } });
  } catch {}
  res.json({ success: true });
});

export default router;
