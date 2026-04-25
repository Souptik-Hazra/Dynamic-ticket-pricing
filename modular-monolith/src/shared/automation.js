import cron from 'node-cron';
import Ticket from './models/Ticket.js';
import Event from './models/Event.js';
import SystemLog from './models/SystemLog.js';
import { predictMLPrice } from './utils.js';
import { federatedUpdatesBuffer, AGGREGATION_THRESHOLD, aggregateFederatedUpdates } from '../modules/ai/ai.routes.js';

/**
 * Background Automation Service
 * Handles scheduled tasks to keep the system clean and optimized.
 */
export const initAutomation = () => {
  console.log('🤖 [Automation] Initializing Background Services...');

  // 1. Cleanup Pending Tickets (Every 15 minutes)
  // Cancels 'pending_payment' tickets older than 30 minutes to release inventory.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const expirationThreshold = new Date(Date.now() - 30 * 60 * 1000);
      const expiredTickets = await Ticket.find({
        status: 'pending_payment',
        createdAt: { $lt: expirationThreshold }
      });

      if (expiredTickets.length > 0) {
        console.log(`🧹 [Automation] Expiring ${expiredTickets.length} pending tickets...`);
        for (const ticket of expiredTickets) {
          ticket.status = 'cancelled';
          await ticket.save();
          
          // Revert inventory for each cancelled ticket
          const event = await Event.findById(ticket.eventId);
          if (event) {
            const cat = event.ticketCategories.find(c => c.name === ticket.categoryName);
            if (cat) {
              cat.availableSeats = Math.min(cat.seats, (cat.availableSeats || 0) + ticket.quantity);
            } else {
              event.availableTickets = Math.min(event.capacity, (event.availableTickets || 0) + ticket.quantity);
            }
            event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - ticket.quantity);
            await event.save();
          }
        }
        await SystemLog.create({
          service: 'Automation',
          level: 'INFO',
          message: `Cleaned up ${expiredTickets.length} expired pending tickets.`
        });
      }
    } catch (err) {
      console.error('❌ [Automation] Cleanup Pending Tickets Failed:', err.message);
    }
  });

  // 2. Update Event Status (Daily at midnight)
  // Marks events as 'completed' if the end date has passed.
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const result = await Event.updateMany(
        { status: { $in: ['upcoming', 'ongoing'] }, endDate: { $lt: now } },
        { $set: { status: 'completed' } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`📅 [Automation] Marked ${result.modifiedCount} events as completed.`);
        await SystemLog.create({
          service: 'Automation',
          level: 'INFO',
          message: `Auto-completed ${result.modifiedCount} past events.`
        });
      }
    } catch (err) {
      console.error('❌ [Automation] Update Event Status Failed:', err.message);
    }
  });

  // 3. Auto-Aggregate Federated Learning (Every hour)
  // Automatically triggers aggregation if enough participants have contributed.
  cron.schedule('0 * * * *', async () => {
    try {
      if (federatedUpdatesBuffer.length >= AGGREGATION_THRESHOLD) {
        console.log(`🧠 [Automation] FL Threshold met (${federatedUpdatesBuffer.length}/${AGGREGATION_THRESHOLD}). Triggering auto-aggregation...`);
        const result = await aggregateFederatedUpdates();
        if (result.success) {
          await SystemLog.create({
            service: 'Automation',
            level: 'INFO',
            message: `Auto-aggregated FL model ${result.modelVersion} with ${result.participants} participants.`
          });
        }
      }
    } catch (err) {
      console.error('❌ [Automation] FL Auto-Aggregation Failed:', err.message);
    }
  });

  // 4. Precompute Prices (Every 30 minutes)
  // Updates cached prices for active events to speed up checkout.
  cron.schedule('*/30 * * * *', async () => {
    try {
      const activeEvents = await Event.find({ status: { $in: ['upcoming', 'ongoing'] } });
      let updatedCount = 0;

      for (const event of activeEvents) {
        if (event.ticketCategories && event.ticketCategories.length > 0) {
          for (const cat of event.ticketCategories) {
            cat.lastCalculatedPrice = await predictMLPrice(cat, event);
          }
        } else {
          // If no categories, we might store a general price, but usually events have categories
          // Logic for single-price events can be added here if needed
        }
        await event.save();
        updatedCount++;
      }
      
      console.log(`📈 [Automation] Precomputed prices for ${updatedCount} active events.`);
    } catch (err) {
      console.error('❌ [Automation] Price Precomputation Failed:', err.message);
    }
  });

  // 5. Daily Sales Summary (Daily at 11:55 PM)
  // Generates a summary report of the day's performance.
  cron.schedule('55 23 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tickets = await Ticket.find({
        status: 'confirmed',
        purchaseDate: { $gte: today }
      });

      const totalRevenue = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTickets = tickets.reduce((sum, t) => sum + t.quantity, 0);

      await SystemLog.create({
        service: 'Automation',
        level: 'INFO',
        message: `Daily Summary: ${totalTickets} tickets sold, $${totalRevenue.toFixed(2)} total revenue.`
      });
      console.log(`📊 [Automation] Daily sales summary generated.`);
    } catch (err) {
      console.error('❌ [Automation] Daily Report Failed:', err.message);
    }
  });

  console.log('✅ [Automation] All background tasks scheduled.');
};
