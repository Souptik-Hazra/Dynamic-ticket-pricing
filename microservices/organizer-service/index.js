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

/* ── Health ───────────────────────────────────────────────────────────────── */
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'organizer-service', ts: new Date().toISOString() })
);

/* ── Organizer Router ─────────────────────────────────────────────────────── */
const organizerRouter = express.Router();

// Health check within router
organizerRouter.get('/health', (req, res) => {
  console.log('[OrganizerRouter] Health check reached');
  res.json({ status: 'ok', message: 'Organizer router is active' });
});

// GET /api/organizers/stats
organizerRouter.get('/stats', jwtMiddleware, requireDB, async (req, res, next) => {
  console.log(`[OrganizerRouter] Fetching stats for organizer: ${req.user.id}`);
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
  } catch (err) {
    console.error('[OrganizerRouter] Stats error:', err);
    next(err);
  }
});

// GET /api/organizers/events
organizerRouter.get('/events', jwtMiddleware, requireDB, async (req, res, next) => {
  console.log(`[OrganizerRouter] Fetching events for organizer: ${req.user.id}`);
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ createdAt: -1 });
    res.json({ events });
  } catch (err) {
    console.error('[OrganizerRouter] Events fetch error:', err);
    next(err);
  }
});

// GET /api/organizers/tickets
organizerRouter.get('/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  console.log(`[OrganizerRouter] Fetching tickets for organizer: ${req.user.id}`);
  try {
    const events = await Event.find({ organizerId: req.user.id }).select('_id');
    const eventIds = events.map(e => e._id);
    
    const tickets = await Ticket.find({ eventId: { $in: eventIds } })
      .populate('eventId', 'name venue startDate')
      .sort({ purchaseDate: -1 });
      
    res.json({ tickets });
  } catch (err) {
    console.error('[OrganizerRouter] Tickets fetch error:', err);
    next(err);
  }
});

app.use('/api/organizers', organizerRouter);

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
      event.ticketCategories.forEach((cat) => {
        prices[cat.name] = getDynamicPrice(cat, event);
      });
    }

    const totalCap  = event.ticketCategories?.reduce((s, c) => s + Number(c.seats), 0) || 0;
    const totalSold = event.ticketCategories?.reduce((s, c) => s + (Number(c.seats) - (Number(c.availableSeats) ?? Number(c.seats))), 0) || 0;
    const occupancyRate = totalCap ? ((totalSold / totalCap) * 100).toFixed(1) : '0.0';

    wsPriceUpdate(req.params.id, prices, occupancyRate);
    res.json({ prices, occupancyRate });
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
      { _id: eventId, 'ticketCategories.name': catName },
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

// POST /api/tickets — buy a ticket
app.post('/api/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  const { eventId, categoryName: catName, quantity: qty, customerName, customerEmail, pricePerTicket } = req.body;
  
  if (!eventId || !qty || qty < 1) {
    return res.status(400).json({ error: 'Invalid purchase request' });
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // 1. Find the specific category
    const category = event.ticketCategories?.find(c => c.name === catName);
    if (catName && !category) return res.status(400).json({ error: 'Invalid ticket category' });

    // 2. Check availability
    if (category) {
      if (category.availableSeats < qty) return res.status(400).json({ error: 'Not enough seats available' });
    } else {
      const avail = (event.capacity || 0) - (event.ticketsSold || 0);
      if (avail < qty) return res.status(400).json({ error: 'Sold out' });
    }

    // 3. Update inventory & revenue (Atomic)
    const amount = (pricePerTicket || getDynamicPrice(category, event)) * qty;
    
    if (category) {
      await Event.findOneAndUpdate(
        { _id: eventId, 'ticketCategories.name': catName },
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

    // 5. Create Ticket
    const ticket = await Ticket.create({
      eventId,
      userId: req.user.id,
      categoryName: catName || 'standard',
      customerName,
      customerEmail,
      pricePerTicket: pricePerTicket || getDynamicPrice(category, event),
      quantity: qty,
      totalAmount: amount,
      status: 'confirmed'
    });

    // 6. side effects
    const newAvail = (category 
      ? finalEvent.ticketCategories.find(c => c.name === catName)?.availableSeats 
      : (finalEvent.capacity - finalEvent.ticketsSold)) || 0;
      
    wsTicketSold(eventId, catName || 'standard', newAvail);
    notify(req.user.id, 'Ticket Purchased', `You successfully bought ${qty} ticket(s) for ${event.name}`);
    sendEmailTemplate(customerEmail, 'TICKET_CONFIRMATION', {
      customerName,
      eventName: event.name,
      quantity: qty,
      totalAmount: amount,
      bookingReference: ticket.bookingReference
    });

    // Invalidate caches
    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.status(201).json({ success: true, ticket });
  } catch (err) {
    console.error('[OrganizerService] Purchase error:', err);
    next(err);
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

const PORT   = process.env.PORT_ORGANIZER_SERVICE || process.env.PORT || 4013;
const server = app.listen(PORT, () => console.log(`Organizer Service running on port ${PORT}`));
registerProcessHandlers(server, 'OrganizerService');
