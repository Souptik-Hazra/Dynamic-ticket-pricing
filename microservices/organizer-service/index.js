import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB, registerProcessHandlers, tuneExpressServer } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import crypto from 'crypto';
import axios from 'axios';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import User from '../shared/models/User.js';
import {
  notify,
  wsNotifyUser,
  wsTicketSold,
  wsPriceUpdate,
  sendEmailTemplate,
  cacheSet,
  cacheGet,
  cacheDel,
  cacheDelPattern,
  cacheLock,
  cacheUnlock,
  CACHE_KEYS,
} from '../shared/interservice.js';

dotenv.config();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'organizer-service', ts: new Date().toISOString() })
);

connectDB('OrganizerService');

// ── Dynamic price helper (Fallback) ──────────────────────────────────────────
const getDynamicPriceFallback = (category, event) => {
  if (!event) return 0;
  
  const basePrice = category ? (Number(category.price) || 0) : (Number(event.basePrice) || 0);
  if (basePrice <= 0) return 0;

  const categories = event.ticketCategories || [];
  const totalCap   = categories.reduce((s, c) => s + (Number(c.seats) || 0), 0) || Number(event.capacity) || 1;
  const totalSold  = categories.reduce((s, c) => s + (Number(c.seats) || 0) - (Number(c.availableSeats) ?? (Number(c.seats) || 0)), 0);
  
  const occupancy    = Math.max(0, Math.min(1, totalSold / totalCap));
  const multiplier   = Math.max(0.9, Math.min(2.0, 1 + occupancy * 0.5));
  const maxPrice     = category?.maxPrice || (basePrice * 2);
  const maxMult      = maxPrice / basePrice;
  
  return Math.round(basePrice * Math.min(multiplier, maxMult));
};

/**
 * predictMLPrice — extract features and call ML service
 */
async function predictMLPrice(category, event) {
  try {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : start;
    
    // Feature extraction
    const totalCap = (event.ticketCategories || []).reduce((s, c) => s + (Number(c.seats) || 0), 0) || Number(event.capacity) || 1;
    const totalSold = (event.ticketCategories || []).reduce((s, c) => s + (Number(c.seats) || 0) - (Number(c.availableSeats) ?? (Number(c.seats) || 0)), 0);
    
    const daysUntil = Math.max(0, (start - now) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
    
    // Season mapping (1:Winter, 2:Spring, 3:Summer, 4:Fall)
    const month = start.getMonth() + 1;
    const season = (month >= 3 && month <= 5) ? 2 : (month >= 6 && month <= 8) ? 3 : (month >= 9 && month <= 11) ? 4 : 1;

    const payload = {
      capacity: totalCap,
      tickets_sold: totalSold,
      base_price: category ? category.price : event.basePrice,
      days_until_event: daysUntil,
      event_duration: duration,
      event_popularity: event.eventPopularity || 0.5,
      venue_tier: event.venueTier || 2,
      artist_tier: event.artistTier || 3,
      is_holiday: event.isHoliday ? 1 : 0,
      category: event.category || 'other'
    };

    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, payload, { timeout: 2000 });
    
    // Adjust predicted generic price to this specific category's base ratio
    const basePrice = category ? category.price : event.basePrice;
    const eventBase = event.basePrice || basePrice;
    const ratio = basePrice / eventBase;
    
    let finalPrice = data.predicted_price * ratio;
    
    // Safety bounds
    const maxPrice = category?.maxPrice || (basePrice * 2.5);
    finalPrice = Math.max(basePrice * 0.8, Math.min(maxPrice, finalPrice));
    
    return isNaN(finalPrice) ? getDynamicPriceFallback(category, event) : Math.round(finalPrice);
  } catch (err) {
    console.error(`[OrganizerService] ML Prediction failed for event ${event._id}:`, err.message);
    return getDynamicPriceFallback(category, event);
  }
}

/* ── Health ───────────────────────────────────────────────────────────────── */
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'organizer-service', ts: new Date().toISOString() })
);

/* ── Organizer Router ─────────────────────────────────────────────────────── */
const organizerRouter = express.Router(); // Keep for legacy if needed by other components, but we'll use app for main routes

// Health check within router
organizerRouter.get('/health', (req, res) => {
  console.log('[OrganizerRouter] Health check reached');
  res.json({ status: 'ok', message: 'Organizer router is active' });
});

/**
 * GET /api/organizers/stats
 */
app.get('/api/organizers/stats', jwtMiddleware, requireDB, async (req, res, next) => {
  if (req.user.role === 'staff') {
    return res.status(403).json({ error: 'Entry staff are not authorized to view statistics.' });
  }
  try {
    const events = await Event.find({ organizerId: req.user.id });
    const eventIds = events.map(e => e._id);
    
    const [ticketAgg, recentTickets] = await Promise.all([
      Ticket.aggregate([
        { $match: { eventId: { $in: eventIds }, status: 'confirmed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalTickets: { $sum: '$quantity' } } }
      ]),
      Ticket.find({ eventId: { $in: eventIds } })
        .populate('eventId', 'name')
        .sort({ purchaseDate: -1 })
        .limit(10)
    ]);

    const { totalRevenue = 0, totalTickets = 0 } = ticketAgg[0] || {};

    res.json({
      stats: {
        totalRevenue,
        totalTickets,
        totalEvents: events.length,
        averageRevenuePerEvent: events.length ? (totalRevenue / events.length).toFixed(2) : 0
      },
      recentTransactions: recentTickets.map(t => ({
        _id: t._id,
        event: { name: t.eventId?.name || 'Unknown' },
        customerName: t.customerName,
        quantity: t.quantity,
        totalAmount: t.totalAmount,
        purchaseDate: t.purchaseDate
      }))
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/organizers/events
 */
app.get('/api/organizers/events', jwtMiddleware, requireDB, async (req, res, next) => {
  if (req.user.role === 'staff') return res.status(403).json({ error: 'Entry staff unauthorized.' });
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ createdAt: -1 });
    res.json({ events });
  } catch (err) { next(err); }
});

/**
 * GET /api/organizers/tickets
 */
app.get('/api/organizers/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  if (req.user.role === 'staff') return res.status(403).json({ error: 'Entry staff unauthorized.' });
  try {
    const events = await Event.find({ organizerId: req.user.id }).select('_id');
    const eventIds = events.map(e => e._id);
    const tickets = await Ticket.find({ eventId: { $in: eventIds } })
      .populate('eventId', 'name venue startDate')
      .sort({ purchaseDate: -1 });
    res.json({ tickets });
  } catch (err) { next(err); }
});

/**
 * POST /api/organizers/broadcast
 */
app.post('/api/organizers/broadcast', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { eventId, title, message } = req.body;
    if (!eventId || !title || !message) return res.status(400).json({ error: 'Event ID, title and message required' });
    const event = await Event.findOne({ _id: eventId, organizerId: req.user.id });
    if (!event) return res.status(403).json({ error: 'You do not have permission to message attendees of this event' });
    const tickets = await Ticket.find({ eventId, status: 'confirmed' }).select('userId');
    const userIds = [...new Set(tickets.map(t => t.userId))];
    userIds.forEach(uid => {
      notify(uid, 'message', `🎭 ${event.name}: ${title}`, message);
      wsNotifyUser(uid, 'message', `🎭 Organizer Message`, title);
    });
    res.json({ success: true, count: userIds.length, message: `Message sent to ${userIds.length} attendees.` });
  } catch (err) { next(err); }
});

/**
 * POST /api/organizers/message-admin
 */
app.post('/api/organizers/message-admin', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message required' });
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (!admins.length) return res.status(404).json({ error: 'No admin found' });
    admins.forEach(admin => {
      notify(admin._id, 'message', `🏢 Help: ${title} (from ${req.user.id})`, `Organizer ${req.user.name} asks: ${message}`);
      wsNotifyUser(admin._id, 'message', `🏢 Support Request`, title);
    });
    res.json({ success: true, message: 'Message sent to platform administrator.' });
  } catch (err) { next(err); }
});

/* ── Public Event Routes ─────────────────────────────────────────────────── */

app.get('/api/events', async (req, res, next) => {
  try {
    const cacheKey = CACHE_KEYS.EVENT_LIST(JSON.stringify(req.query));
    const cached   = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status)   filter.status   = req.query.status;
    const events = await Event.find(filter).sort({ startDate: 1 });

    cacheSet(cacheKey, events, 60);
    res.json(events);
  } catch (err) { next(err); }
});

app.get('/api/events/:id', async (req, res, next) => {
  try {
    const cacheKey = CACHE_KEYS.EVENT_DETAIL(req.params.id);
    const cached   = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    cacheSet(cacheKey, event, 30);
    res.json(event);
  } catch (err) { next(err); }
});

app.get('/api/events/:id/dynamic-prices', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const prices = {};
    if (event.ticketCategories?.length > 0) {
      // Use concurrent prediction for all categories
      const predPromises = event.ticketCategories.map(async (cat) => {
        prices[cat.name] = await predictMLPrice(cat, event);
      });
      await Promise.all(predPromises);
    } else {
      prices['standard'] = await predictMLPrice(null, event);
    }

    const totalCap  = event.ticketCategories?.reduce((s, c) => s + Number(c.seats), 0) || 0;
    const totalSold = event.ticketCategories?.reduce((s, c) => s + (Number(c.seats) - (Number(c.availableSeats) ?? Number(c.seats))), 0) || 0;
    const occupancyRate = totalCap ? ((totalSold / totalCap) * 100).toFixed(1) : '0.0';

    wsPriceUpdate(req.params.id, prices, occupancyRate);
    res.json({ prices, occupancyRate, source: 'ml-model' });
  } catch (err) { next(err); }
});

/* ── Protected Event CRUD ────────────────────────────────────────────────── */

app.post('/api/events', jwtMiddleware, requireDB, async (req, res, next) => {
  console.log('[OrganizerService] Creating event with body:', JSON.stringify(req.body, null, 2));
  try {
    const eventData = { ...req.body, organizerId: req.user.id };
    const event = await Event.create(eventData);
    console.log('[OrganizerService] Event created successfully:', event._id);
    
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.status(201).json({ event });
  } catch (err) {
    console.error('[OrganizerService] Event creation error:', err.message, err.stack);
    next(err);
  }
});

app.put('/api/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    cacheDel(CACHE_KEYS.EVENT_DETAIL(req.params.id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.json({ event });
  } catch (err) { next(err); }
});

// ── Ticket reversion ───────────────────────────────────────────────────────
app.post('/api/tickets/revert', requireDB, async (req, res, next) => {
  const { eventId, categoryName: catName, quantity: qty, amount: amt } = req.body;
  try {
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: eventId, 'ticketCategories.name': catName?.toLowerCase() },
      { $inc: { 'ticketCategories.$.availableSeats': qty, ticketsSold: -qty, totalRevenue: -amt } },
      { new: true }
    );

    if (!updatedEvent) {
      await Event.findByIdAndUpdate(eventId, {
        $inc: { availableTickets: qty, ticketsSold: -qty, totalRevenue: -amt }
      });
    }

    wsTicketSold(eventId, catName, (updatedEvent?.ticketCategories?.find(c => c.name === catName)?.availableSeats) || 0);
    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.json({ success: true, message: 'Inventory and revenue reverted' });
  } catch (err) { next(err); }
});

// POST /api/tickets — buy a ticket with Distributed Lock protection
app.post('/api/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  const { eventId, categoryName: catName, quantity: qty, customerName, customerEmail, pricePerTicket } = req.body;
  
  if (!eventId || !qty || qty < 1) {
    return res.status(400).json({ error: 'Invalid purchase request' });
  }

  // ── Distributed Locking ────────────────────────────────────────────────
  const lockKey = `lock:purchase:${eventId}:${catName || 'any'}`;
  const { success: lockAcquired, token: lockToken } = await cacheLock(lockKey, 15000, 10);

  if (!lockAcquired) {
    return res.status(503).json({ error: 'System busy. Please try again in a few seconds.' });
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // 1. Find the specific category (case-insensitive)
    const category = event.ticketCategories?.find(c => c.name === catName?.toLowerCase());
    if (catName && !category) return res.status(400).json({ error: 'Invalid ticket category' });

    // 2. Check availability
    if (category) {
      if (category.availableSeats < qty) return res.status(400).json({ error: 'Not enough seats available' });
    } else {
      const avail = (event.capacity || 0) - (event.ticketsSold || 0);
      if (avail < qty) return res.status(400).json({ error: 'Sold out' });
    }

    // 3. Update inventory & revenue (Constrained update would also work, but we use Lock)
    const amount = (pricePerTicket || await predictMLPrice(category, event)) * qty;
    
    if (category) {
      await Event.findOneAndUpdate(
        { _id: eventId, 'ticketCategories.name': catName?.toLowerCase() },
        { 
          $inc: { 
            'ticketCategories.$.availableSeats': -qty, 
            ticketsSold: qty,
            totalRevenue: amount
          } 
        }
      );
    } else {
      await Event.findByIdAndUpdate(
        eventId,
        { $inc: { ticketsSold: qty, totalRevenue: amount } }
      );
    }

    // 4. Force sync financial fields (triggers pre-save hook)
    const finalEvent = await Event.findById(eventId);
    await finalEvent.save();

    // 5. Generate unique QR codes for EACH individual ticket
    const tickets = [];
    for (let i = 0; i < qty; i++) {
        const qrToken = crypto.randomBytes(32).toString('hex');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const qrUrl   = `${frontendUrl}/verify?token=${qrToken}`;
        
        let qrCode = '';
        try {
          const qrResponse = await axios.post(`${process.env.QR_SERVICE_URL || 'http://localhost:4014'}/api/qr/generate`, {
            text: qrUrl,
            logoPath: '../../public/default-event.png',
            position: 'center'
          }, { timeout: 5000 });
          qrCode = qrResponse.data.qrCode;
        } catch (qrErr) {
          console.error(`[OrganizerService] QR generation failed for ticket ${i+1}:`, qrErr.message);
        }

        const ticket = await Ticket.create({
          eventId,
          userId: req.user.id,
          categoryName: catName || 'standard',
          customerName: qty > 1 ? `${customerName} (Ticket ${i + 1})` : customerName,
          customerEmail,
          pricePerTicket: pricePerTicket || await predictMLPrice(category, event),
          quantity: 1, // Individual ticket
          totalAmount: pricePerTicket || await predictMLPrice(category, event),
          status: 'confirmed',
          qrToken,
          qrCode,
          expiresAt: event.startDate
        });
        tickets.push(ticket);
    }

    // 6. side effects
    const newAvail = (category 
      ? finalEvent.ticketCategories.find(c => c.name === catName)?.availableSeats 
      : (finalEvent.capacity - finalEvent.ticketsSold)) || 0;
      
    wsTicketSold(eventId, catName || 'standard', newAvail);
    notify(req.user.id, 'ticket_purchase', '🎟️ Tickets Purchased', `You successfully bought ${qty} ticket(s) for ${event.name}`);
    sendEmailTemplate(customerEmail, 'TICKET_CONFIRMATION', {
      customerName,
      eventName: event.name,
      quantity: qty,
      totalAmount: amount,
      bookingReference: tickets[0].bookingReference // Use first one as ref
    });

    // Invalidate caches
    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.status(201).json({ success: true, tickets });
  } catch (err) {
    console.error('[OrganizerService] Purchase error:', err);
    next(err);
  } finally {
    // ── ALWAYS Release the Lock ──────────────────────────────────────────
    cacheUnlock(lockKey, lockToken);
  }
});

// GET /api/tickets — user's own tickets
app.get('/api/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.id })
      .populate('eventId', 'name venue startDate endDate category image')
      .sort({ purchaseDate: -1 });
    res.json(tickets);
  } catch (err) { next(err); }
});

// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_ORGANIZER_SERVICE || 4013;
const server = app.listen(PORT, () => console.log(`Organizer Service running on port ${PORT}`));
registerProcessHandlers(server, 'OrganizerService');
tuneExpressServer(server);
