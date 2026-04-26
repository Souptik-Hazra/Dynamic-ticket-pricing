import config from '../../../shared/config/index.js';
import httpClient from '../../../shared/utils/network.js';
import { predictMLPrice, validateBehavioralTelemetry as validateSignature } from '../../../shared/utils/helpers.js';

import aiRepo from '../repository/ai.repo.js';
import bus from '../../../shared/utils/bus.js';
import { logSecurity } from '../../../shared/utils/logger.js';
import workerManager from '../../../shared/utils/worker.manager.js';


// Cross-module repository calls
import catalogRepo from '../../catalog/repository/catalog.repo.js';
import userRepo from '../../users/repository/user.repo.js';

const ML_SERVICE_URL = config.ml.serviceUrl;
const CLIP_NORM = config.ml.clipNorm;
const DP_EPSILON = config.ml.dpEpsilon;
const AGGREGATION_THRESHOLD = config.ml.aggregationThreshold;
const MAX_BUFFER_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export const federatedUpdatesBuffer = [];

/**
 * OS Concept: Memory Management & TTL (Time-To-Live)
 * Prevents memory leaks by removing stale weights that haven't reached the aggregation threshold.
 */
export function cleanupStaleWeights() {
  const now = Date.now();
  const initialLength = federatedUpdatesBuffer.length;
  
  // Remove entries older than 6 hours
  for (let i = federatedUpdatesBuffer.length - 1; i >= 0; i--) {
    if (now - federatedUpdatesBuffer[i].timestamp > MAX_BUFFER_AGE_MS) {
      federatedUpdatesBuffer.splice(i, 1);
    }
  }

  if (federatedUpdatesBuffer.length < initialLength) {
    console.log(`🧹 [AI-Service] Cleaned up ${initialLength - federatedUpdatesBuffer.length} stale weights from buffer.`);
  }
}

// Auto-cleanup every hour
setInterval(cleanupStaleWeights, 60 * 60 * 1000).unref();


export async function predictEventPrices(eventId, cognitiveScore = 1.0) {
  const event = await catalogRepo.findById(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const prices = {};
  if (event.ticketCategories && event.ticketCategories.length > 0) {
    for (const cat of event.ticketCategories) {
      const p = await getCalculatedPrice(cat, event, cognitiveScore);
      prices[cat.name] = p;
      await aiRepo.logPrice({ eventId: event._id, categoryName: cat.name, price: p, predictedAt: new Date() }).catch(() => null);
    }
  } else {
    const p = await getCalculatedPrice(null, event, cognitiveScore);
    prices['standard'] = p;
    await aiRepo.logPrice({ eventId: event._id, categoryName: 'standard', price: p, predictedAt: new Date() }).catch(() => null);
  }

  const occupancyRate = event.capacity > 0 ? Math.round((event.ticketsSold / event.capacity) * 100) : 0;
  bus.publish('price.updated', { eventId: event._id, prices, occupancyRate });

  return { eventId: event._id, prices };
}

export async function getCalculatedPrice(category, event, cognitiveScore = 1.0, userId = null) {
  const { getActiveExperiments, getExperimentSegment } = await import('../../analytics/abTest.service.js');
  const { createPriceLock } = await import('../../../shared/utils/priceLock.js');
  const { cacheGet } = await import('../../../shared/utils/cache.js');

  const basePrice = category ? category.price : (event.currentPrice || event.basePrice);

  try {
    // Overlord Step: AI Panic Switch (Phase 12)
    const isAiDisabled = await cacheGet('system:ai:disabled');
    if (isAiDisabled === true) return basePrice;

    const experiments = await getActiveExperiments();
    
    // Diamond Step: Emergency Revenue Trigger (Phase 14)
    const hoursToEvent = (new Date(event.startDate) - new Date()) / (1000 * 60 * 60);
    const occupancy = (event.ticketsSold / (event.capacity || 1)) * 100;
    let emergencyDiscount = 1.0;

    if (hoursToEvent < 48 && occupancy < 30) {
      emergencyDiscount = 0.8; // 20% Rescue Discount
      bus.publish('event.flash_sale', { eventId: event._id, discount: 20 });
    }

    let modelUsed = 'stable_v1';
    let price;

    if (experiments.enabled && userId) {
      const segment = getExperimentSegment(userId);
      modelUsed = segment === 'A' ? experiments.modelA : experiments.modelB;
      // In a real scenario, we'd call different ML endpoints here. 
      // For now, we simulate Model B being 5% more aggressive.
      const basePrice = await predictMLPrice(category, event, cognitiveScore);
      price = segment === 'A' ? basePrice : Math.round(basePrice * 1.05);
    } else {
      price = await predictMLPrice(category, event, cognitiveScore);
    }

    // Diamond Step: Sentiment-Aware Social Momentum (Phase 6)
    let finalPrice = price;
    if (userId) {
      const socialFactor = await getSocialMomentum(userId, event._id);
      if (socialFactor > 0) {
        finalPrice = Math.round(price * (1 + socialFactor));
      }
      
      // UX Step: Lock the price for 5 minutes
      await createPriceLock(userId, event._id, category?._id, finalPrice);
    }

    // Diamond Step: Apply Emergency Discount (Phase 14)
    finalPrice = Math.round(finalPrice * emergencyDiscount);

    return finalPrice;
  } catch (err) {
    const occupancyRate = (event.ticketsSold || 0) / (event.capacity || 1000);
    const multiplier = 1 + (occupancyRate * 0.5);
    const basePrice = category ? category.price : (event.currentPrice || event.basePrice);
    return Math.round(basePrice * multiplier);
  }
}

/**
 * 🕸️ Neo4j Social Momentum Logic
 * Calculates a price premium based on how many "friends" are attending.
 */
export async function getSocialMomentum(userId, eventId) {
  const { getNeo4jSession } = await import('../../../shared/db/index.js');
  const session = getNeo4jSession();
  if (!session) return 0;

  if (!session) return 0;

  try {
    const momentumPromise = session.run(
      `MATCH (u:User {id: $uid})-[:FOLLOWS*1..2]-(friend:User)-[:PURCHASED]->(e:Event {id: $eid})
       RETURN count(friend) as friendCount`,
      { uid: String(userId), eid: String(eventId) }
    ).then(result => result.records[0]?.get('friendCount').toNumber() || 0);

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('NEO4J_TIMEOUT')), 1000));

    const count = await Promise.race([momentumPromise, timeoutPromise]).catch(() => 0);
    
    // Scale: 2% premium per friend, capped at 15%
    return Math.min(0.15, count * 0.02);
  } catch (err) {
    return 0;
  } finally {
    await session.close().catch(() => null);
  }
}

export async function logAuditDecision(data, userId) {
  const { eventId, categoryId, price, qty, hash, humanitySignature, sessionId } = data;
  return await aiRepo.logPrice({
    eventId, categoryId, actualPrice: price, predictedPrice: price, isAudit: true,
    auditHash: hash, behavioralSignature: humanitySignature, sessionId, userId,
    features: { ticketsSold: qty }
  });
}

export async function processFederatedSync(nodeId, weights, reputation) {
  const weight = Math.min(1.0, (reputation.accountAgeDays / 365) + (reputation.purchaseCount / 10));
  if (weight < 0.05) throw new Error('REPUTATION_TOO_LOW');
  
  // OS Concept: Shared Memory (Zero-Copy)
  // Convert incoming weights (regular arrays) into SharedArrayBuffer-backed TypedArrays.
  // This allows the worker thread to access the data without expensive cloning.
  const sharedWeights = weights.map(layer => {
    const sab = new SharedArrayBuffer(layer.data.length * 4); // 4 bytes per Float32
    const typedArray = new Float32Array(sab);
    typedArray.set(layer.data);
    return {
      name: layer.name,
      shape: layer.shape,
      data: typedArray // This TypedArray is now backed by Shared Memory
    };
  });

  federatedUpdatesBuffer.push({ nodeId, reputationScore: weight, clippedWeights: sharedWeights, timestamp: Date.now() });
  return true;
}


import lockManager from '../../../shared/utils/lock.manager.js';

export async function runFederatedAggregation() {
  if (federatedUpdatesBuffer.length < AGGREGATION_THRESHOLD) {
    throw new Error(`INSUFFICIENT_PARTICIPANTS_${federatedUpdatesBuffer.length}/${AGGREGATION_THRESHOLD}`);
  }

  // OS Concept: Mutual Exclusion (Mutex)
  // Ensure only one cluster worker process triggers the heavy aggregation logic
  // at any given time, preventing CPU resource exhaustion.
  const lockAcquired = lockManager.acquireLock('ai_aggregation');
  if (!lockAcquired) {
    console.log('🧠 [AI-Service] Aggregation already in progress by another worker. Skipping.');
    return { success: false, reason: 'ALREADY_IN_PROGRESS' };
  }

  try {


  const totalParticipants = federatedUpdatesBuffer.length;

  const { 
    finalWeights, 
    aggregatedWeightsNorm, 
    rejectedCount, 
    validParticipantsCount,
    rejectedNodes
  } = await workerManager.runTask('aggregateWeights', {
    buffer: federatedUpdatesBuffer,
    threshold: AGGREGATION_THRESHOLD,
    clipNorm: CLIP_NORM,
    dpEpsilon: DP_EPSILON
  });

  // Restore Security Logging for Outliers
  for (const node of rejectedNodes) {
    await logSecurity('AI', `Rejected outlier node ${node.nodeId}`, { zScore: node.zScore.toFixed(2) });
  }

  const rejectedOutliers = rejectedCount;
  const aggL2NormSq = aggregatedWeightsNorm * aggregatedWeightsNorm;

  const modelVersion = `v${Date.now()}`;
  await aiRepo.createFLRoundLog({
    roundNumber: (await aiRepo.countFLRounds()) + 1,
    participantsCount: validParticipantsCount,
    rejectedSubmissions: rejectedOutliers,
    aggregatedWeightsNorm: Math.sqrt(aggL2NormSq),
    modelVersion,
    clippingThreshold: CLIP_NORM,
    dpEpsilon: DP_EPSILON
  });

  await httpClient.post(`${ML_SERVICE_URL}/admin/apply-update`, { weights: finalWeights, version: modelVersion }).catch(() => null);


  federatedUpdatesBuffer.length = 0;
  return { success: true, modelVersion, participants: validParticipantsCount };
  } finally {

    lockManager.releaseLock('ai_aggregation');
  }
}


export async function clearFederatedState() {
  await aiRepo.clearFLHistory();
  federatedUpdatesBuffer.length = 0;
  return true;
}

export async function auditHumanity(userId, signature, telemetry) {
  const isValid = validateSignature(signature, telemetry);
  if (!isValid && userId) {
    await userRepo.update(userId, { $inc: { botScore: 1 } }).catch(() => null);
  }
  return isValid;
}

import { aiCircuit } from '../../../shared/utils/circuitBreaker.js';

export async function getAiHealth() {
  return await aiCircuit.execute(async () => {
    const r = await httpClient.get(`${ML_SERVICE_URL}/health`, { timeout: 1200 });
    return { ok: r?.data?.status === 'ok' };
  }, () => ({ ok: false, fallback: true }));

}

// Additional helpers for tickets module to avoid direct model access
export async function notifyPurchaseToML(eventId, count) {
  await aiCircuit.execute(async () => {
    await httpClient.post(`${ML_SERVICE_URL}/admin/ingest-sale`, { eventId, count });
  }).catch(() => null); // Silent fail for ML ingestion if down
}


export const checkAndAggregate = async () => {
  if (federatedUpdatesBuffer.length >= AGGREGATION_THRESHOLD) {
    console.log(`🧠 [Automation] FL Threshold met (${federatedUpdatesBuffer.length}/${AGGREGATION_THRESHOLD}). Triggering auto-aggregation...`);
    return await runFederatedAggregation();
  }
  return null;
};

// Event Bus Subscriptions
bus.subscribe('ticket.sold', (payload) => {
  notifyPurchaseToML(payload.eventId, payload.count || 1);
});

export default { 
  predictEventPrices, 
  getCalculatedPrice,
  logAuditDecision, 
  processFederatedSync, 
  runFederatedAggregation,
  checkAndAggregate,
  clearFederatedState,
  auditHumanity,
  getAiHealth,
  notifyPurchaseToML
};
