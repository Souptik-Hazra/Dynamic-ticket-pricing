import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import User from '../shared/models/User.js';

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
app.get('/api/admin/stats', auth, async (req, res) => {
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
app.get('/api/admin/events', auth, async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });

    // Aggregate real ticket revenue per event
    const revenueByEvent = await Ticket.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$eventId', realRevenue: { $sum: '$totalAmount' }, realSold: { $sum: '$quantity' } } },
    ]);
    const revMap = Object.fromEntries(revenueByEvent.map((r) => [r._id.toString(), r]));

    const enriched = events.map((ev) => {
      const rev          = revMap[ev._id.toString()] || {};
      const totalRevenue = rev.realRevenue ?? ev.totalRevenue ?? 0;
      const ticketsSold  = rev.realSold    ?? ev.ticketsSold  ?? 0;
      const baseRevenue  = (ev.basePrice || 0) * ticketsSold;
      const profitAmount = totalRevenue - baseRevenue;
      return {
        ...ev.toObject(),
        ticketsSold,
        totalRevenue,
        baseRevenue,
        profitAmount,
        profitPercentage: baseRevenue > 0 ? (profitAmount / baseRevenue) * 100 : 0,
      };
    });

    res.json({ events: enriched });
  } catch (err) { next(err); }
});

app.post('/api/admin/events', auth, async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ event });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/events/:id', auth, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/events/:id', auth, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   TICKETS — admin view of all purchases
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/tickets', auth, async (req, res) => {
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
   FRAUD ANALYTICS
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/fraud-analytics', auth, async (req, res) => {
  try {
    // Per-user purchase aggregation
    const userAgg = await Ticket.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id:            '$userId',
          totalPurchases: { $sum: 1 },
          totalTickets:   { $sum: '$quantity' },
          totalSpent:     { $sum: '$totalAmount' },
          avgQty:         { $avg: '$quantity' },
          maxQty:         { $max: '$quantity' },
          emails:         { $addToSet: '$customerEmail' },
          names:          { $addToSet: '$customerName' },
        },
      },
      { $sort: { totalTickets: -1 } },
      { $limit: 50 },
    ]);

    const rankings = userAgg.map((u) => {
      let score = 0;
      const reasons = [];
      if (u.totalTickets > 30)  { score += 40; reasons.push('Very high ticket volume (>30)'); }
      else if (u.totalTickets > 15) { score += 20; reasons.push('High ticket volume (>15)'); }
      if (u.maxQty >= 15)  { score += 30; reasons.push('Max-per-purchase limit reached'); }
      if (u.totalPurchases > 10) { score += 20; reasons.push('Frequent buyer (>10 orders)'); }
      if (u.avgQty > 8)    { score += 10; reasons.push('High average qty per order'); }

      return {
        userId:               u._id,
        userName:             u.names[0]  || 'Unknown',
        userEmail:            u.emails[0] || 'Unknown',
        totalPurchases:       u.totalPurchases,
        totalTickets:         u.totalTickets,
        totalSpent:           u.totalSpent,
        avgTicketsPerPurchase: parseFloat(u.avgQty.toFixed(1)),
        fraudScore:           score,
        flaggedReasons:       reasons,
        riskLevel:            score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low',
      };
    });

    // Timeline — last 30 days bucketed by day
    const since = new Date(Date.now() - 30 * 86400000);
    const timelineAgg = await Ticket.aggregate([
      { $match: { purchaseDate: { $gte: since } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const timeline = timelineAgg.map((d) => ({
      date:   d._id,
      total:  d.total,
      high:   0,
      medium: 0,
      low:    d.total,
    }));

    const summary = {
      totalUsers:             rankings.length,
      highRiskUsers:          rankings.filter((u) => u.riskLevel === 'high').length,
      mediumRiskUsers:        rankings.filter((u) => u.riskLevel === 'medium').length,
      lowRiskUsers:           rankings.filter((u) => u.riskLevel === 'low').length,
      avgFraudScore:          rankings.length
        ? (rankings.reduce((s, u) => s + u.fraudScore, 0) / rankings.length).toFixed(1)
        : '0.0',
      suspiciousActivityRate: rankings.length
        ? ((rankings.filter((u) => u.riskLevel !== 'low').length / rankings.length) * 100).toFixed(1)
        : '0.0',
    };

    res.json({ fraudAnalytics: { summary, userRankings: rankings, timeline } });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   USERS
═══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/users', auth, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 4003;
const server = app.listen(PORT, () => console.log(`Admin Service running on port ${PORT}`));
registerProcessHandlers(server, 'AdminService');

