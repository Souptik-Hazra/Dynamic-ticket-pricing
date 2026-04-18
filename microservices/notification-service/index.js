import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('NotificationService');

// ── Schema ─────────────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    type:    { type: String, enum: ['ticket_purchase', 'event_update', 'price_change', 'subscription', 'system', 'refund'], default: 'system' },
    title:   { type: String, required: true, trim: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },
    meta:    { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'notification-service', ts: new Date().toISOString() })
);

// POST — create notification (internal service-to-service, no auth required)
app.post('/api/notifications', requireDB, async (req, res, next) => {
  try {
    const { userId, type, title, message, meta } = req.body;
    if (!title)   return res.status(400).json({ error: 'title is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });
    const notification = await Notification.create({ userId, type, title, message, meta });
    res.status(201).json({ notification });
  } catch (err) { next(err); }
});

// GET — current user's notifications
app.get('/api/notifications', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ userId: req.user.id, read: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// PUT — mark all read
app.put('/api/notifications/read-all', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

// PUT — mark one read
app.put('/api/notifications/:id/read', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: n });
  } catch (err) { next(err); } // CastError → 400
});

// DELETE — remove one notification
app.delete('/api/notifications/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_NOTIFICATION_SERVICE || process.env.PORT || 4009;
const server = app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));
registerProcessHandlers(server, 'NotificationService');
