import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB, registerProcessHandlers, tuneExpressServer } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Ticket from '../shared/models/Ticket.js';
import Event from '../shared/models/Event.js';
import Wallet from '../shared/models/Wallet.js';
import { CACHE_KEYS, notify, wsNotifyUser, creditUserWallet, revertPurchase } from '../shared/interservice.js';
import { requestLogger } from '../shared/logger.js';

dotenv.config();

const app = express();
app.use(compression());
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:"], connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5173"], fontSrc: ["'self'", "https:"] } }, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger('PaymentService'));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'payment-service', ts: new Date().toISOString() })
);

connectDB('PaymentService');

// ── Payment Schema (local to this service, same DB) ───────────────────────
const paymentSchema = new mongoose.Schema(
  {
    ticketId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    eventId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event',  required: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    amount:        { type: Number, required: true, min: 0 },
    bookingReference: { type: String, trim: true },
    currency:      { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'], required: true },
    status:        { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String, unique: true, sparse: true },
    metadata:      { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);
paymentSchema.pre('save', function () {
  if (!this.transactionId) {
    this.transactionId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }
});
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'payment-service', ts: new Date().toISOString() })
);

// POST /api/payments
app.post('/api/payments', jwtMiddleware, requireDB, async (req, res) => {
  try {
    const { ticketId, paymentMethod, cardLast4, upiId } = req.body;
    if (!ticketId)      return res.status(400).json({ error: 'ticketId is required' });
    if (!paymentMethod) return res.status(400).json({ error: 'paymentMethod is required' });

    const validMethods = ['card', 'upi', 'netbanking', 'wallet', 'cash'];
    if (!validMethods.includes(paymentMethod))
      return res.status(400).json({ error: `paymentMethod must be one of: ${validMethods.join(', ')}` });

    const paymentTicketIds = Array.isArray(req.body.metadata?.ticketIds) && req.body.metadata.ticketIds.length > 0
      ? req.body.metadata.ticketIds
      : [ticketId];

    // 1. Fetch tickets with populated event
    const tickets = await Ticket.find({ _id: { $in: paymentTicketIds } }).populate('eventId');
    if (tickets.length !== paymentTicketIds.length) {
      return res.status(404).json({ error: 'One or more tickets were not found' });
    }
    const ticket = tickets[0];
    
    // 2. Validate ownership, event consistency and status
    if (tickets.some(t => t.userId.toString() !== req.user.id))
      return res.status(403).json({ error: 'One or more tickets do not belong to you' });
    
    const invalidTicket = tickets.find(t => t.status !== 'confirmed');
    if (invalidTicket)
      return res.status(400).json({ error: `Ticket status is '${invalidTicket.status}' - cannot process payment` });

    if (!ticket.eventId) {
      return res.status(400).json({ error: 'Event information missing from ticket' });
    }

    const eventId = String(ticket.eventId._id || ticket.eventId);
    if (tickets.some(t => String(t.eventId?._id || t.eventId) !== eventId)) {
      return res.status(400).json({ error: 'All tickets in one payment must belong to the same event' });
    }

    const payableAmount = tickets.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
    if (payableAmount <= 0) return res.status(400).json({ error: 'Invalid ticket amount' });

    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: req.user.id, balance: { $gte: payableAmount } },
        {
          $inc: { balance: -payableAmount },
          $push: {
            transactions: {
              amount: payableAmount,
              type: 'debit',
              description: `Ticket purchase: ${ticket.bookingReference}`,
            },
          },
        },
        { new: true }
      );
      if (!wallet) return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // 3. Create Payment with explicit ObjectIds to prevent TypeErrors
    const payment = await Payment.create({
      ticketId: new mongoose.Types.ObjectId(ticket._id),
      eventId:  new mongoose.Types.ObjectId(ticket.eventId._id || ticket.eventId),
      userId:   new mongoose.Types.ObjectId(req.user.id),
      amount:   payableAmount,
      bookingReference: req.body.bookingReference || ticket.bookingReference,
      paymentMethod,
      status:   'completed',
      metadata: { ...req.body.metadata, ticketIds: paymentTicketIds, cardLast4, upiId },
    });

    // 4. Update Event Revenue & Credit Organizer Wallet
    try {
      const eventId = ticket.eventId._id || ticket.eventId;
      const organizerId = ticket.eventId.organizerId;

      // Increment revenue in event document
      await Event.findByIdAndUpdate(eventId, {
        $inc: { 
          totalRevenue: payment.amount,
          commissionCollected: Math.round(payment.amount * 0.20)
        }
      });

      // Synchronize derived metrics
      const event = await Event.findById(eventId);
      if (event) await event.save(); 

      // ── Real-time Revenue Distribution ──
      // Split revenue: 20% Platform Commission, 80% Organizer Net
      if (organizerId && payment.amount > 0) {
        const commissionAmount = Math.round(payment.amount * 0.20);
        const organizerNet     = payment.amount - commissionAmount;

        // 1. Credit Admin (Commission)
        // Note: In this architecture, we fetch the admin via the shared User model
        const User = mongoose.models.User || mongoose.model('User'); 
        const admin = await User.findOne({ role: 'admin' });
        
        if (admin) {
          creditUserWallet(
            admin._id,
            commissionAmount,
            `Commission (20%) from sale: ${ticket.bookingReference} (Event: ${event?.name || 'N/A'})`
          );
        }

        // 2. Credit Organizer (Net Revenue)
        creditUserWallet(
          organizerId, 
          organizerNet, 
          `Net Revenue (80%) from sale: ${ticket.bookingReference} (Event: ${event?.name || 'N/A'})`
        );
      }
    } catch (updateErr) {
      console.error('[PaymentService] Revenue distribution failed:', updateErr.message);
    }

    res.status(201).json({
      success: true,
      payment,
      message: `Payment of ₹${payment.amount} processed successfully`,
    });

    // 5. Deferred inter-service logic
    try {
      const eventName = ticket.eventId.name || 'Event Ticket';
      notify(req.user.id, 'ticket_purchase',
        `💳 Payment Successful — ${eventName}`,
        `₹${payment.amount} paid via ${paymentMethod}. Transaction: ${payment.transactionId}`
      );
      wsNotifyUser(req.user.id, 'system',
        '💳 Payment Confirmed',
        `₹${payment.amount} paid for ${eventName}`
      );
    } catch (interError) {
      console.error('[PaymentService] Inter-service notifications failed:', interError.message);
    }
  } catch (err) { 
    console.error('[PaymentService] POST /api/payments CRITICAL ERROR:', err);
    // Return detailed error in 500 response temporarily to see what's happening
    res.status(500).json({ 
      error: 'CRITICAL_PAYMENT_FAILED', 
      message: err.message,
      details: err.stack?.split('\n')[0] 
    });
  }
});

// GET /api/payments
app.get('/api/payments', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log(`[PaymentService] Fetching payments for user: ${userId}`);
    
    // Ensure we are querying with the correct type
    const query = { userId };
    if (mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = new mongoose.Types.ObjectId(userId);
    }

    const payments = await Payment.find(query)
      .populate('eventId', 'name venue startDate')
      .sort({ createdAt: -1 });
    
    console.log(`[PaymentService] Found ${payments.length} payments for user ${userId}`);

    // Safety pass: ensure eventId is not null for the frontend
    const cleanedPayments = payments.map(p => {
      const obj = p.toObject ? p.toObject() : p;
      return {
        ...obj,
        eventName: p.eventId?.name || 'Unknown Event',
        eventVenue: p.eventId?.venue || 'Unknown Venue'
      };
    });

    res.json({ 
      success: true,
      payments: cleanedPayments,
      count: cleanedPayments.length 
    });
  } catch (err) { 
    console.error('[PaymentService] GET /api/payments Error:', err);
    next(err); 
  }
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
    
    // Update all tickets covered by this payment, not just the lead ticket.
    const refundTicketIds = Array.isArray(payment.metadata?.ticketIds) && payment.metadata.ticketIds.length > 0
      ? payment.metadata.ticketIds
      : [payment.ticketId];
    const tickets = await Ticket.find({ _id: { $in: refundTicketIds } });
    await Ticket.updateMany({ _id: { $in: refundTicketIds } }, { status: 'refunded', isUsed: false });
    const ticket = tickets[0];
    
    let refundAmount = 0;
    if (ticket) {
      // 85% REFUND POLICY: User gets 85%, Organizer loses 85% (keeps 15% as fee)
      refundAmount = Math.round(payment.amount * 0.85);
      const refundedQuantity = tickets.reduce((sum, t) => sum + (Number(t.quantity) || 1), 0);
      const seatNumbers = tickets.map(t => t.seatNumber).filter(Boolean);

      // ── Inter-service: revert 85% revenue in Organizer Service
      revertPurchase(ticket.eventId, ticket.categoryName, refundedQuantity, refundAmount, seatNumbers);

      // ── Inter-service: Credit User Wallet with 85%
      creditUserWallet(payment.userId, refundAmount, `Refund (85% payout) for ${ticket.eventId?.name || 'ticket'}`);
    }

    res.json({ message: 'Refund processed', payment });

    // ── Inter-service: notify user about refund ──────────────────────────
    notify(req.user.id, 'refund',
      '💸 Refund Processed',
      `₹${refundAmount} refunded for event: ${ticket?.eventId?.name || 'ticket'}. Transaction: ${payment.transactionId}`
    );
    wsNotifyUser(req.user.id, 'refund',
      '💸 Refund Issued',
      `Your ₹${refundAmount} refund (85% payout) has been processed.`
    );
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_PAYMENT_SERVICE || 4004;
const server = app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
registerProcessHandlers(server, 'PaymentService');
tuneExpressServer(server);
