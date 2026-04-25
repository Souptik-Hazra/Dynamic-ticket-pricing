import express from 'express';
import crypto from 'crypto';
import Ticket from '../../shared/models/Ticket.js';
import Event from '../../shared/models/Event.js';
import User from '../../shared/models/User.js';
import PriceLog from '../../shared/models/PriceLog.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../../shared/cache.js';
import { broadcast, pushNotification } from '../notifications/notification.routes.js';
import { verifyTemporalProof, createBookingReference, createTicketQrToken } from '../../shared/utils.js';
import { generateBrandedQR } from '../../shared/media.utils.js';
import { allocateInventory, revertInventory } from './ticket.service.js';
import { getCalculatedPrice, auditHumanity, notifyPurchaseToML } from '../ai/ai.service.js';
import { honeypotGuard } from '../../middleware/sentinel.middleware.js';

const router = express.Router();

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
  } catch (_e) { /* ignore invalid JSON token */ }
  try {
    const url = new URL(token, 'https://scanner.local');
    const extracted = url.searchParams.get('token') || url.searchParams.get('qrToken') || url.searchParams.get('ticketToken');
    if (extracted) return extracted.trim();
  } catch (_e) { /* ignore URL parse failures */ }
  if (token.includes('token=')) {
    const params = new URLSearchParams(token.startsWith('?') ? token.slice(1) : token);
    const extracted = params.get('token') || params.get('qrToken') || params.get('ticketToken');
    if (extracted) return extracted.trim();
  }
  return token.split('&')[0].trim();
}

// ── Routes ──

router.get('/security/nonce', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sessionId = crypto.randomUUID();
  sessionNonces.set(sessionId, { nonce, ts: Date.now() });
  res.json({ nonce, sessionId });
});

router.post('/', authMiddleware, requireDB, honeypotGuard, async (req, res, next) => {
  const { 
    eventId, categoryId, categoryName, quantity, selectedSeats = [], 
    customerName, customerEmail, pricePerTicket,
    sessionId, humanityProof, temporalProof, cognitive_score
  } = req.body;

  // 1. 🛡️ IRONCLAD SECURITY Speed-Bumps
  if (!humanityProof || !temporalProof || !verifyTemporalProof(humanityProof, temporalProof)) {
    return res.status(403).json({ error: 'INVALID_TEMPORAL_PROOF', message: 'Temporal security check failed.' });
  }

  // 1.5 🧠 BEHAVIORAL NEURAL AUDITOR (Backend Validation)
  const behavioralMetadata = req.body.behavioralMetadata || {};
  const isHuman = await auditHumanity(req.user.id, humanityProof, behavioralMetadata);
  
  if (!isHuman) {
    return res.status(403).json({ 
      error: 'BEHAVIORAL_ANOMALY', 
      message: 'Inconsistent behavioral signature detected. Please interact more naturally.' 
    });
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
    
    // 2. ⚖️ PRICE VALIDATION (Neural Auditor via AI Service)
    const score = typeof cognitive_score === 'number' ? cognitive_score : 1.0;
    const serverPrice = await getCalculatedPrice(cat, event, score);
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

    // 4. 📦 INVENTORY TRANSACTION (via Ticket Service)
    const updatedEvent = await allocateInventory(event._id, cat?._id, ticketCount, selectedSeats);
    if (!updatedEvent) return res.status(400).json({ error: 'Tickets sold out or seats unavailable' });

    const ticketsToCreate = [];
    const finalName = customerName || req.user.name || 'Guest';
    const finalEmail = customerEmail || req.user.email;
    const bookingRef = createBookingReference();

    for (let i = 0; i < ticketCount; i++) {
      const qrToken = createTicketQrToken();
      const qrData = JSON.stringify({ token: qrToken, bookingRef });
      const qrCodeImage = await generateBrandedQR(qrData, null); 

      ticketsToCreate.push({
        eventId, userId: req.user.id, categoryId: cat?._id, categoryName: cat?.name || categoryName || 'standard',
        seatNumber: selectedSeats[i], customerName: finalName, customerEmail: finalEmail, quantity: 1,
        pricePerTicket: finalPrice, totalAmount: finalPrice, status: 'pending_payment', 
        qrToken, qrCode: qrCodeImage,
        bookingReference: bookingRef
      });
    }

    const tickets = await Ticket.insertMany(ticketsToCreate);

    // 5. Asynchronous ML Notification
    notifyPurchaseToML(eventId, tickets.length);

    broadcast({ type: 'ticket_sold', eventId, categoryName: cat?.name || 'standard', remainingSeats: updatedEvent.availableTickets });
    res.status(201).json({ success: true, tickets });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const cacheKey = `user:tickets:${req.user.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const tickets = await Ticket.find({ userId: req.user.id }).populate('eventId', 'name venue startDate').sort({ purchaseDate: -1 });
    await cacheSet(cacheKey, tickets, 60); // 1 min cache
    res.json(tickets);
  } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const cacheKey = `ticket:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached && (String(cached.userId) === req.user.id || req.user.role === 'admin')) return res.json(cached);

    const ticket = await Ticket.findById(req.params.id).populate('eventId', 'name venue startDate');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (String(ticket.userId) !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    
    await cacheSet(cacheKey, ticket, 600); // 10 min cache
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

router.post('/generate', authMiddleware, requireRole('admin'), async (req, res) => {
  const { text, logoPath, position } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const qrCode = await generateBrandedQR(text, logoPath, position);
    res.json({ qrCode });
  } catch { res.status(500).json({ error: 'Failed to generate QR' }); }
});

// ── Security Cleanup ──
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of sessionNonces.entries()) {
    if (now - data.ts > 300000) sessionNonces.delete(id);
  }
}, 60000);

export default router;
