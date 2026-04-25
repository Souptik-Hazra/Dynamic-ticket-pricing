import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { issueToken } from '../auth/auth.routes.js';

const router = express.Router();

const safeUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  city: u.city || '',
  birthdate: u.birthdate || null,
  subscription: u.subscription || { plan: 'none', isActive: false },
  botScore: u.botScore || 0,
  createdAt: u.createdAt,
});

router.use(authMiddleware);

// ── GET /api/users/me ──
// Definitive source for current user profile
router.get('/me', requireDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

router.get('/', requireDB, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ users: users.map(safeUser) });
  } catch (err) { next(err); }
});

router.get('/:id', requireDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id ──
// Unified profile management (including security updates)
router.put('/:id', requireDB, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized' });

    const { name, email, city, birthdate, password } = req.body;
    const fields = {};
    if (name) fields.name = name;
    if (email) fields.email = email;
    if (city !== undefined) fields.city = city;
    if (birthdate) fields.birthdate = new Date(birthdate);
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
      fields.password = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const response = { user: safeUser(user) };
    
    // If email changed, re-issue JWT to keep session sync
    if (email && email.toLowerCase() !== req.user.email?.toLowerCase()) {
      response.token = issueToken(user);
    }

    res.json(response);
  } catch (err) { 
    if (err.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    next(err); 
  }
});

router.delete('/:id', requireDB, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
