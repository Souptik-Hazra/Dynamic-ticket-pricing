import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import User from '../shared/models/User.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('AuthService');

const JWT_SECRET = process.env.JWT_SECRET || 'SouptikHazraSecretKey';
const JWT_EXPIRE  = '7d';

const issueToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

const safeUser = (u) => ({
  _id:          u._id,
  name:         u.name,
  email:        u.email,
  role:         u.role,
  city:         u.city         || '',
  birthdate:    u.birthdate    || null,
  subscription: u.subscription || { plan: 'none', isActive: false },
  createdAt:    u.createdAt,
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'authentication-service', ts: new Date().toISOString() })
);

// ── Register / Signup ────────────────────────────────────────────────────
const registerHandler = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'password must be at least 6 characters' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ name, email, password: hashed, role: role || 'user' });
    const token  = issueToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) { next(err); } // ← Mongoose duplicate-key goes to errorHandler → 409
};
app.post('/api/auth/signup',   requireDB, registerHandler);
app.post('/api/auth/register', requireDB, registerHandler);

// ── Login / Signin ────────────────────────────────────────────────────────
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
app.post('/api/auth/signin', requireDB, loginHandler);
app.post('/api/auth/login',  requireDB, loginHandler);

// ── Get current user ───────────────────────────────────────────────────────
app.get('/api/auth/me', requireDB, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET); // throws on bad/expired token
    const user    = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); } // JWT errors go to errorHandler → 401
});

// ── Update profile ─────────────────────────────────────────────────────────
app.put('/api/auth/update-profile', requireDB, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, email, city, birthdate, password } = req.body;

    const fields = {};
    if (name)                fields.name      = name;
    if (email)               fields.email     = email;
    if (city  !== undefined) fields.city      = city;
    if (birthdate)           fields.birthdate = new Date(birthdate);
    if (password) {
      if (password.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      fields.password = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(decoded.id, fields, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── Token refresh ─────────────────────────────────────────────────────────
app.post('/api/auth/refresh', requireDB, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.body.refreshToken;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ token: issueToken(user), user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── Verify token ──────────────────────────────────────────────────────────
app.get('/api/auth/verify', (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ valid: false, error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, decoded });
  } catch (err) { next(err); }
});

// ── Logout ────────────────────────────────────────────────────────────────
app.post('/api/auth/logout', (_req, res) => res.json({ message: 'Logged out' }));

// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT || 4001;
const server = app.listen(PORT, () => console.log(`Authentication Service running on port ${PORT}`));
registerProcessHandlers(server, 'AuthService');
