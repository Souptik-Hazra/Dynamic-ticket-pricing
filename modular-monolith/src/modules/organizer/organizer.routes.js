import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import Event from '../../shared/models/Event.js';
import Ticket from '../../shared/models/Ticket.js';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { cacheDel, cacheDelPattern } from '../../shared/cache.js';
import { pushNotification } from '../notifications/notification.routes.js';
import { predictMLPrice } from '../../shared/utils.js';

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

// ML prediction uses centralized helper from `src/shared/utils.js`

// ── Event Discovery (Public) ──────────────────────────────────────────────

// Handles GET /api/events or GET /api/organizers/events (public view)
router.get('/', async (req, res, next) => {
  try {
    const events = await Event.find({ status: { $ne: 'cancelled' } }).sort({ startDate: 1 });
    res.json(events);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) { next(err); }
});

router.get('/:id/dynamic-prices', requireDB, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const prices = {};
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      for (const cat of event.ticketCategories) {
        prices[cat.name] = await predictMLPrice(cat, event);
      }
    } else {
      prices['standard'] = await predictMLPrice(null, event);
    }
    res.json({ eventId: event._id, prices, occupancyRate: Math.round(((event.ticketsSold || 0) / (event.capacity || 1)) * 100) });
  } catch (err) { next(err); }
});

// ── Organizer Management (Protected) ────────────────────────────────────────

router.get('/stats', authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const organizerId = req.user.id;
    const [eventsCount, ticketsAgg] = await Promise.all([
      Event.countDocuments({ organizerId }),
      Ticket.aggregate([
        { $match: { status: 'confirmed' } },
        { 
          $lookup: {
            from: 'events',
            localField: 'eventId',
            foreignField: '_id',
            as: 'event'
          }
        },
        { $unwind: '$event' },
        { $match: { 'event.organizerId': new mongoose.Types.ObjectId(organizerId) } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalTickets: { $sum: '$quantity' } } }
      ])
    ]);
    const { totalRevenue = 0, totalTickets = 0 } = ticketsAgg[0] || {};
    res.json({ stats: { totalEvents: eventsCount, totalTickets, totalRevenue } });
  } catch (err) { next(err); }
});

// Special handler for "My Events" - Maps to GET /api/organizers/events (for organizer role)
// or can be hit via /api/organizers/my-events
router.get('/my-events', authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ startDate: 1 });
    res.json({ events });
  } catch (err) { next(err); }
});

// Alias for compatibility: GET /api/organizers/events (when logged in as organizer)
router.get(['/events', '/my-list'], authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ startDate: 1 });
    res.json({ events });
  } catch (err) { next(err); }
});

router.post(['/', '/events'], authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const event = await Event.create({ ...req.body, organizerId: req.user.id });
    await cacheDelPattern('events:list:*');
    res.status(201).json({ event });
  } catch (err) { next(err); }
});

router.put(['/:id', '/events/:id'], authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizerId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found or unauthorized' });
    await cacheDel(`event:${event._id}`);
    await cacheDelPattern('events:list:*');
    res.json({ event });
  } catch (err) { next(err); }
});

router.delete(['/:id', '/events/:id'], authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const event = await Event.findOneAndDelete({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found or unauthorized' });
    
    // Deleting an event also cancels all tickets
    await Ticket.updateMany({ eventId: req.params.id }, { $set: { status: 'cancelled' } });
    
    await cacheDel(`event:${req.params.id}`);
    await cacheDelPattern('events:list:*');
    
    res.json({ success: true, message: 'Event deleted and tickets cancelled' });
  } catch (err) { next(err); }
});

router.get('/tickets', authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user.id }).select('_id');
    const eventIds = events.map(e => e._id);
    const tickets = await Ticket.find({ eventId: { $in: eventIds } }).populate('eventId', 'name').sort({ purchaseDate: -1 });
    res.json({ tickets });
  } catch (err) { next(err); }
});

router.post('/broadcast', authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const { eventId, title, message } = req.body;
    const tickets = await Ticket.find({ eventId, status: 'confirmed' }).select('userId');
    const userIds = [...new Set(tickets.map(t => String(t.userId)))];
    for (const uid of userIds) {
      await pushNotification(uid, { title: `📢 Event Update: ${title}`, message, type: 'event_update' });
    }
    res.json({ success: true, count: userIds.length });
  } catch (err) { next(err); }
});

router.post('/message-admin', authMiddleware, requireRole('organizer'), requireDB, async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await pushNotification(admin._id, { title: `💬 From Organizer: ${req.user.name}`, message: req.body.message, type: 'message' });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Internal / Inventory Reversal (for Refunds) ─────────────────────────────

router.post('/revert-inventory', requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryName, quantity, amount, seatNumbers = [] } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // 1. Return tickets to pool
    const cat = event.ticketCategories.find(c => c.name === categoryName);
    if (cat) {
      cat.availableSeats = Math.min(cat.seats, (cat.availableSeats || 0) + quantity);
      if (seatNumbers.length > 0) cat.bookedSeats = (cat.bookedSeats || []).filter(s => !seatNumbers.includes(s));
    } else {
      event.availableTickets = Math.min(event.capacity, (event.availableTickets || 0) + quantity);
    }

    // 2. Adjust revenue metrics
    event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - quantity);
    event.totalRevenue = Math.max(0, (event.totalRevenue || 0) - amount);
    event.commissionCollected = Math.max(0, (event.commissionCollected || 0) - Math.round(amount * 0.20));

    await event.save();
    await cacheDel(`event:${event._id}`);
    await cacheDelPattern('events:list:*');

    res.json({ success: true, message: 'Inventory reverted successfully' });
  } catch (err) { next(err); }
});

export default router;
