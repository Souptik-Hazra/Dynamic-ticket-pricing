import axios from 'axios';
import config from '../../../shared/config/index.js';
import { predictMLPrice, validateBehavioralTelemetry as validateSignature } from '../../../shared/utils/helpers.js';
import aiRepo from '../repository/ai.repo.js';
import bus from '../../../shared/utils/bus.js';
import { logSecurity } from '../../../shared/utils/logger.js';

// Cross-module repository calls
import catalogRepo from '../../catalog/repository/catalog.repo.js';
import userRepo from '../../users/repository/user.repo.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const CLIP_NORM = parseFloat(process.env.ML_CLIP_NORM || '15.0');
const DP_EPSILON = parseFloat(process.env.ML_DP_EPSILON || '0.05');
const AGGREGATION_THRESHOLD = parseInt(process.env.ML_AGGREGATION_THRESHOLD || '3');

export const federatedUpdatesBuffer = [];

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
  
  federatedUpdatesBuffer.push({ nodeId, reputationScore: weight, clippedWeights: weights, timestamp: Date.now() });
  return true;
}

export async function runFederatedAggregation() {
  if (federatedUpdatesBuffer.length < AGGREGATION_THRESHOLD) {
    throw new Error(`INSUFFICIENT_PARTICIPANTS_${federatedUpdatesBuffer.length}/${AGGREGATION_THRESHOLD}`);
  }

  const participants = federatedUpdatesBuffer.length;
  let totalReputation = 0;
  const aggMap = new Map();

  const norms = federatedUpdatesBuffer.map(u => {
    let l2 = 0;
    u.clippedWeights.forEach(l => l.data.forEach(v => l2 += v * v));
    return Math.sqrt(l2);
  });
  
  const meanNorm = norms.reduce((a, b) => a + b, 0) / participants;
  const stdNorm = Math.sqrt(norms.reduce((a, b) => a + Math.pow(b - meanNorm, 2), 0) / participants) || 1;

  let rejectedOutliers = 0;
  for (const update of federatedUpdatesBuffer) {
    let uL2 = 0;
    update.clippedWeights.forEach(l => l.data.forEach(v => uL2 += v * v));
    const zScore = Math.abs(Math.sqrt(uL2) - meanNorm) / stdNorm;

    if (zScore > 3.0 && participants > 5) {
      await logSecurity('AI', `Rejected outlier node ${update.nodeId}`, { zScore: zScore.toFixed(2) });
      rejectedOutliers++;
      continue;
    }

    totalReputation += update.reputationScore;
    for (const layer of update.clippedWeights) {
      if (!aggMap.has(layer.name)) aggMap.set(layer.name, { shape: layer.shape, data: new Array(layer.data.length).fill(0) });
      const aggLayer = aggMap.get(layer.name);
      for (let i = 0; i < layer.data.length; i++) {
          aggLayer.data[i] += layer.data[i] * update.reputationScore;
      }
    }
  }

  const finalWeights = [];
  let aggL2NormSq = 0;
  for (const [name, layer] of aggMap.entries()) {
    const averagedData = layer.data.map(val => {
      let finalVal = val / totalReputation;
      const u1 = Math.random();
      const u2 = Math.random();
      const noise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * DP_EPSILON;
      finalVal += noise;
      aggL2NormSq += finalVal * finalVal;
      return finalVal;
    });
    finalWeights.push({ name, shape: layer.shape, data: averagedData });
  }

  const modelVersion = `v${Date.now()}`;
  await aiRepo.createFLRoundLog({
    roundNumber: (await aiRepo.countFLRounds()) + 1,
    participantsCount: participants - rejectedOutliers,
    rejectedSubmissions: rejectedOutliers,
    aggregatedWeightsNorm: Math.sqrt(aggL2NormSq),
    modelVersion,
    clippingThreshold: CLIP_NORM,
    dpEpsilon: DP_EPSILON
  });

  await axios.post(`${ML_SERVICE_URL}/admin/apply-update`, { weights: finalWeights, version: modelVersion }).catch(() => null);

  federatedUpdatesBuffer.length = 0;
  return { success: true, modelVersion, participants: participants - rejectedOutliers };
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
    const r = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 1200 });
    return { ok: r?.data?.status === 'ok' };
  }, () => ({ ok: false, fallback: true }));
}

// Additional helpers for tickets module to avoid direct model access
export async function notifyPurchaseToML(eventId, count) {
  await aiCircuit.execute(async () => {
    await axios.post(`${ML_SERVICE_URL}/admin/ingest-sale`, { eventId, count });
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
