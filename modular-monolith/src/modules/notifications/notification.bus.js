import bus from '../../shared/utils/bus.js';
import { 
  pushNotification, 
  wsPriceUpdate, 
  wsTicketSold, 
  wsAttendanceUpdate 
} from './service/notification.service.js';
import { broadcastLivePulse } from './notification.ws.js';

/**
 * Notification Event Bus Subscriptions
 * 
 * Maps internal system events to user-facing notifications and WS broadcasts.
 */

import { createLogger } from '../../shared/utils/logger.js';

export const initNotificationBus = () => {
  const logger = createLogger('NotificationBus');
  // Diamond Step: Periodic Live Pulse (Phase 6)
  setInterval(() => {
    broadcastLivePulse();
  }, 10000); // Every 10 seconds

  // 1. Payment Success
  bus.subscribe('payment.success', (payload) => {
    const { userId, amount, eventName } = payload;
    pushNotification(userId, { 
      title: '💳 Payment Successful', 
      message: `₹${amount} paid for ${eventName}`, 
      type: 'ticket_purchase' 
    });
  });

  // 2. Ticket Purchased
  bus.subscribe('ticket.purchased', (payload) => {
    const { userId, count, eventName } = payload;
    pushNotification(userId, { 
      title: '🎫 Tickets Secured', 
      message: `${count} tickets generated for ${eventName}`, 
      type: 'ticket_purchase' 
    });
  });

  // 3. Subscription Events
  bus.subscribe('subscription.upgraded', (payload) => {
    const { userId, planLabel, expiryStr } = payload;
    pushNotification(userId, { 
      title: '⭐ Subscription Active!', 
      message: `Your ${planLabel} plan is now active until ${expiryStr}.`,
      type: 'subscription'
    });
  });

  bus.subscribe('subscription.expired', (payload) => {
    const { userId, plan } = payload;
    pushNotification(userId, { 
      title: '⚠️ Subscription Expired', 
      message: `Your ${plan.replace(/_/g, ' ')} plan has expired. Renew to keep your benefits.`,
      type: 'subscription'
    });
  });

  // 4. Real-time WS Broadcasts
  bus.subscribe('price.updated', (payload) => {
    const { eventId, prices, occupancyRate } = payload;
    wsPriceUpdate(eventId, prices, occupancyRate);
  });

  bus.subscribe('ticket.sold', (payload) => {
    const { eventId, categoryName, remainingSeats } = payload;
    wsTicketSold(eventId, categoryName, remainingSeats);
  });

  bus.subscribe('attendance.updated', (payload) => {
    const { eventId, scannedCount, totalSold } = payload;
    wsAttendanceUpdate(eventId, scannedCount, totalSold);
  });

  // 6. Background Task Progress
  bus.subscribe('task.status', (payload) => {
    const { userId, taskName, status, error } = payload;
    if (!userId) return; // Only broadcast to identified users

    pushNotification(userId, { 
      title: `⚙️ ${taskName.split(':')[0]}`, 
      message: `Status: ${status}${error ? ` (${error})` : ''}`, 
      type: 'task_update' 
    });
  });

  logger.info('All subscriptions active');
};

export default initNotificationBus;
