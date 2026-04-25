import notificationRepo from '../repository/notification.repo.js';
import { clients, broadcastToRoom } from '../notification.ws.js';

/**
 * ⚡ Notification Service with Smart Throttling
 * 
 * Features:
 * 1. Private Notifications (Persisted + Real-time)
 * 2. Room-based Broadcasting (Event updates)
 * 3. Event Debouncing: Buffers high-frequency events (like ticket_sold) 
 *    to prevent frontend re-render flooding.
 */

const broadcastBuffers = new Map(); // roomId -> { payload, timeout }

export const pushNotification = async (userId, data) => {
  try {
    // 1. Persist to DB
    const notification = await notificationRepo.create({ userId, ...data });

    // 2. Push via WebSocket if client is connected (Private)
    const userSockets = clients.get(String(userId));
    if (userSockets) {
      const msg = JSON.stringify({ 
        type: 'notification', 
        ...data, 
        _id: notification._id,
        ts: Date.now() 
      });
      userSockets.forEach(ws => { 
        if (ws.readyState === 1) ws.send(msg); 
      });
    }
    return notification;
  } catch (err) {
    console.error('[NotificationService] Push failed:', err.message);
    throw err;
  }
};

export const getUserNotifications = async (userId) => {
  return await notificationRepo.findByUser(userId);
};

export const markAllAsRead = async (userId) => {
  return await notificationRepo.markAllAsRead(userId);
};

export const markAsRead = async (notificationId, userId) => {
  const n = await notificationRepo.markAsRead(notificationId, userId);
  if (!n) throw new Error('NOTIFICATION_NOT_FOUND');
  return n;
};

// ── Smart Broadcasting ──────────────────────────────────────────────────────

export const wsPriceUpdate = (eventId, prices, occupancyRate) => {
  // Price updates are medium-frequency, direct broadcast is fine
  broadcastToRoom(eventId, { type: 'price_update', eventId, prices, occupancyRate });
};

export const wsTicketSold = (eventId, categoryName, remainingSeats) => {
  // HIGH-FREQUENCY: Debounce ticket_sold updates (500ms window)
  const roomKey = `${eventId}:ticket_sold`;
  
  if (broadcastBuffers.has(roomKey)) {
    const buffer = broadcastBuffers.get(roomKey);
    buffer.payload = { type: 'ticket_sold', eventId, categoryName, remainingSeats }; // Keep latest state
    return;
  }

  const timeout = setTimeout(() => {
    const buffer = broadcastBuffers.get(roomKey);
    if (buffer) {
      broadcastToRoom(eventId, buffer.payload);
      broadcastBuffers.delete(roomKey);
    }
  }, 500); // 500ms debounce

  broadcastBuffers.set(roomKey, { 
    payload: { type: 'ticket_sold', eventId, categoryName, remainingSeats }, 
    timeout 
  });
};

export const wsAttendanceUpdate = (eventId, scannedCount, totalSold) => {
  // Low frequency, direct broadcast
  broadcastToRoom(eventId, { type: 'attendance_update', eventId, scannedCount, totalSold });
};

export default { 
  pushNotification, 
  getUserNotifications, 
  markAllAsRead, 
  markAsRead, 
  wsPriceUpdate,
  wsTicketSold,
  wsAttendanceUpdate
};
