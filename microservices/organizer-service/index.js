import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB, registerProcessHandlers, tuneExpressServer, startSessionWithFallback } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import { requestLogger } from '../shared/logger.js';
import crypto from 'crypto';
import axios from 'axios';
import mongoose from 'mongoose';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import User from '../shared/models/User.js';
import PriceLog from '../shared/models/PriceLog.js';
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
app.use(requestLogger('OrganizerService'));

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

// ── Circuit Breaker State ────────────────────────────────────────────────
let mlConsecutiveFailures = 0;
let mlCircuitOpenUntil    = 0;
const ML_CIRCUIT_THRESHOLD = 3;
const ML_CIRCUIT_COOLDOWN  = 30000; // 30 seconds

/**
 * predictMLPrice — extract features and call ML service
 */
async function predictMLPrice(category, event) {
  // 1. Check Circuit Breaker
  if (Date.now() < mlCircuitOpenUntil) {
    console.warn(`[Network Expert] ⚡ Circuit Open: ML Service unreachable. Using fallback for event ${event._id}`);
    return getDynamicPriceFallback(category, event);
  }

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
    
    // ── Price Safety Wall (Smoothing) ─────────────────────────────────────────
    // Prevents "Price Shock" by capping the change to +/- 20% of the last price
    const lastPrice = category?.lastCalculatedPrice || basePrice;
    const maxChange = lastPrice * 0.20; 
    
    if (finalPrice > lastPrice + maxChange) {
      console.log(`[OrganizerService] ⚠️ Price Surge Capped (+20%): ₹${lastPrice} → ₹${finalPrice} (Capped at ₹${Math.round(lastPrice + maxChange)})`);
      finalPrice = lastPrice + maxChange;
    } else if (finalPrice < lastPrice - maxChange) {
      console.log(`[OrganizerService] ⚠️ Price Drop Capped (-20%): ₹${lastPrice} → ₹${finalPrice} (Capped at ₹${Math.round(lastPrice - maxChange)})`);
      finalPrice = lastPrice - maxChange;
    }

    const maxPrice = basePrice * 10;
    finalPrice = Math.max(basePrice * 0.8, Math.min(maxPrice, finalPrice));
    
    // ── ML Telemetry & Feedback Loop Logging ─────────────────────────────────
    // Log asynchronously to build the training dataset for Phase 2
    const shadowPrice = (data.predicted_price * ratio) * 1.15; // Challenger: +15% aggressive surge testing
    
    PriceLog.create({
      eventId: event._id,
      categoryId: category?._id,
      features: {
        capacity: event.capacity || 0,
        ticketsSold: event.ticketsSold || 0,
        basePrice: basePrice,
        daysUntilEvent: Math.max(0, Math.floor((new Date(event.startDate) - new Date()) / (1000 * 60 * 60 * 24))),
        eventPopularity: event.eventPopularity || 0.5,
        occupancyRate: event.capacity > 0 ? (event.ticketsSold / event.capacity) : 0
      },
      predictedPrice: Math.round(data.predicted_price * ratio),
      shadowPrice: Math.round(shadowPrice),
      actualPrice: Math.round(finalPrice)
    }).catch(e => console.error('[OrganizerService] ML Telemetry logging failed:', e.message));

    // Update the last price in the document for the next cycle
    if (category) {
      category.lastCalculatedPrice = Math.round(finalPrice);
    }

    // Reset circuit on success
    mlConsecutiveFailures = 0;
    return isNaN(finalPrice) ? getDynamicPriceFallback(category, event) : Math.round(finalPrice);
  } catch (err) {
    mlConsecutiveFailures++;
    console.error(`[Network Expert] ML Prediction failed (${mlConsecutiveFailures}/${ML_CIRCUIT_THRESHOLD}):`, err.message);
    
    if (mlConsecutiveFailures >= ML_CIRCUIT_THRESHOLD) {
      mlCircuitOpenUntil = Date.now() + ML_CIRCUIT_COOLDOWN;
      console.error(`[Network Expert] 🚨 ML Circuit OPENED for ${ML_CIRCUIT_COOLDOWN/1000}s due to consecutive failures.`);
    }

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
    const bypassCache = req.query.nocache === 'true';
    const cacheKey    = CACHE_KEYS.EVENT_LIST(JSON.stringify(req.query));
    
    if (!bypassCache) {
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);
    } else {
      console.log(`[OrganizerService] ⚡ Bypassing cache for events list (Direct DB hit)`);
    }

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status)   filter.status   = req.query.status;
    const events = await Event.find(filter).sort({ startDate: 1 });

    if (!bypassCache) cacheSet(cacheKey, events, 60);
    res.json(events);
  } catch (err) { next(err); }
});

app.get('/api/events/:id', async (req, res, next) => {
  try {
    const bypassCache = req.query.nocache === 'true';
    const cacheKey    = CACHE_KEYS.EVENT_DETAIL(req.params.id);
    
    if (!bypassCache) {
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (!bypassCache) cacheSet(cacheKey, event, 30);
    res.json(event);
  } catch (err) { next(err); }
});

const inFlightPriceRequests = new Map();
// Anti-Price-Hunting: track per IP+eventId to allow parallel event loads
// (loading an events page fires N simultaneous requests from the same IP)
const userInferenceHistory = new Map(); // key: `${ip}:${eventId}` -> { count, firstHit }

app.get('/api/events/:id/dynamic-prices', async (req, res, next) => {
  const eventId = req.params.id;
  const userIp = req.headers['x-forwarded-for'] || req.ip;
  
  try {
    // 1. Anti-Price Hunting Guard (per IP+event, not per IP globally)
    // A single page load fires N parallel requests – one per event – so we must
    // track PER-EVENT to avoid throttling legitimate parallel loads.
    const now = Date.now();
    const huntingKey = `${userIp}:${eventId}`;
    let history = userInferenceHistory.get(huntingKey) || { count: 0, firstHit: now };
    
    if (now - history.firstHit > 60000) {
      history = { count: 1, firstHit: now };
    } else {
      history.count++;
    }
    userInferenceHistory.set(huntingKey, history);

    const isHunting = history.count > 15; // 15 requests/min per event is enough to stop scrapers

    // 2. Check Redis Cache First (15-second "Price Freeze")
    const cacheKey = CACHE_KEYS.EVENT_PRICES(eventId);
    const cachedData = await cacheGet(cacheKey);
    
    if (cachedData || isHunting) {
      if (isHunting && !cachedData) console.warn(`[Security] Price Hunting detected from IP: ${userIp}. Throttling to fallback.`);
      
      const payload = cachedData || { prices: { standard: 500 }, occupancyRate: '0.0' }; // fallback
      wsPriceUpdate(eventId, payload.prices, payload.occupancyRate);
      return res.json({ 
        ...payload, 
        source: cachedData ? 'cache' : 'security-throttle',
        throttled: isHunting 
      });
    }

    // 3. Request Collapsing (Deduplication)
    // If multiple users request prices for the same event at once, only 1 ML call is made.
    if (inFlightPriceRequests.has(eventId)) {
      console.log(`[OrganizerService] 🔀 Collapsing concurrent price request for event ${eventId}`);
      const result = await inFlightPriceRequests.get(eventId);
      return res.json({ ...result, source: 'collapsed-request' });
    }

    // 3. Define the actual calculation logic
    const calculatePrices = (async () => {
      const event = await Event.findById(eventId);
      if (!event) throw new Error('Event not found');

      const prices = {};
      if (event.ticketCategories?.length > 0) {
        // Use concurrent prediction for all categories
        const predPromises = event.ticketCategories.map(async (cat) => {
          prices[cat.name] = await predictMLPrice(cat, event);
        });
        await Promise.all(predPromises);
        
        // Persist the smoothed lastCalculatedPrice to the DB (Background)
        event.save().catch(e => console.error('[OrganizerService] Background price sync failed:', e.message));
      } else {
        prices['standard'] = await predictMLPrice(null, event);
      }
      
      const totalCap  = event.ticketCategories?.reduce((s, c) => s + Number(c.seats), 0) || 0;
      const totalSold = event.ticketCategories?.reduce((s, c) => s + (Number(c.seats) - (Number(c.availableSeats) ?? Number(c.seats))), 0) || 0;
      const occupancyRate = totalCap ? ((totalSold / totalCap) * 100).toFixed(1) : '0.0';

      const responseData = { prices, occupancyRate };
      
      // Update ALL clients via WebSocket
      wsPriceUpdate(eventId, prices, occupancyRate);

      // Cache for 15 seconds to prevent spamming
      cacheSet(cacheKey, responseData, 15);
      
      return responseData;
    })();

    // Register the promise for others to join
    inFlightPriceRequests.set(eventId, calculatePrices);

    try {
      const finalResult = await calculatePrices;
      res.json({ ...finalResult, source: 'ml-model' });
    } finally {
      // Always cleanup the map once done
      inFlightPriceRequests.delete(eventId);
    }
  } catch (err) {
    if (err.message === 'Event not found') return res.status(404).json({ error: err.message });
    next(err);
  }
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
  const { eventId, categoryName: catName, quantity: qty, customerName, customerEmail, pricePerTicket, username_real } = req.body;
  console.log('[OrganizerService] Purchase request payload:', {
    eventId, categoryName: catName, quantity: qty, customerName, customerEmail, pricePerTicket, honeypot: !!username_real
  });
  
  // 🛡️ API EXPERT: Idempotency Protection
  const idempKey = req.headers['x-idempotency-key'];
  if (idempKey) {
      const cachedResult = await cacheGet(`idemp:${idempKey}`);
      if (cachedResult) {
        console.log(`[API Expert] ♻️ Idempotency Hit for key ${idempKey}. Returning cached response.`);
        return res.json(cachedResult);
      }
  }
  if (!eventId || !qty || qty < 1) {
    return res.status(400).json({ error: 'Invalid purchase request' });
  }

  // 🛡️ BOT DEFENCE: Honeypot Check
  if (username_real) {
      console.warn(`[BotShield] 🚩 Honeypot triggered by user ${req.user.id}`);
      return res.status(403).json({ error: 'SECURITY_VIOLATION', message: 'Automated activity detected.' });
  }

  // 🛡️ BOT DEFENCE: Cooldown Check (30 seconds)
  const user = await User.findById(req.user.id);
  if (user && user.lastPurchaseAt) {
      const secondsSinceLast = (Date.now() - new Date(user.lastPurchaseAt).getTime()) / 1000;
      if (secondsSinceLast < 30) {
          console.warn(`[BotShield] 🚩 Purchase cooldown in effect for user ${req.user.id}`);
          return res.status(429).json({ 
              error: 'ABUSE_PREVENTION', 
              message: `Please wait ${Math.ceil(30 - secondsSinceLast)}s before buying more tickets.` 
          });
      }
  }

  // ── Distributed Locking ────────────────────────────────────────────────
  const lockKey = `lock:purchase:${eventId}:${catName || 'any'}`;
  const { success: lockAcquired, token: lockToken } = await cacheLock(lockKey, 15000, 10);

  if (!lockAcquired) {
    return res.status(503).json({ error: 'System busy. Please try again in a few seconds.' });
  }

  // ── Start Transaction Session (uses shared helper with fallback) ─
  let session = null;
  let usingTransactions = false;
  try {
    const result = await startSessionWithFallback();
    session = result.session;
    usingTransactions = result.usingTransactions;
  } catch (e) {
    console.warn('[OrganizerService] startSessionWithFallback failed:', e.message);
    session = null;
    usingTransactions = false;
  }

  // Wrap the core purchase flow so we can retry without transactions if needed
  const doPurchase = async (useSession, activeSession) => {
    const s = useSession ? activeSession : null;
    const event = s ? await Event.findById(eventId).session(s) : await Event.findById(eventId);
    if (!event) throw new Error('Event not found');

    const category = event.ticketCategories?.find(c => c.name === catName?.toLowerCase());
    if (catName && !category) return res.status(400).json({ error: 'Invalid ticket category' });

    if (category) {
      if (category.availableSeats < qty) return res.status(400).json({ error: 'Not enough seats available' });
    } else {
      const avail = (event.capacity || 0) - (event.ticketsSold || 0);
      if (avail < qty) return res.status(400).json({ error: 'Sold out' });
    }

    const finalPricePerTicket = pricePerTicket || await predictMLPrice(category, event);
    const amount = finalPricePerTicket * qty;

    let updatedEvent;
    if (category) {
      updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, 'ticketCategories.name': catName?.toLowerCase(), 'ticketCategories.availableSeats': { $gte: qty } },
        { $inc: { 'ticketCategories.$.availableSeats': -qty, ticketsSold: qty, totalRevenue: amount } },
        { new: true, ...(s ? { session: s } : {}) }
      );
    } else {
      updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, availableTickets: { $gte: qty } },
        { $inc: { ticketsSold: qty, totalRevenue: amount } },
        { new: true, ...(s ? { session: s } : {}) }
      );
    }

    if (!updatedEvent) throw new Error('Tickets sold out during processing');

    await (s ? updatedEvent.save({ session: s }) : updatedEvent.save());

    if (s) {
      await User.findByIdAndUpdate(req.user.id, { $set: { lastPurchaseAt: new Date() } }).session(s);
    } else {
      await User.findByIdAndUpdate(req.user.id, { $set: { lastPurchaseAt: new Date() } });
    }

    const tickets = [];
    for (let i = 0; i < qty; i++) {
      const qrToken = crypto.randomBytes(32).toString('hex');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const qrUrl = `${frontendUrl}/verify?token=${qrToken}`;
      let qrCode = '';
      try {
        const qrResponse = await axios.post(`${process.env.QR_SERVICE_URL || 'http://localhost:4014'}/api/qr/generate`, { text: qrUrl, logoPath: '../../public/default-event.png', position: 'center' }, { timeout: 5000 });
        qrCode = qrResponse.data.qrCode;
      } catch (qrErr) {
        console.error(`[OrganizerService] QR generation failed for ticket ${i + 1}:`, qrErr.message);
      }

      const ticketDoc = new Ticket({
        eventId,
        userId: req.user.id,
        categoryName: catName || 'standard',
        customerName: qty > 1 ? `${customerName} (Ticket ${i + 1})` : customerName,
        customerEmail,
        pricePerTicket: finalPricePerTicket,
        quantity: 1,
        totalAmount: finalPricePerTicket,
        status: 'confirmed',
        qrToken,
        qrCode,
        expiresAt: updatedEvent.startDate
      });
      if (s) await ticketDoc.save({ session: s }); else await ticketDoc.save();
      tickets.push(ticketDoc);
    }

    return { tickets, updatedEvent, amount, category };
  };

  try {
    let result;
    try {
      result = await doPurchase(!!session, session);
    } catch (errInner) {
      // If the failure is due to transactions not being allowed, retry without session
      const msg = String(errInner?.message || '').toLowerCase();
      if (msg.includes('transaction numbers are only allowed') || msg.includes('transactions are only allowed')) {
        console.warn('[OrganizerService] Transaction error detected, retrying purchase without transactions');
        if (session) {
          try { session.endSession(); } catch (e) {}
          session = null;
          usingTransactions = false;
        }
        result = await doPurchase(false, null);
      } else {
        throw errInner;
      }
    }

    // If we got here, purchase succeeded
    const { tickets, updatedEvent, amount, category } = result;

    if (session && usingTransactions) {
      try { await session.commitTransaction(); } catch (e) { console.warn('[OrganizerService] Commit failed:', e.message); }
      try { session.endSession(); } catch (e) {}
    }

    const responseData = { success: true, message: 'Ticket purchased successfully', tickets, metadata: { traceId: req.headers['x-request-id'] || 'no-trace' } };

    if (idempKey) await cacheSet(`idemp:${idempKey}`, responseData, 86400);

    const newAvail = (category ? updatedEvent.ticketCategories.find(c => c.name === catName?.toLowerCase())?.availableSeats : (updatedEvent.capacity - updatedEvent.ticketsSold)) || 0;
    wsTicketSold(eventId, catName || 'standard', newAvail);
    notify(req.user.id, 'ticket_purchase', '🎟️ Tickets Purchased', `You successfully bought ${qty} ticket(s) for ${updatedEvent.name}`);
    sendEmailTemplate(customerEmail, 'TICKET_CONFIRMATION', { customerName, eventName: updatedEvent.name, quantity: qty, totalAmount: amount, bookingReference: tickets[0].bookingReference }).catch(e => console.error('Email send failed:', e.message));

    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.status(201).json({ success: true, tickets });

    PriceLog.findOneAndUpdate({ eventId, categoryId: category?._id }, { $set: { isSale: true, userId: req.user.id } }, { sort: { timestamp: -1 } }).catch(e => console.error('[OrganizerService] Feedback Loop update failed:', e.message));
  } catch (err) {
    // Ensure session abort/cleanup
    try {
      if (session && typeof session.inTransaction === 'function' && session.inTransaction()) await session.abortTransaction();
    } catch (e) { console.warn('[OrganizerService] Error aborting transaction:', e.message); }
    if (session) try { session.endSession(); } catch (e) {}

    console.error('[OrganizerService] Purchase error:', err);
    // Sanitize DB-specific errors before sending to client
    if (String(err?.message || '').toLowerCase().includes('transaction numbers are only allowed')) {
      return res.status(500).json({ error: 'Purchase failed due to database configuration. Please contact the administrator.' });
    }
    return res.status(err.message === 'Event not found' ? 404 : 400).json({ error: err.message || 'Purchase process failed' });
  } finally {
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
