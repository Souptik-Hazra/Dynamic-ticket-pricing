import express from 'express';
import User from './models/User.js';

const router = express.Router();

// Create user profile
router.post('/', async (req, res) => {
  try {
    const { name, email, preferences } = req.body;
    const user = new User({ name, email, preferences });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get user profile by email
router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update user profile
router.put('/:email', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate({ email: req.params.email }, req.body, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete user profile
router.delete('/:email', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
