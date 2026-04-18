import express from 'express';
import Payment from './models/Payment.js';

const router = express.Router();

// Create payment
router.post('/', async (req, res) => {
  try {
    const { userId, eventId, amount, paymentMethod } = req.body;
    const payment = new Payment({ userId, eventId, amount, paymentMethod, status: 'completed' });
    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List all payments for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.params.userId });
    res.json(payments);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
