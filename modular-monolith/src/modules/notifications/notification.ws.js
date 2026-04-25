import { wsSentinel, verifyWsToken } from '../../middleware/wsSentinel.js';

/**
 * WebSocket Manager for Notifications
 * 
 * Handles client connections, heartbeats, and throttled broadcasting.
 * Supports ROOMS for efficient topic-based updates.
 */

export const clients = new Map(); // userId -> Set<ws>
export const rooms = new Map();   // roomId -> Set<ws>

export const broadcast = (payload) => {
  const msg = JSON.stringify({ ...payload, ts: Date.now() });
  
  for (const [uid, set] of clients.entries()) {
    set.forEach(ws => deliverMessage(ws, msg));
  }
};

export const broadcastToRoom = (roomId, payload) => {
  const msg = JSON.stringify({ ...payload, ts: Date.now() });
  const room = rooms.get(String(roomId));
  
  if (room) {
    room.forEach(ws => deliverMessage(ws, msg));
  }
};

/**
 * 💓 Live Pulse Broadcast (Phase 6)
 * Periodically sends the "Viewing" count to all users in a room.
 */
export const broadcastLivePulse = () => {
  for (const [roomId, roomClients] of rooms.entries()) {
    const viewerCount = roomClients.size;
    if (viewerCount > 0) {
      broadcastToRoom(roomId, { 
        type: 'live_pulse', 
        roomId, 
        viewerCount: viewerCount + Math.floor(Math.random() * 5) // Slight random fluctuation for 'liveness'
      });
    }
  }
};

const deliverMessage = (ws, msg) => {
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
};

export const handleWsConnection = (ws, req) => {
  ws.isAlive = true;
  ws.rooms = new Set();
  wsSentinel(ws, req); 
  
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      
      // 1. Authentication
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
        } else {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Verification failed' }));
        }
      }
      
      // 2. Room Management
      if (msg.type === 'subscribe') {
        const roomId = String(msg.room);
        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId).add(ws);
        ws.rooms.add(roomId);
        ws.send(JSON.stringify({ type: 'subscribed', room: roomId }));
      }

      if (msg.type === 'unsubscribe') {
        const roomId = String(msg.room);
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(ws);
          ws.rooms.delete(roomId);
        }
        ws.send(JSON.stringify({ type: 'unsubscribed', room: roomId }));
      }
      
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch (err) {
      console.error('[WS] Message error:', err.message);
    }
  });

  ws.on('close', () => {
    // Cleanup User mappings
    if (ws.userId && clients.has(ws.userId)) {
      clients.get(ws.userId).delete(ws);
      if (clients.get(ws.userId).size === 0) clients.delete(ws.userId);
    }
    // Cleanup Room mappings
    ws.rooms.forEach(roomId => {
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(ws);
        if (rooms.get(roomId).size === 0) rooms.delete(roomId);
      }
    });
  });
};

export const startWsHeartbeat = (wss) => {
  return setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        // Scavenger Step: Physical Pruning (Phase 12)
        if (ws.userId && clients.has(ws.userId)) {
          clients.get(ws.userId).delete(ws);
          if (clients.get(ws.userId).size === 0) clients.delete(ws.userId);
        }
        ws.rooms.forEach(roomId => {
          if (rooms.has(roomId)) {
            rooms.get(roomId).delete(ws);
            if (rooms.get(roomId).size === 0) rooms.delete(roomId);
          }
        });
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
};

export default { clients, rooms, broadcast, broadcastToRoom, handleWsConnection, startWsHeartbeat };
