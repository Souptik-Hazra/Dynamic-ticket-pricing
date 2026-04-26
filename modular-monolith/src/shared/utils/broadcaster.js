import { getPubSub } from './cache.js';
import { clients, rooms } from '../../modules/notifications/notification.ws.js';

/**
 * 📡 Distributed Broadcaster (Phase 16)
 * 
 * Synchronizes real-time updates across all monolith worker nodes
 * using Redis Pub/Sub. This ensures that every user, regardless of
 * the server they are connected to, receives live price drops.
 */

const CHANNEL = 'fanfever:broadcast';

export const initBroadcaster = () => {
  const { sub } = getPubSub();
  if (!sub) return;

  sub.subscribe(CHANNEL, (err) => {
    if (err) console.error('❌ [Broadcaster] Subscription failed:', err.message);
    else console.log('📡 [Broadcaster] Subscribed to global sync channel');
  });

  sub.on('message', (channel, message) => {
    if (channel !== CHANNEL) return;

    try {
      const { type, roomId, userId, payload } = JSON.parse(message);
      
      if (type === 'ROOM') {
        deliverToLocalRoom(roomId, payload);
      } else if (type === 'USER') {
        deliverToLocalUser(userId, payload);
      } else {
        deliverToAllLocal(payload);
      }
    } catch (err) {
      console.error('[Broadcaster] Sync processing error:', err.message);
    }
  });
};

export const broadcastGlobal = (payload) => {
  const { pub } = getPubSub();
  if (!pub) return deliverToAllLocal(payload); // Fallback to local only

  pub.publish(CHANNEL, JSON.stringify({ type: 'ALL', payload }));
};

export const broadcastToRoomGlobal = (roomId, payload) => {
  const { pub } = getPubSub();
  if (!pub) return deliverToLocalRoom(roomId, payload);

  pub.publish(CHANNEL, JSON.stringify({ type: 'ROOM', roomId, payload }));
};

// ── Private Delivery Logic (Local Node Only) ──

function deliverToAllLocal(payload) {
  const msg = JSON.stringify({ ...payload, ts: Date.now() });
  for (const set of clients.values()) {
    set.forEach(ws => ws.send(msg));
  }
}

function deliverToLocalRoom(roomId, payload) {
  const msg = JSON.stringify({ ...payload, ts: Date.now() });
  const room = rooms.get(String(roomId));
  if (room) {
    room.forEach(ws => ws.send(msg));
  }
}

function deliverToLocalUser(userId, payload) {
  const msg = JSON.stringify({ ...payload, ts: Date.now() });
  const userClients = clients.get(String(userId));
  if (userClients) {
    userClients.forEach(ws => ws.send(msg));
  }
}

export default { initBroadcaster, broadcastGlobal, broadcastToRoomGlobal };
