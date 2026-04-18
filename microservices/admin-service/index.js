import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import User from '../shared/models/User.js';
import { cacheDel, cacheDelPattern, CACHE_KEYS } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

connectDB('AdminService');

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


// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT_ADMIN_SERVICE || process.env.PORT || 4003;
const server = app.listen(PORT, () => console.log(`Admin Service running on port ${PORT}`));
registerProcessHandlers(server, 'AdminService');

