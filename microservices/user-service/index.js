import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import User from '../shared/models/User.js';

dotenv.config();

const app = express();
app.use(express.json());

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'user-service', ts: new Date().toISOString() })
);

connectDB('UserService');

// All user management routes require auth
app.use(jwtMiddleware);

app.get('/api/users/me', requireDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

app.get('/api/users', requireDB, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
});

app.get('/api/users/:id', requireDB, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); } // CastError on bad :id → errorHandler → 400
});

app.put('/api/users/:id', requireDB, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorised to update this profile' });

    const { name, city, birthdate } = req.body;
    const fields = {};
    if (name)               fields.name      = name;
    if (city !== undefined) fields.city      = city;
    if (birthdate)          fields.birthdate = new Date(birthdate);

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

app.delete('/api/users/:id', requireDB, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_USER_SERVICE || process.env.PORT || 4002;
const server = app.listen(PORT, () => console.log(`User Service running on port ${PORT}`));
registerProcessHandlers(server, 'UserService');
