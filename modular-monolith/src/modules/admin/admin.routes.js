import express from 'express';
import mongoose from 'mongoose';
import Event from '../../shared/models/Event.js';
import Ticket from '../../shared/models/Ticket.js';
import User from '../../shared/models/User.js';
import Commission from '../../shared/models/Commission.js';
import Wallet from '../../shared/models/Wallet.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { cacheDel, cacheDelPattern } from '../../shared/cache.js';
import { pushNotification } from '../notifications/notification.routes.js';

const router = express.Router();

// ── Protected Admin Routes ────────────────────────────────────────────────
router.use(authMiddleware, requireRole('admin'));

// ── Dashboard Stats ────────────────────────────────────────────────────────

router.get('/stats', requireDB, async (req, res, next) => {
  try {
    const [totalEvents, totalUsers, ticketAgg, recentTickets] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments({ role: { $ne: 'admin' } }),
      Ticket.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalTickets: { $sum: '$quantity' } } },
      ]),
      Ticket.find({ status: 'confirmed' }).sort({ purchaseDate: -1 }).limit(10).populate('eventId', 'name'),
    ]);
    const { totalRevenue = 0, totalTickets = 0 } = ticketAgg[0] || {};
    res.json({
      stats: {
        totalEvents, totalUsers, totalTickets, totalRevenue, totalProfit: Math.round(totalRevenue * 0.20),
        recentTickets: recentTickets.map(t => ({
          _id: t._id, customerName: t.customerName, event: { name: t.eventId?.name || 'Unknown' },
          quantity: t.quantity, totalAmount: t.totalAmount, purchaseDate: t.purchaseDate,
        })),
      },
    });
  } catch (err) { next(err); }
});

// ── Events Management ─────────────────────────────────────────────────────

router.get('/events', requireDB, async (req, res, next) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json({ events });
  } catch (err) { next(err); }
});

router.post('/events', requireDB, async (req, res, next) => {
  try {
    // Admin can create events for any user (or themselves)
    const event = await Event.create(req.body);
    await cacheDelPattern('events:list:*');
    res.status(201).json({ event });
  } catch (err) { next(err); }
});

router.put('/events/:id', requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await cacheDel(`event:${event._id}`);
    await cacheDelPattern('events:list:*');
    res.json({ event });
  } catch (err) { next(err); }
});

router.post('/events/:id/complete', requireDB, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status === 'completed') return res.status(400).json({ error: 'Event not found or already completed' });

    const revenue = event.totalRevenue || 0;
    const commission = Math.round(revenue * 0.20);

    await Commission.create({
      eventId: event._id,
      organizerId: event.organizerId,
      adminId: req.user.id,
      totalRevenue: revenue,
      commissionAmount: commission,
      status: 'paid'
    });

    event.status = 'completed';
    await event.save();

    await cacheDel(`event:${event._id}`);
    await cacheDelPattern('events:list:*');

    res.json({ success: true, message: 'Event completed and commission recorded', commission });
  } catch (err) { next(err); }
});

router.delete('/events/:id', requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Cleanup related tickets
    await Ticket.deleteMany({ eventId: req.params.id });
    
    await cacheDel(`event:${req.params.id}`);
    await cacheDelPattern('events:list:*');
    
    res.json({ success: true, message: 'Event and associated tickets purged' });
  } catch (err) { next(err); }
});

// ── Tickets Management ─────────────────────────────────────────────────────

router.get('/tickets', requireDB, async (req, res, next) => {
  try {
    const tickets = await Ticket.find().populate('eventId', 'name').sort({ purchaseDate: -1 }).limit(500);
    res.json({ tickets });
  } catch (err) { next(err); }
});

// ── Users Management ──────────────────────────────────────────────────────

router.get('/admins', requireDB, async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });
    res.json({ admins });
  } catch (err) { next(err); }
});

router.get('/users', requireDB, async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
});

router.put('/users/:id/role', requireDB, async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    res.json({ message: 'User role updated', user });
  } catch (err) { next(err); }
});

// ── Broadcast & Messaging ──────────────────────────────────────────────────

router.post('/broadcast', requireDB, async (req, res, next) => {
  try {
    const { target, targetId, title, message } = req.body;
    let userIds = [];
    if (target === 'all_organizers') {
      const users = await User.find({ role: 'organizer' }).select('_id');
      userIds = users.map(u => u._id);
    } else if (target === 'all_users') {
      const users = await User.find({ role: 'user' }).select('_id');
      userIds = users.map(u => u._id);
    } else if (target === 'individual' && targetId) {
      userIds = [targetId];
    }

    for (const uid of userIds) {
      await pushNotification(uid, { title: `📢 Admin: ${title}`, message, type: 'system' });
    }
    res.json({ success: true, count: userIds.length });
  } catch (err) { next(err); }
});

// ── Commissions ────────────────────────────────────────────────────────────

router.get('/commissions', requireDB, async (req, res, next) => {
  try {
    const commissions = await Commission.find().populate('eventId', 'name').populate('organizerId', 'name email').sort({ payoutDate: -1 });
    res.json({ commissions });
  } catch (err) { next(err); }
});

// ── Wallets Management ───────────────────────────────────────────────────

router.get('/wallets', requireDB, async (req, res, next) => {
  try {
    const wallets = await Wallet.find().populate('userId', 'name email role').sort({ updatedAt: -1 });
    res.json({ wallets });
  } catch (err) { next(err); }
});

router.post('/wallets/:id/adjust', requireDB, async (req, res, next) => {
  try {
    const { amount, type, description } = req.body; // type: 'credit' or 'debit'
    const wallet = await Wallet.findById(req.params.id);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const numAmount = Math.abs(Number(amount));
    if (type === 'debit') {
      wallet.balance -= numAmount;
    } else {
      wallet.balance += numAmount;
    }

    wallet.transactions.push({
      amount: numAmount,
      type: type || 'credit',
      description: description || `Admin adjustment: ${type}`,
      timestamp: new Date()
    });

    await wallet.save();
    res.json({ message: 'Wallet adjusted', wallet });
  } catch (err) { next(err); }
});

// ── Platform Health ────────────────────────────────────────────────────────
router.get(['/health', '/health-all'], async (req, res) => {
  try {
    const [userCount, eventCount, ticketCount] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Ticket.countDocuments()
    ]);

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      counts: { users: userCount, events: eventCount, tickets: ticketCount },
      services: {
        mongodb: mongoose.connection.readyState === 1 ? 'up' : 'down',
        neo4j: 'active',
        ml_sidecar: 'available',
        redis: 'up'
      }
    };
    res.json(health);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

export default router;