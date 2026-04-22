import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB, registerProcessHandlers, tuneExpressServer } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import { requestLogger } from '../shared/logger.js';
import Ticket from '../shared/models/Ticket.js';
import Event from '../shared/models/Event.js';
import { wsAttendanceUpdate, notify, wsNotifyUser } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger('ScannerService'));

connectDB('ScannerService');

// POST /api/scanner/verify — Verify a ticket via QR token
app.post('/api/scanner/verify', jwtMiddleware, requireDB, async (req, res, next) => {
  // Trim token and strip any accidental extra query params
  // e.g. if QR was scanned as full URL: /verify?token=abc123&other=xyz
  let { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  token = token.trim();
  // If scanner extracted from URL and extra params got included (e.g. "abc123&foo=bar"), strip them
  if (token.includes('&')) token = token.split('&')[0];
  if (token.includes('?')) token = token.split('?').pop(); // handle raw URL paste

  try {
    // ── Atomic check-and-mark using findOneAndUpdate to prevent race conditions
    // Two simultaneous scans of the same ticket must not both succeed.
    // findOne + save is NOT atomic — use atomic findOneAndUpdate instead.
    const ticket = await Ticket.findOneAndUpdate(
      { qrToken: token, isUsed: false, status: 'confirmed' },
      { $set: { isUsed: true } },
      { new: true }
    ).populate('eventId');

    // If nothing matched, find out why for a precise error message
    if (!ticket) {
      const existing = await Ticket.findOne({ qrToken: token });
      if (!existing) return res.status(404).json({ error: 'Invalid Ticket' });
      if (existing.isUsed) return res.status(400).json({ error: 'Already Used' });
      if (existing.status === 'cancelled') return res.status(400).json({ error: 'Invalid Ticket (Cancelled/Refunded)' });
      if (existing.status === 'refunded') return res.status(400).json({ error: 'Invalid Ticket (Cancelled/Refunded)' });
      return res.status(400).json({ error: 'Invalid Ticket' });
    }

    if (!ticket.eventId) {
      // Roll back — we marked it used but can't verify it
      await Ticket.findByIdAndUpdate(ticket._id, { $set: { isUsed: false } });
      return res.status(404).json({ error: 'Associated Event not found' });
    }

    // Access Control: admin, staff, or any organizer role
    const isAuthorized =
      req.user.role === 'admin' ||
      req.user.role === 'staff' ||
      req.user.role === 'organizer' ||
      (ticket.eventId.organizerId && ticket.eventId.organizerId.toString() === req.user.id);

    if (!isAuthorized) {
      // Roll back the mark-as-used since this scan is unauthorised
      await Ticket.findByIdAndUpdate(ticket._id, { $set: { isUsed: false } });
      console.warn(`[ScannerService] Unauthorized scan attempt: user ${req.user.id} (role: ${req.user.role}) for event ${ticket.eventId._id}`);
      return res.status(403).json({ error: 'Not authorized to verify tickets for this event' });
    }

    // Check event is not cancelled
    if (ticket.eventId.status === 'cancelled') {
      await Ticket.findByIdAndUpdate(ticket._id, { $set: { isUsed: false } });
      return res.status(400).json({ error: 'Event has been cancelled' });
    }

    if (ticket.expiresAt && ticket.expiresAt < new Date()) {
      await Ticket.findByIdAndUpdate(ticket._id, { $set: { isUsed: false } });
      return res.status(400).json({ error: 'Expired' });
    }

    // ── Live Attendance Analytics ──────────────────────────────────────────
    // Calculate live stats for this event
    const [scannedCount, totalSold] = await Promise.all([
      Ticket.countDocuments({ eventId: ticket.eventId._id, isUsed: true, status: 'confirmed' }),
      Ticket.countDocuments({ eventId: ticket.eventId._id, status: 'confirmed' })
    ]);

    wsAttendanceUpdate(ticket.eventId._id, scannedCount, totalSold);

    // ── Inter-service: notify attendee ──
    notify(ticket.userId, 'event_update', '🎭 Welcome!', `Your ticket for "${ticket.eventId.name}" has been scanned. enjoy the event!`);
    wsNotifyUser(ticket.userId, 'event_update', '🎭 Check-in Successful', `Welcome to ${ticket.eventId.name}!`);

    res.json({ 
      success: true, 
      message: 'Valid Entry', 
      customerName: ticket.customerName, 
      eventName: ticket.eventId.name,
      stats: { scannedCount, totalSold }
    });
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'scanner-service', ts: new Date().toISOString() })
);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT_SCANNER_SERVICE || 4015;
const server = app.listen(PORT, () => console.log(`Scanner Service running on port ${PORT}`));
registerProcessHandlers(server, 'ScannerService');
tuneExpressServer(server);