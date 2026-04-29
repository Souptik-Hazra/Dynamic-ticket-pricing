import { wsSentinel, verifyWsToken } from '../../middleware/wsSentinel.js';
import { broadcastGlobal, broadcastToRoomGlobal } from '../../shared/utils/broadcaster.js';
import { getRedisClient } from '../../shared/utils/cache.js';
import { logError, createLogger } from '../../shared/utils/logger.js';

/**
 * WebSocket Manager for Notifications
 * 
 * Handles client connections, heartbeats, and throttled broadcasting.
 * Supports ROOMS for efficient topic-based updates.
 */

export const clients = new Map(); // userId -> Set<ws>
export const rooms = new Map();   // roomId -> Set<ws>

export const broadcast = (payload) => {
  broadcastGlobal(payload);
};

export const broadcastToRoom = (roomId, payload) => {
  broadcastToRoomGlobal(roomId, payload);
};

/**
 * 💓 Live Pulse Broadcast (Phase 6)
 * Periodically sends the "Viewing" count to all users in a room.
 * OS Expert Note: Optimized for clusters to prevent duplicate broadcasts.
 */
export const broadcastLivePulse = async () => {
  const redis = getRedisClient();
  if (!redis) return;

  const workerId = process.pid;

  for (const [roomId, roomClients] of rooms.entries()) {
    const localCount = roomClients.size;

    // 🕸️ Expert Step: Cluster-Aware Pulse (Phase 16)
    // Update this worker's count for this room in Redis
    await redis.hset(`rooms:viewer_counts:${roomId}`, workerId, localCount);
    await redis.expire(`rooms:viewer_counts:${roomId}`, 60);

    // To prevent duplicate broadcasts in a cluster, only the "leader" for this room 
    // (worker with the lowest PID among those having active clients in this room) 
    // will aggregate and broadcast.
    const allWorkers = await redis.hkeys(`rooms:viewer_counts:${roomId}`);
    const leaderId = Math.min(...allWorkers.map(id => parseInt(id)));

    if (workerId === leaderId) {
      // Fetch total count across all workers
      const allCounts = await redis.hvals(`rooms:viewer_counts:${roomId}`);
      const totalCount = allCounts.reduce((sum, c) => sum + parseInt(c || 0), 0);

      if (totalCount > 0) {
        broadcastToRoom(roomId, { 
          type: 'live_pulse', 
          roomId, 
          viewerCount: totalCount + Math.floor(Math.random() * 3) 
        });
      }
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

  const logger = createLogger('WS');
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
      logError('WS', 'Message error', err);
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
