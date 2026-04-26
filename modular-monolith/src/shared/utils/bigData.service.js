import { getRedisClient } from './cache.js';
import bus from './bus.js';

/**
 * 🌊 Big Data Ingestion Service (Phase 15)
 * 
 * Uses Redis Streams (XADD) to buffer high-velocity events.
 * This prevents the transactional application from being slowed down by
 * analytical logging and enables asynchronous "Big Data" processing.
 */

const STREAM_NAME = 'fanfever:telemetry:stream';
const MAX_STREAM_LEN = 100000; // Cap stream to prevent memory overflow

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
    console.error('❌ [BigData] Ingestion failed:', err.message);
  }
}

/**
 * 📊 Analytics Event Buffer
 * Automatically ingests critical events into the big data stream
 */
export const initBigDataPipeline = () => {
  console.log('🌊 [BigData] Initializing ingestion pipeline...');

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

  console.log('✅ [BigData] Pipeline active');
};

export default { ingestTelemetry, initBigDataPipeline };
