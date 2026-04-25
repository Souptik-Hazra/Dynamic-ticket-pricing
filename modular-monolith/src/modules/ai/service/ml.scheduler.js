import cron from 'node-cron';
import aiService from './ai.service.js';
import { logEvent } from '../../../shared/utils/logger.js';

/**
 * 🤖 ML Model Retraining Scheduler (Phase 11)
 * 
 * Automatically triggers model retraining based on data drift
 * and ROI performance to ensure pricing stays optimal.
 */

export const initMLScheduler = () => {
  // Every Sunday at 2 AM
  cron.schedule('0 2 * * 0', async () => {
    try {
      logEvent('ML-Scheduler', 'RETRAIN_START', 'Starting weekly automated model retraining tournament.');
      
      // Trigger the aggregation and retraining flow
      await aiService.runFederatedAggregation();
      
      logEvent('ML-Scheduler', 'RETRAIN_COMPLETE', 'Weekly retraining tournament finished. Models updated.');
    } catch (err) {
      logEvent('ML-Scheduler', 'RETRAIN_FAILED', `Retraining failed: ${err.message}`, {}, 'ERROR');
    }
  });

  console.log('🤖 [ML-Scheduler] Automated retraining active (Weekly: Sunday 02:00)');
};

export default { initMLScheduler };
