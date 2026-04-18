import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
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
  CACHE_KEYS,
} from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

connectDB('OrganizerService');

// ── Dynamic price helper ───────────────────────────────────────────────────
const getDynamicPrice = (category, event) => {
  if (!category || !event) return 0;
  
  const categories = event.ticketCategories || [];
  const totalCap   = categories.reduce((s, c) => s + (Number(c.seats) || 0), 0) || Number(event.capacity) || 1;
  const totalSold  = categories.reduce((s, c) => s + (Number(c.seats) || 0) - (Number(c.availableSeats) ?? (Number(c.seats) || 0)), 0);
  
  const occupancy    = Math.max(0, Math.min(1, totalSold / totalCap));
  const multiplier   = Math.max(0.9, Math.min(2.0, 1 + occupancy * 0.5));
  const basePrice    = Number(category.price) || 0;
  const maxPrice     = Number(category.maxPrice) || (basePrice * 2);
  const maxMult      = basePrice > 0 ? maxPrice / basePrice : 2;
  
  return Math.round(basePrice * Math.min(multiplier, maxMult));
};

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'organizer-service', ts: new Date().toISOString() })
);

/* ── Public event routes ────────────────────────────────────────────────── */

app.get('/api/events', async (req, res, next) => {
  try {
    const cacheKey = CACHE_KEYS.EVENT_LIST(JSON.stringify(req.query));
    const cached   = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status)   filter.status   = req.query.status;
    const events = await Event.find(filter).sort({ startDate: 1 });

    // Cache event list for 60 seconds
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
      event.ticketCategories.forEach((cat) => {
        prices[cat.name] = getDynamicPrice(cat, event);
      });
    }

    const totalCap  = event.ticketCategories?.reduce((s, c) => s + c.seats, 0) || 0;
    const totalSold = event.ticketCategories?.reduce((s, c) => s + (c.seats - (c.availableSeats ?? c.seats)), 0) || 0;
    const occupancyRate = totalCap ? ((totalSold / totalCap) * 100).toFixed(1) : '0.0';

    // Broadcast real-time price update to connected clients
    wsPriceUpdate(req.params.id, prices, occupancyRate);

    res.json({ prices, occupancyRate });
  } catch (err) { next(err); }
});

/* ── Protected event CRUD ────────────────────────────────────────────────── */

app.post('/api/events', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.create({ ...req.body, organizerId: req.user.id });
    // Invalidate ALL list versions (filtered and unfiltered)
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.status(201).json({ event });
  } catch (err) { next(err); }
});

app.put('/api/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // Invalidate details and all lists
    cacheDel(CACHE_KEYS.EVENT_DETAIL(req.params.id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.json({ event });
  } catch (err) { next(err); }
});

app.delete('/api/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Invalidate details and all lists
    cacheDel(CACHE_KEYS.EVENT_DETAIL(req.params.id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) { next(err); }
});

/* ── Ticket purchase — ATOMIC + full inter-service wiring ──────────────── */

app.post('/api/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryId, categoryName, customerName, customerEmail, quantity, pricePerTicket } = req.body;

    if (!eventId || !customerName || !customerEmail || !quantity || pricePerTicket == null)
      return res.status(400).json({ error: 'eventId, customerName, customerEmail, quantity and pricePerTicket are required' });

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 15)
      return res.status(400).json({ error: 'quantity must be a whole number between 1 and 15' });

    const eventCheck = await Event.findById(eventId).select('status ticketCategories capacity availableTickets name venue startDate');
    if (!eventCheck) return res.status(404).json({ error: 'Event not found' });
    if (eventCheck.status === 'cancelled' || eventCheck.status === 'completed')
      return res.status(400).json({ error: `Cannot buy tickets for a ${eventCheck.status} event` });

    const totalAmount = Number(pricePerTicket) * qty;
    let updatedEvent;
    let resolvedCategoryName = (categoryName || 'standard').toLowerCase();

    if (eventCheck.ticketCategories?.length > 0) {
      // ── Atomic $inc — prevents overselling under concurrent load ─────────
      const catFilter = categoryId
        ? { _id: eventId, 'ticketCategories._id': categoryId, 'ticketCategories.availableSeats': { $gte: qty } }
        : { _id: eventId, 'ticketCategories.name': resolvedCategoryName, 'ticketCategories.availableSeats': { $gte: qty } };

      updatedEvent = await Event.findOneAndUpdate(
        catFilter,
        { $inc: { 'ticketCategories.$.availableSeats': -qty, ticketsSold: qty, totalRevenue: totalAmount } },
        { new: true }
      );

      if (!updatedEvent) {
        const fresh = await Event.findById(eventId).select('ticketCategories');
        const cat   = fresh?.ticketCategories?.find(c =>
          categoryId ? c._id.toString() === categoryId : c.name === resolvedCategoryName
        );
        if (!cat) return res.status(400).json({ error: 'Ticket category not found' });
        return res.status(409).json({ error: `Only ${cat.availableSeats} seat(s) left in ${cat.name}` });
      }

      const updatedCat = updatedEvent.ticketCategories.find(c =>
        categoryId ? c._id.toString() === categoryId : c.name === resolvedCategoryName
      );
      resolvedCategoryName = updatedCat?.name || resolvedCategoryName;

      // Broadcast seat update to all connected clients (live seat counter)
      wsTicketSold(eventId, resolvedCategoryName, updatedCat?.availableSeats ?? 0);

    } else {
      updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, availableTickets: { $gte: qty } },
        { $inc: { availableTickets: -qty, ticketsSold: qty, totalRevenue: totalAmount } },
        { new: true }
      );
      if (!updatedEvent) {
        const fresh = await Event.findById(eventId).select('availableTickets');
        return res.status(409).json({ error: `Only ${fresh?.availableTickets ?? 0} ticket(s) remaining` });
      }
      // Broadcast seat update
      wsTicketSold(eventId, 'standard', updatedEvent.availableTickets ?? 0);
    }

    // ── Create ticket record ────────────────────────────────────────────────
    const ticket = await Ticket.create({
      eventId, userId: req.user.id,
      categoryId: categoryId || undefined,
      categoryName: resolvedCategoryName,
      customerName, customerEmail,
      pricePerTicket: Number(pricePerTicket), quantity: qty, totalAmount,
    });

    // Invalidate cached event and all lists (seat counts/availability changed)
    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    // ── Inter-service: notification + email (fire-and-forget) ─────────────
    const eventName = eventCheck.name;
    const eventDate = eventCheck.startDate
      ? new Date(eventCheck.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'TBA';

    // 1. Persist in-app notification
    notify(
      req.user.id,
      'ticket_purchase',
      `🎫 Booking Confirmed — ${eventName}`,
      `You've booked ${qty} ${resolvedCategoryName} ticket(s) for ₹${totalAmount}. Ref: ${ticket.bookingReference}`
    );

    // 2. Push real-time WebSocket notification to the user
    wsNotifyUser(
      req.user.id,
      'ticket_purchase',
      `🎫 Booking Confirmed!`,
      `${qty}× ${resolvedCategoryName} for ${eventName} — ₹${totalAmount}`
    );

    // 3. Send confirmation email
    sendEmailTemplate(customerEmail, 'ticket_confirmation', {
      customerName,
      eventName,
      venue:            eventCheck.venue || '',
      startDate:        eventDate,
      categoryName:     resolvedCategoryName,
      quantity:         qty,
      totalAmount,
      bookingReference: ticket.bookingReference,
    });

    res.status(201).json({ ticket });
  } catch (err) { next(err); }
});

/* ── Revert Purchase (Internal) ─────────────────────────────────────────── */
app.post('/api/tickets/revert', requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryName, quantity, amount } = req.body;
    if (!eventId || !quantity) return res.status(400).json({ error: 'Missing required fields' });

    const qty = Number(quantity);
    const amt = Number(amount) || 0;
    const catName = (categoryName || 'standard').toLowerCase();

    // Use atomic $inc to revert inventory and revenue
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: eventId, 'ticketCategories.name': catName },
      { $inc: { 'ticketCategories.$.availableSeats': qty, ticketsSold: -qty, totalRevenue: -amt } },
      { new: true }
    );

    if (!updatedEvent) {
      // Fallback for events without categories
      await Event.findByIdAndUpdate(eventId, {
        $inc: { availableTickets: qty, ticketsSold: -qty, totalRevenue: -amt }
      });
    }

    // Broadcast update and invalidate cache
    wsTicketSold(eventId, catName, (updatedEvent?.ticketCategories?.find(c => c.name === catName)?.availableSeats) || 0);
    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.json({ success: true, message: 'Inventory and revenue reverted' });
  } catch (err) { next(err); }
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

app.post('/api/organizers/register', (_req, res) =>
  res.status(301).json({ message: 'Use /api/auth/signup with role=organizer' })
);

// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_ORGANIZER_SERVICE || process.env.PORT || 4013;
const server = app.listen(PORT, () => console.log(`Organizer Service running on port ${PORT}`));
registerProcessHandlers(server, 'OrganizerService');
