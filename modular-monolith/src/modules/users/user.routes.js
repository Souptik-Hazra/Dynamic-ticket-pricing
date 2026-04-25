import express from 'express';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/me', requireDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

router.get('/', requireDB, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
});

router.get('/:id', requireDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

router.put('/:id', requireDB, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorised to update this profile' });

    const { name, city, birthdate } = req.body;
    const fields = {};
    if (name) fields.name = name;
    if (city !== undefined) fields.city = city;
    if (birthdate) fields.birthdate = new Date(birthdate);

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

router.delete('/:id', requireDB, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

export default router;
