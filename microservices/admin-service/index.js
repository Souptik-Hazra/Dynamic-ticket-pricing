import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB, registerProcessHandlers, tuneExpressServer } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import { requestLogger } from '../shared/logger.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import User from '../shared/models/User.js';
import Commission from '../shared/models/Commission.js';
import { cacheDel, cacheDelPattern, CACHE_KEYS, creditUserWallet, debitUserWallet, notify, wsNotifyUser } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger('AdminService'));

connectDB('AdminService');

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'admin-service', ts: new Date().toISOString() })
);

// ── Admin-only guard ───────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
};
const auth = [jwtMiddleware, requireDB, adminOnly];

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'admin-service', ts: new Date().toISOString() })
);

/* ═══════════════════════════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/stats', auth, async (req, res, next) => {
  try {
    const [totalEvents, totalUsers, ticketAgg, recentTickets] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments({ role: { $ne: 'admin' } }),
      Ticket.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalTickets: { $sum: '$quantity' } } },
      ]),
      Ticket.find({ status: 'confirmed' })
        .sort({ purchaseDate: -1 })
        .limit(10)
        .populate('eventId', 'name'),
    ]);

    const { totalRevenue = 0, totalTickets = 0 } = ticketAgg[0] || {};

    res.json({
      stats: {
        totalEvents,
        totalUsers,
        totalTickets,
        totalRevenue,
        recentTickets: recentTickets.map((t) => ({
          _id:          t._id,
          customerName: t.customerName,
          event:        { name: t.eventId?.name || 'Unknown' },
          quantity:     t.quantity,
          totalAmount:  t.totalAmount,
          purchaseDate: t.purchaseDate,
        })),
      },
    });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   EVENTS — full CRUD with revenue enrichment
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/events', auth, async (req, res, next) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });

    const enriched = events.map((ev) => {
      // Use the pre-calculated financial fields now synchronized by Organizer/Payment services
      const totalRevenue = ev.totalRevenue || 0;
      const ticketsSold  = ev.ticketsSold || 0;
      const baseRevenue  = ev.baseRevenue || 0;
      const profitAmount = ev.profitAmount || 0;
      
      return {
        ...ev.toObject(),
        ticketsSold,
        totalRevenue,
        baseRevenue,
        profitAmount,
        profitPercentage: ev.profitPercentage || 0,
      };
    });

    res.json({ events: enriched });
  } catch (err) { next(err); }
});

app.post('/api/admin/events', auth, async (req, res, next) => {
  console.log('[AdminService] Creating event with body:', JSON.stringify(req.body, null, 2));
  try {
    const event = await Event.create(req.body);
    console.log('[AdminService] Event created successfully:', event._id);
    // Invalidate all event list versions
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.status(201).json({ event });
  } catch (err) {
    console.error('[AdminService] Event creation error:', err.message, err.stack);
    next(err);
  }
});

app.put('/api/admin/events/:id', auth, async (req, res, next) => {
  try {
    const id = req.params.id;
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Apply updates and trigger pre-save hook for financial recalculation
    Object.assign(event, req.body);
    await event.save();
    
    // Invalidate detail and all lists
    cacheDel(CACHE_KEYS.EVENT_DETAIL(id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.json({ event });
  } catch (err) { next(err); }
});

app.delete('/api/admin/events/:id', auth, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Invalidate detail and all lists
    cacheDel(CACHE_KEYS.EVENT_DETAIL(req.params.id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.json({ message: 'Event deleted' });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   TICKETS — admin view of all purchases
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/tickets', auth, async (req, res, next) => {
  try {
    const tickets = await Ticket.find()
      .populate('eventId', 'name')
      .sort({ purchaseDate: -1 })
      .limit(500);

    res.json({
      tickets: tickets.map((t) => ({
        _id:              t._id,
        bookingReference: t.bookingReference,
        buyerName:        t.customerName,
        buyerEmail:       t.customerEmail,
        eventName:        t.eventId?.name || 'Unknown',
        categoryName:     t.categoryName,
        quantity:         t.quantity,
        totalAmount:      t.totalAmount,
        status:           t.status,
        purchaseDate:     t.purchaseDate,
      })),
    });
  } catch (err) { next(err); }
});


/* ═══════════════════════════════════════════════════════════════════════════
   USERS
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/users', auth, async (req, res, next) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
});

app.put('/api/admin/users/:id/role', auth, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'organizer', 'admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    // Prevent demoting self
    if (req.params.id === req.user.id.toString() && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself from Admin' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User role updated', user });
  } catch (err) { next(err); }
});

/**
 * POST /api/admin/broadcast
 * Broadcast message to various target groups
 */
app.post('/api/admin/broadcast', auth, async (req, res, next) => {
  try {
    const { target, targetId, title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

    let userIds = [];

    if (target === 'all_organizers') {
      const users = await User.find({ role: 'organizer' }).select('_id');
      userIds = users.map(u => u._id);
    } else if (target === 'event_attendees') {
      if (!targetId) return res.status(400).json({ error: 'Event ID required for event_attendees target' });
      const tickets = await Ticket.find({ eventId: targetId, status: 'confirmed' }).select('userId');
      userIds = [...new Set(tickets.map(t => t.userId))];
    } else if (target === 'all_users') {
      const users = await User.find({ role: 'user' }).select('_id');
      userIds = users.map(u => u._id);
    } else if (target === 'individual') {
      if (!targetId) return res.status(400).json({ error: 'User ID required for individual target' });
      userIds = [targetId];
    } else {
      return res.status(400).json({ error: 'Invalid target group' });
    }

    // Process messaging
    userIds.forEach(uid => {
      notify(uid, 'message', `📢 Admin: ${title}`, message);
      wsNotifyUser(uid, 'message', `📢 Admin Message`, title);
    });

    res.json({ success: true, count: userIds.length, message: `Dispatched to ${userIds.length} users.` });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   COMMISSIONS & ORGANIZER PAYMENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/admin/events/:id/complete
 * Marks event as completed and processes 20% commission payout.
 */
app.post('/api/admin/events/:id/complete', auth, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status === 'completed') return res.status(400).json({ error: 'Event already completed' });

    // 1. Find System Admin (Shared Wallet)
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return res.status(500).json({ error: 'No system admin found' });

    // 2. Calculate Commission (20% - Standardized)
    const revenue = event.totalRevenue || 0;
    const commissionAmount = Math.round(revenue * 0.20);

    // 3. Process Wallet Transfers (Only if organizer exists and amount > 0)
    if (commissionAmount > 0 && event.organizerId) {
      debitUserWallet(event.organizerId, commissionAmount, `Commission payout (20%) for event: ${event.name}`);
      creditUserWallet(admin._id, commissionAmount, `Commission received from ${event.organizerId} for event: ${event.name}`);
    }

    // 4. Create Commission Record (Only if organizer exists)
    if (event.organizerId) {
      await Commission.create({
        eventId: event._id,
        organizerId: event.organizerId,
        adminId: admin._id,
        totalRevenue: revenue,
        commissionAmount,
        percentage: 20,
        status: 'paid'
      });
    }

    // 5. Update Event Status
    event.status = 'completed';
    await event.save();

    // 6. Invalidate Caches
    cacheDel(CACHE_KEYS.EVENT_DETAIL(event._id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.json({ 
      success: true, 
      message: event.organizerId 
        ? 'Event completed and commission processed' 
        : 'Event completed (No commission processed as no organizer was assigned)',
      commissionAmount: event.organizerId ? commissionAmount : 0,
      revenue
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/commissions
 * Returns list of all commission payments.
 */
app.get('/api/admin/commissions', auth, async (req, res, next) => {
  try {
    const commissions = await Commission.find()
      .populate('eventId', 'name venue')
      .populate('organizerId', 'name email')
      .sort({ payoutDate: -1 });
      
    res.json({ commissions });
  } catch (err) { next(err); }
});


// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT_ADMIN_SERVICE || 4003;
const server = app.listen(PORT, () => console.log(`Admin Service running on port ${PORT}`));
registerProcessHandlers(server, 'AdminService');
tuneExpressServer(server);

