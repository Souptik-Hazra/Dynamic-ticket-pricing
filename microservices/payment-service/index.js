import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Ticket from '../shared/models/Ticket.js';
import Event from '../shared/models/Event.js';
import { notify, wsNotifyUser, sendEmailTemplate } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('PaymentService');

// ── Payment Schema (local to this service, same DB) ───────────────────────
const paymentSchema = new mongoose.Schema(
  {
    ticketId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    eventId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event',  required: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    amount:        { type: Number, required: true, min: 0 },
    currency:      { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'], required: true },
    status:        { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String, unique: true, sparse: true },
    metadata:      { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);
paymentSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }
  next();
});
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'payment-service', ts: new Date().toISOString() })
);

// POST /api/payments
app.post('/api/payments', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { ticketId, paymentMethod, cardLast4, upiId } = req.body;
    if (!ticketId)      return res.status(400).json({ error: 'ticketId is required' });
    if (!paymentMethod) return res.status(400).json({ error: 'paymentMethod is required' });

    const validMethods = ['card', 'upi', 'netbanking', 'wallet', 'cash'];
    if (!validMethods.includes(paymentMethod))
      return res.status(400).json({ error: `paymentMethod must be one of: ${validMethods.join(', ')}` });

    const ticket = await Ticket.findById(ticketId).populate('eventId', 'name');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.userId.toString() !== req.user.id)
      return res.status(403).json({ error: 'This ticket does not belong to you' });
    if (ticket.status !== 'confirmed')
      return res.status(400).json({ error: `Ticket status is '${ticket.status}' — cannot process payment` });

    const payment = await Payment.create({
      ticketId: ticket._id,
      eventId:  ticket.eventId._id,
      userId:   req.user.id,
      amount:   ticket.totalAmount,
      paymentMethod,
      status:   'completed',
      metadata: { cardLast4, upiId },
    });

    res.status(201).json({
      payment,
      ticket,
      message: `Payment of ₹${ticket.totalAmount} processed for ${ticket.eventId.name}`,
    });

    // ── Inter-service: notify + email (after response sent) ──────────────
    const eventName = ticket.eventId.name;
    notify(req.user.id, 'ticket_purchase',
      `💳 Payment Successful — ${eventName}`,
      `₹${ticket.totalAmount} paid via ${paymentMethod}. Transaction: ${payment.transactionId}`
    );
    wsNotifyUser(req.user.id, 'system',
      '💳 Payment Confirmed',
      `₹${ticket.totalAmount} paid for ${eventName}`
    );
  } catch (err) { next(err); }
});

// GET /api/payments
app.get('/api/payments', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('eventId', 'name venue')
      .sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) { next(err); }
});

// GET /api/payments/:id
app.get('/api/payments/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('ticketId')
      .populate('eventId', 'name venue startDate');
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorised to view this payment' });
    res.json({ payment });
  } catch (err) { next(err); }
});

// POST /api/payments/:id/refund
app.post('/api/payments/:id/refund', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorised' });
    if (payment.status !== 'completed')
      return res.status(400).json({ error: `Cannot refund a payment with status '${payment.status}'` });

    payment.status = 'refunded';
    await payment.save();
    await Ticket.findByIdAndUpdate(payment.ticketId, { status: 'refunded' });

    res.json({ message: 'Refund processed', payment });

    // ── Inter-service: notify user about refund ──────────────────────────
    notify(req.user.id, 'refund',
      '💸 Refund Processed',
      `₹${payment.amount} refunded. Transaction: ${payment.transactionId}`
    );
    wsNotifyUser(req.user.id, 'refund',
      '💸 Refund Issued',
      `Your ₹${payment.amount} refund is being processed.`
    );
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT || 4004;
const server = app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
registerProcessHandlers(server, 'PaymentService');
