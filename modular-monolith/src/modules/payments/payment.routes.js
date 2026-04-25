import express from 'express';
import mongoose from 'mongoose';
import Payment from '../../shared/models/Payment.js';
import Wallet from '../../shared/models/Wallet.js';
import Ticket from '../../shared/models/Ticket.js';
import Event from '../../shared/models/Event.js';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware from '../../middleware/auth.js';
import { cacheDel, cacheDelPattern } from '../../shared/cache.js';
import dotenv from 'dotenv';
import bus from '../../shared/InternalBus.js';

const router = express.Router();

// ── Payment Routes ─────────────────────────────────────────────────────────

router.post('/', authMiddleware, requireDB, async (req, res, next) => {
  const { ticketId, paymentMethod, metadata } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentTicketIds = Array.isArray(metadata?.ticketIds) ? metadata.ticketIds : [ticketId];
    const tickets = await Ticket.find({ _id: { $in: paymentTicketIds } }).populate('eventId').session(session);
    if (tickets.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Tickets not found' });
    }

    const payableAmount = tickets.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);

    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: req.user.id, balance: { $gte: payableAmount } },
        {
          $inc: { balance: -payableAmount },
          $push: { transactions: { amount: payableAmount, type: 'debit', description: `Tickets purchase: ${tickets[0].bookingReference}` } }
        },
        { new: true, session }
      );
      if (!wallet) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }
    }

    const payment = await Payment.create([{
      ticketId: tickets[0]._id,
      eventId: tickets[0].eventId._id,
      userId: req.user.id,
      amount: payableAmount,
      bookingReference: tickets[0].bookingReference,
      paymentMethod,
      status: 'completed',
      metadata: { ...metadata, ticketIds: paymentTicketIds }
    }], { session });

    // ── CONFIRM TICKETS ──
    await Ticket.updateMany(
      { _id: { $in: paymentTicketIds } },
      { $set: { status: 'confirmed' } },
      { session }
    );

    const commission = Math.round(payableAmount * 0.20);
    const organizerNet = payableAmount - commission;

    await Event.findByIdAndUpdate(tickets[0].eventId._id, {
      $inc: { totalRevenue: payableAmount, commissionCollected: commission }
    }, { session });

    const admin = await User.findOne({ role: 'admin' }).session(session);
    if (admin) {
      await Wallet.findOneAndUpdate(
        { userId: admin._id },
        { $inc: { balance: commission }, $push: { transactions: { amount: commission, type: 'credit', description: `Commission from ${tickets[0].bookingReference}` } } },
        { upsert: true, session }
      );
    }

    if (tickets[0].eventId.organizerId) {
      await Wallet.findOneAndUpdate(
        { userId: tickets[0].eventId.organizerId },
        { $inc: { balance: organizerNet }, $push: { transactions: { amount: organizerNet, type: 'credit', description: `Revenue from ${tickets[0].bookingReference}` } } },
        { upsert: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // ── Emit Decoupled Event ──
    bus.publish('payment.success', {
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      amount: payableAmount,
      eventName: tickets[0].eventId.name,
      venue: tickets[0].eventId.venue,
      startDate: new Date(tickets[0].eventId.startDate).toLocaleDateString(),
      bookingReference: tickets[0].bookingReference,
      categoryName: tickets[0].categoryName || 'General',
      quantity: tickets.reduce((sum, t) => sum + (t.quantity || 1), 0)
    });

    res.status(201).json({ success: true, payment: payment[0] });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});

router.get('/', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('eventId', 'name venue startDate')
      .sort({ createdAt: -1 });
    
    const cleanedPayments = payments.map(p => ({
      ...p.toObject(),
      eventName: p.eventId?.name || 'Unknown Event',
      eventVenue: p.eventId?.venue || 'Unknown Venue'
    }));

    res.json({ success: true, payments: cleanedPayments, count: cleanedPayments.length });
  } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('ticketId')
      .populate('eventId', 'name venue startDate');
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized to view this payment' });
    res.json({ success: true, payment });
  } catch (err) { next(err); }
});

router.post('/:id/refund', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.status !== 'completed') return res.status(400).json({ error: 'Invalid payment for refund' });

    const refundAmount = Math.round(payment.amount * 0.85);
    const commissionRefund = Math.round(payment.amount * 0.20);

    payment.status = 'refunded';
    await payment.save();

    const ticketIds = Array.isArray(payment.metadata?.ticketIds) ? payment.metadata.ticketIds : [payment.ticketId];
    const tickets = await Ticket.find({ _id: { $in: ticketIds } });
    await Ticket.updateMany({ _id: { $in: ticketIds } }, { status: 'refunded' });

    // ── Revert Event Inventory & Revenue ──
    const event = await Event.findById(payment.eventId);
    if (event) {
      const quantity = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      event.availableTickets = Math.min(event.capacity, (event.availableTickets || 0) + quantity);
      event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - quantity);
      event.totalRevenue = Math.max(0, (event.totalRevenue || 0) - payment.amount);
      event.commissionCollected = Math.max(0, (event.commissionCollected || 0) - commissionRefund);
      
      // Handle categories if present
      for (const t of tickets) {
        const cat = event.ticketCategories.find(c => c.name === t.categoryName);
        if (cat) {
          cat.availableSeats = Math.min(cat.seats, (cat.availableSeats || 0) + (t.quantity || 1));
          if (t.seatNumber) cat.bookedSeats = (cat.bookedSeats || []).filter(s => s !== t.seatNumber);
        }
      }
      await event.save();
      await cacheDel(`event:${event._id}`);
      await cacheDelPattern('events:list:*');
    }

    // Credit User Wallet (85%)
    await Wallet.findOneAndUpdate(
      { userId: payment.userId },
      { $inc: { balance: refundAmount }, $push: { transactions: { amount: refundAmount, type: 'credit', description: `Refund (85%) for ${payment.bookingReference}` } } },
      { upsert: true }
    );

    // Claw back from Organizer (100% of their net)
    // Organizer originally got 80% (payment.amount * 0.80)
    const organizerClawback = Math.round(payment.amount * 0.80);
    if (event && event.organizerId) {
      await Wallet.findOneAndUpdate(
        { userId: event.organizerId },
        { $inc: { balance: -organizerClawback }, $push: { transactions: { amount: organizerClawback, type: 'debit', description: `Refund Clawback for ${payment.bookingReference}` } } },
        { upsert: true }
      );
    }

    await pushNotification(payment.userId, { title: '💸 Refund Processed', message: `₹${refundAmount} (85%) refunded for ${payment.bookingReference}`, type: 'refund' });
    res.json({ message: 'Refund processed (85% payout)', refundAmount });
  } catch (err) { next(err); }
});

// ── Wallet Routes ──────────────────────────────────────────────────────────

// This handles GET /api/wallet/balance OR GET /api/payments/wallet/balance
router.get(['/balance', '/wallet/balance'], authMiddleware, requireDB, async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) wallet = await Wallet.create({ userId: req.user.id, balance: 0, transactions: [] });
    res.json({ balance: wallet.balance, transactions: wallet.transactions.slice(-20).reverse() });
  } catch (err) { next(err); }
});

router.post(['/deposit', '/wallet/deposit'], authMiddleware, requireDB, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const wallet = await Wallet.findOneAndUpdate(
      { userId: req.user.id },
      { $inc: { balance: Number(amount) }, $push: { transactions: { amount: Number(amount), type: 'credit', description: 'Funds deposited' } } },
      { new: true, upsert: true }
    );

    await pushNotification(req.user.id, { 
      title: '💳 Money Added', 
      message: `₹${amount} deposited into your wallet successfully.`, 
      type: 'system' 
    });

    res.json({ balance: wallet.balance, message: 'Deposit successful' });
  } catch (err) { next(err); }
});

router.post(['/withdraw', '/wallet/withdraw'], authMiddleware, requireDB, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet || wallet.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    wallet.balance -= amount;
    wallet.transactions.push({ amount, type: 'debit', description: 'Withdrawal to Bank' });
    await wallet.save();

    await pushNotification(req.user.id, { 
      title: '💸 Money Withdrawn', 
      message: `₹${amount} withdrawn to your bank account successfully.`, 
      type: 'system' 
    });

    res.json({ balance: wallet.balance, message: 'Withdrawal successful' });
  } catch (err) { next(err); }
});

export default router;
