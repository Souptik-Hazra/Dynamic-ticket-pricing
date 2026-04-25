import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import Event from '../../shared/models/Event.js';
import PriceLog from '../../shared/models/PriceLog.js';
import FLRoundLog from '../../shared/models/FLRoundLog.js';
import { requireDB, getNeo4jSession } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { getCalculatedPrice } from './ai.service.js';
import { logEvent, logError, logSecurity } from '../../shared/logger.service.js';

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

const CLIP_NORM = parseFloat(process.env.ML_CLIP_NORM || '15.0');
const DP_EPSILON = parseFloat(process.env.ML_DP_EPSILON || '0.05');
export const federatedUpdatesBuffer = [];
export const AGGREGATION_THRESHOLD = parseInt(process.env.ML_AGGREGATION_THRESHOLD || '3');
let currentRoundNumber = 1;

// ── Federated Learning Engine ──────────────────────────────────────────────

export const aggregateFederatedUpdates = async () => {
  if (federatedUpdatesBuffer.length < AGGREGATION_THRESHOLD) {
    return { success: false, error: `Insufficient participants (${federatedUpdatesBuffer.length}/${AGGREGATION_THRESHOLD})` };
  }

  const participants = federatedUpdatesBuffer.length;
  let totalReputation = 0;
  const aggMap = new Map();

  // 1. Statistical Outlier Detection (L2-Norm Analysis)
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
      await logSecurity('AI', `Rejected outlier node ${update.nodeId}`, { zScore: zScore.toFixed(2), nodeId: update.nodeId });
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

  // 2. Average & Apply Differential Privacy
  const finalWeights = [];
  let aggL2NormSq = 0;
  for (const [name, layer] of aggMap.entries()) {
    const averagedData = layer.data.map(val => {
      let finalVal = val / totalReputation;
      // Gaussian Noise for DP
      const u1 = Math.random();
      const u2 = Math.random();
      const noise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * DP_EPSILON;
      finalVal += noise;
      aggL2NormSq += finalVal * finalVal;
      return finalVal;
    });
    finalWeights.push({ name, shape: layer.shape, data: averagedData });
  }

  const weightsHash = crypto.createHash('sha256').update(JSON.stringify(finalWeights)).digest('hex');
  const lastRound = await FLRoundLog.findOne().sort({ roundNumber: -1 }).lean();
  const nextRoundNumber = lastRound ? (lastRound.roundNumber + 1) : currentRoundNumber;
  
  const modelVersion = `v${Date.now()}`;
  await FLRoundLog.create({
    roundNumber: nextRoundNumber,
    participantsCount: participants - rejectedOutliers,
    rejectedSubmissions: rejectedOutliers,
    aggregatedWeightsNorm: Math.sqrt(aggL2NormSq),
    modelVersion,
    weightsHash,
    clippingThreshold: CLIP_NORM,
    dpEpsilon: DP_EPSILON
  });

  // 3. Push to ML Sidecar
  try {
    await axios.post(`${ML_SERVICE_URL}/admin/apply-update`, { weights: finalWeights, version: modelVersion });
  } catch (e) { console.warn('[FL] failed to push update to ML sidecar'); }

  federatedUpdatesBuffer.length = 0;
  return { success: true, modelVersion, participants: participants - rejectedOutliers };
};

// ── Routes ─────────────────────────────────────────────────────────────────

router.get(['/predict/:eventId', '/:eventId/dynamic-prices'], requireDB, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const cognitiveScore = parseFloat(req.query.cognitive_score || '1.0');
    const prices = {};
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      for (const cat of event.ticketCategories) {
        const p = await getCalculatedPrice(cat, event, cognitiveScore);
        prices[cat.name] = p;
        await PriceLog.create({ eventId: event._id, categoryName: cat.name, price: p, predictedAt: new Date() }).catch(() => null);
      }
    } else {
      const p = await getCalculatedPrice(null, event, cognitiveScore);
      prices['standard'] = p;
      await PriceLog.create({ eventId: event._id, categoryName: 'standard', price: p, predictedAt: new Date() }).catch(() => null);
    }
    res.json({ eventId: event._id, prices });
  } catch (err) { next(err); }
});

router.post('/log-decision', requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryId, price, qty, hash, humanitySignature, sessionId } = req.body;
    await PriceLog.create({
      eventId, categoryId, actualPrice: price, predictedPrice: price, isAudit: true,
      auditHash: hash, behavioralSignature: humanitySignature, sessionId, userId: req.user?.id,
      features: { ticketsSold: qty }
    });
    res.json({ success: true, auditLogged: true });
  } catch (err) {
    if (err.code === 11000) return res.json({ success: true, message: 'Audit already exists' });
    next(err);
  }
});

router.post('/simulator/neo4j', authMiddleware, requireDB, async (req, res, next) => {
  const session = getNeo4jSession();
  if (!session) return res.status(503).json({ error: 'Neo4j service unavailable' });
  try {
    const { eventName, eventId, categories = [], layoutType, venueMetrics, eventPopularity } = req.body;
    const scores = {};
    categories.forEach(cat => {
      const totalSeats = cat.seats || 100;
      const booked = cat.bookedSeats?.length || 0;
      const blocked = cat.blockedSeats?.length || 0;
      const occupancy = (booked + blocked) / totalSeats;
      scores[cat.name] = Math.max(0, Math.min(1.0, (occupancy * 0.7) + (eventPopularity * 0.3)));
    });
    await session.executeWrite(tx => tx.run(`
      MERGE (e:Event {name: $eventName})
      SET e.eventId = $eventId, e.layout = $layoutType, e.updatedAt = datetime()
      CREATE (s:Simulation { timestamp: datetime(), popularity: $eventPopularity, exits: $exits, scores: $scoresJson })
      CREATE (e)-[:HAS_SIMULATION]->(s)
      RETURN s
    `, { eventName, eventId: eventId || 'evt-' + Date.now(), layoutType: layoutType || 'stadium', eventPopularity: eventPopularity || 0.5, exits: venueMetrics?.exitsCount || 4, scoresJson: JSON.stringify(scores) }));
    res.json({ success: true, scores, stored: true });
  } catch (err) { res.status(500).json({ error: 'Simulation persistence failed', fallback: true, scores: {} }); }
  finally { await session.close(); }
});

router.post('/fl/sync', async (req, res) => {
  const { weights, nodeId, reputation } = req.body;
  if (!weights || !reputation) return res.status(400).json({ error: 'Missing sync data' });
  const weight = Math.min(1.0, (reputation.accountAgeDays / 365) + (reputation.purchaseCount / 10));
  if (weight < 0.05) return res.status(403).json({ error: 'SYNC_REJECTED' });
  federatedUpdatesBuffer.push({ nodeId, reputationScore: weight, clippedWeights: weights, timestamp: Date.now() });
  res.json({ success: true, buffered: true });
});

router.post('/fl/aggregate', authMiddleware, requireRole('admin'), requireDB, async (req, res, next) => {
  try {
    const result = await aggregateFederatedUpdates();
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/fl/rounds', requireDB, requireRole('admin'), async (req, res, next) => {
  try {
    const rounds = await FLRoundLog.find().sort({ roundNumber: -1 }).limit(20);
    res.json(rounds);
  } catch (err) { next(err); }
});

router.post('/fl/clear', requireDB, async (req, res) => {
  try {
    await FLRoundLog.deleteMany({});
    federatedUpdatesBuffer.length = 0;
    currentRoundNumber = 1;
    res.json({ success: true, cleared: true });
  } catch (err) { res.status(500).json({ error: 'CLEAR_FAILED', message: String(err) }); }
});

router.post('/simulator/start', requireDB, (req, res) => {
  res.json({ success: true, message: 'Simulation started' });
});

router.get('/simulator/status', (req, res) => {
  res.json({ running: false, progress: 0 });
});

export default router;
