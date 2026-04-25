import Waitlist from '../model/waitlist.model.js';
import { broadcastToRoom } from '../../notifications/notification.ws.js';
import { logEvent } from '../../../shared/utils/logger.js';

/**
 * ⏳ Waitlist Sentinel (Phase 14: Self-Driving)
 * 
 * Automatically clears the waitlist when seats become available.
 * Creates an urgent "Priority Window" for waiting fans.
 */

export const processWaitlistClearance = async (eventId, categoryId) => {
  try {
    // 1. Find the top priority fans for this specific event/category
    const waitingFans = await Waitlist.find({ 
      eventId, 
      status: 'WAITING' 
    })
    .sort({ priorityScore: -1, createdAt: 1 })
    .limit(10);

    if (waitingFans.length === 0) return;

    // 2. Broadcast a "Priority Access" WebSocket alert to these specific users
    // In a real app, we would also send an SMS/Email here.
    waitingFans.forEach(fan => {
      broadcastToRoom(eventId, {
        type: 'PRIORITY_ACCESS',
        message: '🎫 A seat has just opened up! You have 15 minutes of priority access.',
        userId: fan.userId,
        expiresIn: '15m'
      });
    });

    // 3. Mark them as notified
    await Waitlist.updateMany(
      { _id: { $in: waitingFans.map(f => f._id) } },
      { $set: { status: 'NOTIFIED' } }
    );

    logEvent('Waitlist-Sentinel', 'CLEARANCE_TRIGGERED', `Notified ${waitingFans.length} fans for Event:${eventId}`);
  } catch (err) {
    logEvent('Waitlist-Sentinel', 'CLEARANCE_FAILED', err.message, { eventId }, 'ERROR');
  }
};

export default { processWaitlistClearance };
