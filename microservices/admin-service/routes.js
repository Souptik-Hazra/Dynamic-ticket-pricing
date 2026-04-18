import express from 'express';
import Admin from './models/Admin.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Register admin
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ name, email, password: hashedPassword });
    await admin.save();
    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login admin
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', adminId: admin._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all admins
router.get('/', async (req, res) => {
  try {
    const admins = await Admin.find();
    res.json(admins);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
