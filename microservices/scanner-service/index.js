import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Ticket from '../shared/models/Ticket.js';
import Event from '../shared/models/Event.js';
import { wsAttendanceUpdate } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('ScannerService');

// POST /api/scanner/verify — Verify a ticket via QR token
app.post('/api/scanner/verify', jwtMiddleware, requireDB, async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const ticket = await Ticket.findOne({ qrToken: token }).populate('eventId');
    if (!ticket) return res.status(404).json({ error: 'Invalid Ticket' });
    if (!ticket.eventId) return res.status(404).json({ error: 'Associated Event not found' });

    // Access Control: Only the organizer, an admin, or designated staff can verify
    const isAuthorized = 
      req.user.role === 'admin' || 
      req.user.role === 'staff' || 
      (ticket.eventId.organizerId && ticket.eventId.organizerId.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to verify tickets for this event' });
    }

    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return res.status(400).json({ error: 'Invalid Ticket (Cancelled/Refunded)' });
    }

    if (ticket.isUsed) {
      return res.status(400).json({ error: 'Already Used' });
    }

    if (ticket.expiresAt && ticket.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Expired' });
    }

    // Mark as used
    ticket.isUsed = true;
    await ticket.save();

    // ── Live Attendance Analytics ──────────────────────────────────────────
    // Calculate live stats for this event
    const [scannedCount, totalSold] = await Promise.all([
      Ticket.countDocuments({ eventId: ticket.eventId._id, isUsed: true, status: 'confirmed' }),
      Ticket.countDocuments({ eventId: ticket.eventId._id, status: 'confirmed' })
    ]);

    wsAttendanceUpdate(ticket.eventId._id, scannedCount, totalSold);

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

const PORT = process.env.PORT || 4015;
const server = app.listen(PORT, () => console.log(`Scanner Service running on port ${PORT}`));
registerProcessHandlers(server, 'ScannerService');
