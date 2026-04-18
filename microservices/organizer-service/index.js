import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

connectDB('OrganizerService');

// ── Dynamic price helper ───────────────────────────────────────────────────
const getDynamicPrice = (category, event) => {
  const totalCap  = event.ticketCategories.reduce((s, c) => s + c.seats, 0) || event.capacity || 1;
  const totalSold = event.ticketCategories.reduce((s, c) => s + (c.seats - (c.availableSeats ?? c.seats)), 0);
  const occupancy    = totalSold / totalCap;
  const multiplier   = Math.max(0.9, Math.min(2.0, 1 + occupancy * 0.5));
  const maxMult      = category.maxPrice ? category.maxPrice / category.price : 2;
  return Math.round(category.price * Math.min(multiplier, maxMult));
};

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'organizer-service', ts: new Date().toISOString() })
);

/* ── Public event routes ─────────────────────────────────────────────────── */

app.get('/api/events', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status)   filter.status   = req.query.status;
    const events = await Event.find(filter).sort({ startDate: 1 });
    res.json(events);
  } catch (err) { next(err); }
});

app.get('/api/events/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) { next(err); } // CastError (bad ObjectId) → errorHandler → 400
});

app.get('/api/events/:id/dynamic-prices', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const prices = {};
    event.ticketCategories.forEach((cat) => { prices[cat.name] = getDynamicPrice(cat, event); });

    const totalCap  = event.ticketCategories.reduce((s, c) => s + c.seats, 0);
    const totalSold = event.ticketCategories.reduce((s, c) => s + (c.seats - (c.availableSeats ?? c.seats)), 0);
    const occupancyRate = totalCap ? ((totalSold / totalCap) * 100).toFixed(1) : '0.0';

    res.json({ prices, occupancyRate });
  } catch (err) { next(err); }
});

/* ── Protected event CRUD ────────────────────────────────────────────────── */

app.post('/api/events', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.create({ ...req.body, organizerId: req.user.id });
    res.status(201).json({ event });
  } catch (err) { next(err); } // ValidationError, duplicate key → errorHandler
});

app.put('/api/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err) { next(err); }
});

app.delete('/api/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted successfully' });
  } catch (err) { next(err); }
});

/* ── Ticket routes ───────────────────────────────────────────────────────── */

// POST /api/tickets — ATOMIC purchase (race-condition safe)
app.post('/api/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryId, categoryName, customerName, customerEmail, quantity, pricePerTicket } = req.body;

    if (!eventId || !customerName || !customerEmail || !quantity || pricePerTicket == null)
      return res.status(400).json({ error: 'eventId, customerName, customerEmail, quantity and pricePerTicket are required' });

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 15)
      return res.status(400).json({ error: 'quantity must be a whole number between 1 and 15' });

    const eventCheck = await Event.findById(eventId).select('status ticketCategories capacity availableTickets name');
    if (!eventCheck) return res.status(404).json({ error: 'Event not found' });
    if (eventCheck.status === 'cancelled' || eventCheck.status === 'completed')
      return res.status(400).json({ error: `Cannot buy tickets for a ${eventCheck.status} event` });

    const totalAmount = Number(pricePerTicket) * qty;
    let updatedEvent;
    let resolvedCategoryName = (categoryName || 'standard').toLowerCase();

    if (eventCheck.ticketCategories?.length > 0) {
      // Atomic $inc — prevents overselling under concurrent load
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
    }

    const ticket = await Ticket.create({
      eventId, userId: req.user.id,
      categoryId: categoryId || undefined,
      categoryName: resolvedCategoryName,
      customerName, customerEmail,
      pricePerTicket: Number(pricePerTicket), quantity: qty, totalAmount,
    });

    res.status(201).json({ ticket });
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

const PORT   = process.env.PORT || 4013;
const server = app.listen(PORT, () => console.log(`Organizer Service running on port ${PORT}`));
registerProcessHandlers(server, 'OrganizerService');
