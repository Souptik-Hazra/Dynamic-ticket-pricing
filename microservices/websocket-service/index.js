import express from 'express';
import { tuneExpressServer, registerProcessHandlers } from '../shared/db.js';
import { requestLogger } from '../shared/logger.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger('WebSocketService'));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'websocket-service', ts: new Date().toISOString() })
);

const server = createServer(app);
const wss    = new WebSocketServer({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'SouptikHazraSecretKey';

// ── Connected client registry ─────────────────────────────────────────────
// Map<userId, Set<WebSocket>>  — supports multiple tabs per user
const clients = new Map();

const broadcast = (payload) => {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
};

const sendToUser = (userId, payload) => {
  const userSockets = clients.get(String(userId));
  if (!userSockets) return;
  const msg = JSON.stringify(payload);
  userSockets.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
};

// ── WebSocket connection handler ───────────────────────────────────────────
function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  // Client sends { type:'auth', token:'<jwt>' } as first message
  let userId = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'auth') {
        // Authenticate the connection
        try {
          const decoded = jwt.verify(msg.token, JWT_SECRET);
          userId = String(decoded.id);
          if (!clients.has(userId)) clients.set(userId, new Set());
          clients.get(userId).add(ws);
          ws.send(JSON.stringify({ type: 'auth_success', userId }));
          console.log(`WS: user ${userId} connected`);
        } catch {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
        }
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    if (userId) {
      const set = clients.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(userId);
      }
    }
  });

  ws.on('error', (err) => console.error('WS error:', err.message));
});

// ── Heartbeat Interval ─────────────────────────────────────────────────────
// Check every 30 seconds for dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('WS: Terminating dead connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({
    status:           'ok',
    service:          'websocket-service',
    connectedClients: wss.clients.size,
    ts:               new Date().toISOString(),
  })
);

// ── Internal REST endpoints (called by other services to push events) ─────

// Broadcast price update to all connected clients
app.post('/api/ws/price-update', (req, res) => {
  const { eventId, prices, occupancyRate } = req.body;
  broadcast({ type: 'price_update', eventId, prices, occupancyRate, ts: Date.now() });
  res.json({ message: 'Broadcast sent', clients: wss.clients.size });
});

// Send notification to a specific user
app.post('/api/ws/notify-user', (req, res) => {
  const { userId, type, title, message, meta } = req.body;
  sendToUser(userId, { type: 'notification', notificationType: type, title, message, meta, ts: Date.now() });
  res.json({ message: 'Sent to user', userId });
});

// Broadcast attendance update (live entry stats)
app.post('/api/ws/attendance-update', (req, res) => {
  const { eventId, scannedCount, totalSold } = req.body;
  broadcast({ type: 'attendance_update', eventId, scannedCount, totalSold, ts: Date.now() });
  res.json({ message: 'Broadcast sent' });
});

// Broadcast ticket-sold event (causes seat count to update on all browsers)
app.post('/api/ws/ticket-sold', (req, res) => {
  const { eventId, categoryName, remainingSeats } = req.body;
  broadcast({ type: 'ticket_sold', eventId, categoryName, remainingSeats, ts: Date.now() });
  res.json({ message: 'Broadcast sent' });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT_WEBSOCKET_SERVICE || 4010;
server.listen(PORT, () => console.log(`WebSocket Service running on port ${PORT}`));
