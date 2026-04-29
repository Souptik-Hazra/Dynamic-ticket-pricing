import { getRedisClient } from './cache.js';
import bus from './bus.js';
import { createLogger, logError } from './logger.js';

/**
 * 🌊 Big Data Ingestion Service (Phase 15)
 * 
 * Uses Redis Streams (XADD) to buffer high-velocity events.
 * This prevents the transactional application from being slowed down by
 * analytical logging and enables asynchronous "Big Data" processing.
 */

const STREAM_NAME = 'fanfever:telemetry:stream';
const MAX_STREAM_LEN = 100000; // Cap stream to prevent memory overflow

const logger = createLogger('BigData');

export async function ingestTelemetry(type, payload) {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const data = {
      type,
      payload: JSON.stringify(payload),
      timestamp: Date.now()
    };

    // XADD stream * MAXLEN ~ 100000 key data
    await redis.xadd(STREAM_NAME, 'MAXLEN', '~', MAX_STREAM_LEN, '*', 'data', JSON.stringify(data));
  } catch (err) {
    logError('BigData', 'Ingestion failed', err, { type, payload });
  }
}

/**
 * 📊 Analytics Event Buffer
 * Automatically ingests critical events into the big data stream
 */
export const initBigDataPipeline = () => {
  logger.info('Initializing ingestion pipeline...');

  // Buffer price updates
  bus.subscribe('price.updated', (payload) => {
    ingestTelemetry('PRICE_UPDATE', payload);
  });

  // Buffer ticket sales for deep analytics
  bus.subscribe('ticket.sold', (payload) => {
    ingestTelemetry('TICKET_SALE', payload);
  });

  // Buffer security events
  bus.subscribe('security.alert', (payload) => {
    ingestTelemetry('SECURITY_THREAT', payload);
  });

  logger.info('Pipeline active');
};

export default { ingestTelemetry, initBigDataPipeline };
