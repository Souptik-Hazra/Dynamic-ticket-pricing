import cron from 'node-cron';
import { logEvent } from './logger.js';
import { predictMLPrice } from './helpers.js';

// Services/Repos
import ticketRepo from '../../modules/tickets/repository/ticket.repo.js';
import catalogRepo from '../../modules/catalog/repository/catalog.repo.js';
import aiService from '../../modules/ai/service/ai.service.js';
import ticketService from '../../modules/tickets/service/ticket.service.js';
import intelligenceService from '../../modules/analytics/service/intelligence.service.js';

/**
 * Background Automation Service
 * Handles scheduled tasks to keep the system clean and optimized.
 */
export const initAutomation = () => {
  console.log('🤖 [Automation] Initializing Background Services...');

  // 1. Cleanup Pending Tickets (Every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    try {
      const expirationThreshold = new Date(Date.now() - 30 * 60 * 1000);
      const expiredTickets = await ticketRepo.findPendingExpired(expirationThreshold);

      if (expiredTickets.length > 0) {
        console.log(`扫 [Automation] Expiring ${expiredTickets.length} pending tickets...`);
        for (const ticket of expiredTickets) {
          await ticketService.cancelTicket(ticket._id, 'system_timeout');
        }
        await logEvent('Automation', 'CLEANUP', `Cleaned up ${expiredTickets.length} expired pending tickets.`, {}, 'INFO');
      }
    } catch (err) {
      console.error('❌ [Automation] Cleanup Pending Tickets Failed:', err.message);
    }
  });

  // 2. Update Event Status (Daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const count = await catalogRepo.completePastEvents(now);
      
      if (count > 0) {
        console.log(`📅 [Automation] Marked ${count} events as completed.`);
        await logEvent('Automation', 'SCHEDULED_TASK', `Auto-completed ${count} past events.`, {}, 'INFO');
      }
    } catch (err) {
      console.error('❌ [Automation] Update Event Status Failed:', err.message);
    }
  });

  // 3. Auto-Aggregate Federated Learning (Every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      // Logic moved to aiService.checkAndAggregate()
      const result = await aiService.checkAndAggregate();
      if (result && result.success) {
        await logEvent('Automation', 'AI_TASK', `Auto-aggregated FL model ${result.modelVersion}.`, {}, 'INFO');
      }
    } catch (err) {
      console.error('❌ [Automation] FL Auto-Aggregation Failed:', err.message);
    }
  });

  // 4. Precompute Prices (Every 30 minutes)
  cron.schedule('*/30 * * * *', async () => {
    try {
      const activeEvents = await catalogRepo.findMany({ status: { $in: ['upcoming', 'ongoing'] } });
      let updatedCount = 0;

      for (const event of activeEvents) {
        if (event.ticketCategories && event.ticketCategories.length > 0) {
          for (const cat of event.ticketCategories) {
            cat.lastCalculatedPrice = await predictMLPrice(cat, event);
          }
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
  cron.schedule('55 23 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tickets = await ticketRepo.findConfirmedSince(today);
      const totalRevenue = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTickets = tickets.reduce((sum, t) => sum + t.quantity, 0);

      await logEvent('Automation', 'REPORT', `Daily Summary: ${totalTickets} tickets sold, ₹${totalRevenue.toFixed(2)} total revenue.`, {}, 'INFO');
      console.log(`📊 [Automation] Daily sales summary generated.`);
    } catch (err) {
      console.error('❌ [Automation] Daily Report Failed:', err.message);
    }
  });

  // 6. Intelligence Aggregation (Hourly)
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🧠 [Automation] Running Intelligence Aggregation...');
      await intelligenceService.aggregateDailyRevenue();
      await intelligenceService.aggregateEventOccupancy();
    } catch (err) {
      console.error('❌ [Automation] Intelligence Aggregation Failed:', err.message);
    }
  });

  console.log('✅ [Automation] All background tasks scheduled.');
};
