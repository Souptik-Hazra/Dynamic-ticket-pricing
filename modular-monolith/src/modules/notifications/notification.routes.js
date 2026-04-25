import express from 'express';
import jwt from 'jsonwebtoken';
import Notification from '../../shared/models/Notification.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware from '../../middleware/auth.js';
import bus from '../../shared/InternalBus.js';

const router = express.Router();
const clients = new Map(); // userId -> Set<ws>

// ── Event Bus Subscriptions ───────────────────────────────────────────────

bus.subscribe('payment.success', (payload) => {
  const { userId, amount, eventName } = payload;
  pushNotification(userId, { 
    title: '💳 Payment Successful', 
    message: `₹${amount} paid for ${eventName}`, 
    type: 'ticket_purchase' 
  });
});

bus.subscribe('ticket.created', (payload) => {
  const { userId, count, eventName } = payload;
  pushNotification(userId, { 
    title: '🎫 Tickets Secured', 
    message: `${count} tickets generated for ${eventName}`, 
    type: 'ticket_purchase' 
  });
});

bus.subscribe('system.alert', (payload) => {
  const { userId, title, message } = payload;
  pushNotification(userId, { title: `🛡️ ${title}`, message, type: 'system' });
});

// ── Shared Push Helpers ───────────────────────────────────────────────────

import { wsSentinel, verifyWsToken } from '../../middleware/wsSentinel.js';

export const broadcast = (payload) => {
  const msg = JSON.stringify({ ...payload, ts: Date.now() });
  
  for (const [uid, set] of clients.entries()) {
    set.forEach(ws => {
      if (ws.readyState === 1) {
        // Algorithmic Throttling: High botScore users receive delayed updates
        if (ws.throttleDelay > 0) {
          setTimeout(() => {
            if (ws.readyState === 1) ws.send(msg);
          }, ws.throttleDelay);
        } else {
          ws.send(msg);
        }
      }
    });
  }
};

export const pushNotification = async (userId, data) => {
  try {
    // 1. Persist to DB
    await Notification.create({ userId, ...data });

    // 2. Push via WS
    const userSockets = clients.get(String(userId));
    if (userSockets) {
      const msg = JSON.stringify({ type: 'notification', ...data, ts: Date.now() });
      userSockets.forEach(ws => { 
        if (ws.readyState === 1) ws.send(msg); 
      });
    }
  } catch (err) {
    console.error('[NotificationsModule] Push failed:', err.message);
  }
};

// ── Specialized Broadcast Helpers (Legacy Parity) ──

export const wsPriceUpdate = (eventId, prices, occupancyRate) => {
  broadcast({ type: 'price_update', eventId, prices, occupancyRate });
};

export const wsTicketSold = (eventId, categoryName, remainingSeats) => {
  broadcast({ type: 'ticket_sold', eventId, categoryName, remainingSeats });
};

export const wsAttendanceUpdate = (eventId, scannedCount, totalSold) => {
  broadcast({ type: 'attendance_update', eventId, scannedCount, totalSold });
};

// ── WebSocket Handler ─────────────────────────────────────────────────────

export const handleWsConnection = (ws, req) => {
  ws.isAlive = true;
  wsSentinel(ws, req); // Apply IP limits and Auth timeouts
  
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      
      if (msg.type === 'auth') {
        const success = await verifyWsToken(ws, msg.token);
        if (success) {
          const userId = ws.userId;
          if (!clients.has(userId)) clients.set(userId, new Set());
          clients.get(userId).add(ws);
          ws.send(JSON.stringify({ 
            type: 'auth_success', 
            userId, 
            throttle: ws.throttleDelay 
          }));
          console.log(`[WS] 🛡️ Secure connection established for user ${userId} (Throttle: ${ws.throttleDelay}ms)`);
        } else {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Verification failed' }));
        }
      }
      
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch (err) {
      console.error('[WS] Message error:', err.message);
    }
  });

  ws.on('close', () => {
    if (ws.userId && clients.has(ws.userId)) {
      clients.get(ws.userId).delete(ws);
      if (clients.get(ws.userId).size === 0) clients.delete(ws.userId);
    }
  });
};

// Heartbeat for server.js to use
export const startWsHeartbeat = (wss) => {
    return setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
};

// ── REST Routes ────────────────────────────────────────────────────────────

router.get('/', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ userId: req.user.id, read: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

router.put('/read-all', authMiddleware, requireDB, async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

router.put('/:id/read', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: n });
  } catch (err) { next(err); }
});

router.delete('/:id', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) { next(err); }
});

// ── Internal / Legacy Bridge ───────────────────────────────────────────────

router.post('/', requireDB, async (req, res, next) => {
  try {
    const { userId, type, title, message, meta } = req.body;
    await pushNotification(userId, { type, title, message, meta });
    res.status(201).json({ message: 'Notification queued' });
  } catch (err) { next(err); }
});

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'notifications-module', timestamp: new Date().toISOString() }));

export default router;
