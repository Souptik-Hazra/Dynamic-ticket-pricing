import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import QRCode from 'qrcode';
import Ticket from '../../shared/models/Ticket.js';
import Event from '../../shared/models/Event.js';
import User from '../../shared/models/User.js';
import PriceLog from '../../shared/models/PriceLog.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { cacheDel, cacheDelPattern } from '../../shared/cache.js';
import { broadcast, pushNotification } from '../notifications/notification.routes.js';
import { verifyTemporalProof } from '../../shared/temporalAuthServer.js';
import sharp from 'sharp';
import { predictMLPrice, createBookingReference, createTicketQrToken } from '../../shared/utils.js';

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

// ── Security State ─────────────────────────────────────────────────────────
const sessionNonces = new Map(); // sessionId -> { nonce, ts }

// Price validation tolerances
const PRICE_ABS_TOLERANCE = 1.0; 
const PRICE_REL_TOLERANCE = 0.02;

// ── Helpers ───────────────────────────────────────────────────────────────


function normalizeTicketToken(value) {
  let token = String(value || '').trim();
  if (!token) return '';
  try {
    const parsed = JSON.parse(token);
    if (parsed && typeof parsed === 'object') token = String(parsed.token || parsed.qrToken || parsed.ticketToken || token).trim();
  } catch {}
  try {
    const url = new URL(token, 'https://scanner.local');
    const extracted = url.searchParams.get('token') || url.searchParams.get('qrToken') || url.searchParams.get('ticketToken');
    if (extracted) return extracted.trim();
  } catch {}
  if (token.includes('token=')) {
    const params = new URLSearchParams(token.startsWith('?') ? token.slice(1) : token);
    const extracted = params.get('token') || params.get('qrToken') || params.get('ticketToken');
    if (extracted) return extracted.trim();
  }
  return token.split('&')[0].trim();
}
// ML prediction uses centralized helper from shared utils

async function generateBrandedQR(text, logoPath, position = 'center') {
  try {
    const qrBuffer = await QRCode.toBuffer(text, { errorCorrectionLevel: 'H', margin: 1, width: 600, color: { dark: '#000000', light: '#ffffff' } });
    if (!logoPath) return `data:image/png;base64,${qrBuffer.toString('base64')}`;
    const qrMetadata = await sharp(qrBuffer).metadata();
    const logoSize = Math.floor(qrMetadata.width * 0.18);
    const maskSize = Math.floor(logoSize * 1.15);
    const maskBuffer = await sharp({ create: { width: maskSize, height: maskSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
    const logoInnerBuffer = await sharp(logoPath).resize(logoSize, logoSize, { fit: 'contain' }).toBuffer();
    const brandedLogoBuffer = await sharp(maskBuffer).composite([{ input: logoInnerBuffer, gravity: 'center' }]).toBuffer();
    let compositeOptions = { input: brandedLogoBuffer };
    switch (position) {
      case 'top-left': compositeOptions.top = 20; compositeOptions.left = 20; break;
      case 'top-right': compositeOptions.top = 20; compositeOptions.left = qrMetadata.width - logoSize - 20; break;
      case 'bottom-left': compositeOptions.top = qrMetadata.height - logoSize - 20; compositeOptions.left = 20; break;
      case 'bottom-right': compositeOptions.top = qrMetadata.height - logoSize - 20; compositeOptions.left = qrMetadata.width - logoSize - 20; break;
      case 'center': default: compositeOptions.gravity = 'center';
    }
    const finalImageBuffer = await sharp(qrBuffer).composite([compositeOptions]).toBuffer();
    return `data:image/png;base64,${finalImageBuffer.toString('base64')}`;
  } catch (error) { return null; }
}

// ── Routes ──

router.get('/security/nonce', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sessionId = crypto.randomUUID();
  sessionNonces.set(sessionId, { nonce, ts: Date.now() });
  res.json({ nonce, sessionId });
});

router.post('/', authMiddleware, requireDB, async (req, res, next) => {
  const { 
    eventId, categoryId, categoryName, quantity, selectedSeats = [], 
    customerName, customerEmail, pricePerTicket,
    sessionId, humanityProof, temporalProof, cognitive_score,
    username_real // 🍯 Honeypot field
  } = req.body;

  // 0. 🛡️ BOT DETECTION (Honeypot Sentinel)
  if (username_real) {
    console.warn(`[Sentinel] 🚩 Bot purchase attempt blocked (Honeypot triggered).`);
    return res.status(403).json({ error: 'SECURITY_PROTOCOL_BREACH', message: 'Automated activity detected.' });
  }

  // 1. 🛡️ IRONCLAD SECURITY Speed-Bumps
  if (!humanityProof || !temporalProof || !verifyTemporalProof(humanityProof, temporalProof)) {
    return res.status(403).json({ error: 'INVALID_TEMPORAL_PROOF', message: 'Temporal security check failed.' });
  }

  if (!sessionId || !sessionNonces.has(sessionId)) {
    return res.status(403).json({ error: 'INVALID_SESSION', message: 'Security nonce expired or missing.' });
  }
  sessionNonces.delete(sessionId);

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const cat = (event.ticketCategories || []).find(c => (categoryId && String(c._id) === String(categoryId)) || c.name === categoryName) || null;
    const ticketCount = Math.max(1, Number(quantity) || (Array.isArray(selectedSeats) ? selectedSeats.length : 1));
    
    // 2. ⚖️ PRICE VALIDATION (Neural Auditor)
    const score = typeof cognitive_score === 'number' ? cognitive_score : 1.0;
    const serverPrice = await predictMLPrice(cat, event, score);
    const clientPrice = Number(pricePerTicket) || 0;

    const absDiff = Math.abs(clientPrice - serverPrice);
    const relDiff = serverPrice > 0 ? absDiff / serverPrice : 0;

    if (absDiff > PRICE_ABS_TOLERANCE && relDiff > PRICE_REL_TOLERANCE) {
      return res.status(409).json({ error: 'PRICE_MISMATCH', message: 'Price validation failed. The market has shifted.', serverPrice });
    }

    const finalPrice = serverPrice;

    // 3. 📝 LOG PRICE ACTION
    await PriceLog.create({
      eventId: event._id,
      categoryId: cat?._id,
      features: {
        capacity: event.capacity,
        ticketsSold: event.ticketsSold,
        basePrice: cat ? cat.price : event.basePrice,
        daysUntilEvent: Math.max(0, Math.ceil((new Date(event.startDate) - new Date()) / (1000 * 60 * 60 * 24))),
        eventPopularity: event.eventPopularity || 0.5
      },
      predictedPrice: serverPrice,
      actualPrice: finalPrice,
      isSale: true,
      userId: req.user.id
    }).catch(() => null);

    // 4. 📦 INVENTORY TRANSACTION
    let filter = { _id: event._id, status: { $ne: 'cancelled' } };
    let update = { $inc: { availableTickets: -ticketCount, ticketsSold: ticketCount } };

    if (cat) {
      filter['ticketCategories._id'] = cat._id;
      filter['ticketCategories.availableSeats'] = { $gte: ticketCount };
      update.$inc['ticketCategories.$.availableSeats'] = -ticketCount;
      if (selectedSeats.length > 0) update.$addToSet = { 'ticketCategories.$.bookedSeats': { $each: selectedSeats } };
    } else {
      filter.availableTickets = { $gte: ticketCount };
    }

    const updatedEvent = await Event.findOneAndUpdate(filter, update, { new: true });
    if (!updatedEvent) return res.status(400).json({ error: 'Tickets sold out or seats unavailable' });

    await cacheDel(`event:${event._id}`);
    await cacheDelPattern('events:list:*');

    const ticketsToCreate = [];
    const finalName = customerName || req.user.name || 'Guest';
    const finalEmail = customerEmail || req.user.email;
    const bookingRef = createBookingReference();

    for (let i = 0; i < ticketCount; i++) {
      const qrToken = createTicketQrToken();
      ticketsToCreate.push({
        eventId, userId: req.user.id, categoryId: cat?._id, categoryName: cat?.name || categoryName || 'standard',
        seatNumber: selectedSeats[i], customerName: finalName, customerEmail: finalEmail, quantity: 1,
        pricePerTicket: finalPrice, totalAmount: finalPrice, status: 'pending_payment', qrToken,
        bookingReference: bookingRef
      });
    }

    const tickets = await Ticket.insertMany(ticketsToCreate);
    broadcast({ type: 'ticket_sold', eventId, categoryName: cat?.name || 'standard', remainingSeats: updatedEvent.availableTickets });
    res.status(201).json({ success: true, tickets });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.id }).populate('eventId', 'name venue startDate').sort({ purchaseDate: -1 });
    res.json(tickets);
  } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('eventId', 'name venue startDate');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (String(ticket.userId) !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    res.json(ticket);
  } catch (err) { next(err); }
});

router.post('/verify', authMiddleware, requireDB, async (req, res, next) => {
  let { token } = req.body;
  token = normalizeTicketToken(token);
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    // 1. Atomic Check-and-Mark
    const ticket = await Ticket.findOneAndUpdate(
      { qrToken: token, isUsed: false, status: 'confirmed' },
      { $set: { isUsed: true } },
      { new: true }
    ).populate('eventId');

    if (!ticket) {
      const existing = await Ticket.findOne({ qrToken: token });
      if (!existing) return res.status(404).json({ error: 'Invalid Ticket' });
      if (existing.isUsed) return res.status(400).json({ error: 'Already Used' });
      if (['cancelled', 'refunded'].includes(existing.status)) return res.status(400).json({ error: 'Invalid Ticket (Cancelled/Refunded)' });
      return res.status(400).json({ error: 'Invalid Ticket' });
    }

    // 2. Authorization Check (Admin, Staff, or Organizer)
    const isAuthorized = ['admin', 'staff', 'organizer'].includes(req.user.role) || 
                         (ticket.eventId.organizerId && String(ticket.eventId.organizerId) === req.user.id);

    if (!isAuthorized) {
      await Ticket.findByIdAndUpdate(ticket._id, { $set: { isUsed: false } }); // Rollback
      return res.status(403).json({ error: 'Not authorized to verify for this event' });
    }

    // 3. Live Analytics & Notifications
    const [scannedCount, totalSold] = await Promise.all([
      Ticket.countDocuments({ eventId: ticket.eventId._id, isUsed: true, status: 'confirmed' }),
      Ticket.countDocuments({ eventId: ticket.eventId._id, status: 'confirmed' })
    ]);

    broadcast({ type: 'attendance_update', eventId: ticket.eventId._id, scannedCount, totalSold });
    await pushNotification(ticket.userId, { title: '🎭 Welcome!', message: `Your ticket for ${ticket.eventId.name} has been scanned.`, type: 'event_update' });

    res.json({ success: true, message: 'Valid Entry', customerName: ticket.customerName, eventName: ticket.eventId.name, stats: { scannedCount, totalSold } });
  } catch (err) { next(err); }
});

router.post('/generate', authMiddleware, async (req, res) => {
  const { text, logoPath, position } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const qrCode = await generateBrandedQR(text, logoPath, position);
    res.json({ qrCode });
  } catch { res.status(500).json({ error: 'Failed to generate QR' }); }
});

// ── Reclamation Sentinel (Self-Healing Inventory) ──────────────────────────
// Periodically purges tickets stuck in 'pending_payment' and returns inventory.
setInterval(async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleTickets = await Ticket.find({
      status: 'pending_payment',
      purchaseDate: { $lt: tenMinutesAgo }
    });

    if (staleTickets.length === 0) return;

    console.log(`[Sentinel] 🧹 Reclaiming ${staleTickets.length} abandoned tickets...`);

    // Group by event and category to minimize DB hits
    const groups = staleTickets.reduce((acc, t) => {
      const key = `${t.eventId}_${t.categoryName}`;
      if (!acc[key]) acc[key] = { eventId: t.eventId, categoryName: t.categoryName, qty: 0, seats: [] };
      acc[key].qty += 1;
      if (t.seatNumber) acc[key].seats.push(t.seatNumber);
      return acc;
    }, {});

    for (const group of Object.values(groups)) {
      const event = await Event.findById(group.eventId);
      if (!event) continue;

      const cat = event.ticketCategories.find(c => c.name === group.categoryName);
      if (cat) {
        cat.availableSeats = Math.min(cat.seats, (cat.availableSeats || 0) + group.qty);
        if (group.seats.length > 0) {
          cat.bookedSeats = (cat.bookedSeats || []).filter(s => !group.seats.includes(s));
        }
      } else {
        event.availableTickets = Math.min(event.capacity, (event.availableTickets || 0) + group.qty);
      }

      event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - group.qty);
      await event.save();
      await cacheDel(`event:${event._id}`);
    }

    await Ticket.deleteMany({ _id: { $in: staleTickets.map(t => t._id) } });
    await cacheDelPattern('events:list:*');
  } catch (err) {
    console.error('[Sentinel] 🚩 Reclamation failed:', err.message);
  }
}, 300000); // Run every 5 minutes

// ── Security Cleanup ──
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of sessionNonces.entries()) {
    if (now - data.ts > 300000) sessionNonces.delete(id);
  }
}, 60000);

export default router;
