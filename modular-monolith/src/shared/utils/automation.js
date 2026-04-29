import cron from 'node-cron';
import { createLogger, logEvent } from './logger.js';
import { predictMLPrice } from '../../modules/ai/service/ai.service.js';
import { generalQueue, analyticsQueue } from './taskQueue.js';

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
  const logger = createLogger('Automation');
  logger.info('Initializing Background Services...');

  // 1. Cleanup Pending Tickets (Every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    generalQueue.add('cleanup.pending_tickets', async () => {
      const expirationThreshold = new Date(Date.now() - 30 * 60 * 1000);
      const expiredTickets = await ticketRepo.findPendingExpired(expirationThreshold);

      if (expiredTickets.length > 0) {
        logger.info(`Expiring ${expiredTickets.length} pending tickets...`, { expiredTickets: expiredTickets.length });
        for (const ticket of expiredTickets) {
          await ticketService.cancelTicket(ticket._id, 'system_timeout');
        }
        await logEvent('Automation', 'CLEANUP', `Cleaned up ${expiredTickets.length} expired pending tickets.`, {}, 'INFO');
      }
    });
  });

  // 2. Update Event Status (Daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    generalQueue.add('update.event.status', async () => {
      const now = new Date();
      const count = await catalogRepo.completePastEvents(now);
      
      if (count > 0) {
        logger.info(`Marked ${count} events as completed.`, { count });
        await logEvent('Automation', 'SCHEDULED_TASK', `Auto-completed ${count} past events.`, {}, 'INFO');
      }
    });
  });

  // 3. Auto-Aggregate Federated Learning (Every hour)
  cron.schedule('0 * * * *', async () => {
    analyticsQueue.add('ai.auto_aggregate', async () => {
      const result = await aiService.checkAndAggregate();
      if (result && result.success) {
        await logEvent('Automation', 'AI_TASK', `Auto-aggregated FL model ${result.modelVersion}.`, {}, 'INFO');
      }
    });
  });

  // 4. Precompute Prices (Every 30 minutes)
  cron.schedule('*/30 * * * *', async () => {
    analyticsQueue.add('precompute.prices', async () => {
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
      
      logger.info(`Precomputed prices for ${updatedCount} active events.`, { updatedCount });
    });
  });

  // 5. Daily Sales Summary (Daily at 11:55 PM)
  cron.schedule('55 23 * * *', async () => {
    generalQueue.add('daily.sales.summary', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tickets = await ticketRepo.findConfirmedSince(today);
      const totalRevenue = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTickets = tickets.reduce((sum, t) => sum + t.quantity, 0);

      await logEvent('Automation', 'REPORT', `Daily Summary: ${totalTickets} tickets sold, ₹${totalRevenue.toFixed(2)} total revenue.`, {}, 'INFO');
      logger.info('Daily sales summary generated.', { totalTickets, totalRevenue });
    });
  });

  // 6. Intelligence Aggregation (Hourly)
  cron.schedule('0 * * * *', async () => {
    analyticsQueue.add('intelligence.aggregation', async () => {
      logger.info('Running Intelligence Aggregation...');
      await intelligenceService.aggregateDailyRevenue();
      await intelligenceService.aggregateEventOccupancy();
    });
  });

  logger.info('All background tasks scheduled.');
};
