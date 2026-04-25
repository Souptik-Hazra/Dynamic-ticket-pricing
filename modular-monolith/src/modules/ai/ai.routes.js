import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { predictMLPrice } from '../../shared/utils.js';
import Event from '../../shared/models/Event.js';
import PriceLog from '../../shared/models/PriceLog.js';
import FLRoundLog from '../../shared/models/FLRoundLog.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

const CLIP_NORM = parseFloat(process.env.ML_CLIP_NORM || '15.0');
const DP_EPSILON = parseFloat(process.env.ML_DP_EPSILON || '0.05');
const AGGREGATION_THRESHOLD = parseInt(process.env.ML_AGGREGATION_THRESHOLD || '3');
let currentRoundNumber = 1;
const federatedUpdatesBuffer = [];

// ML prediction is centralized in shared utils

router.get(['/predict/:eventId', '/:eventId/dynamic-prices'], requireDB, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const prices = {};
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      for (const cat of event.ticketCategories) {
        const p = await predictMLPrice(cat, event);
        prices[cat.name] = p;
        // Log individual category price
        await PriceLog.create({
          eventId: event._id,
          categoryName: cat.name,
          price: p,
          predictedAt: new Date()
        }).catch(() => null);
      }
    } else {
      const p = await predictMLPrice(null, event);
      prices['standard'] = p;
      await PriceLog.create({
        eventId: event._id,
        categoryName: 'standard',
        price: p,
        predictedAt: new Date()
      }).catch(() => null);
    }
    res.json({ eventId: event._id, prices });
  } catch (err) { next(err); }
});

router.post('/log-decision', requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryId, price, qty, hash, humanitySignature, sessionId } = req.body;
    
    await PriceLog.create({
      eventId,
      categoryId,
      actualPrice: price,
      predictedPrice: price,
      isAudit: true,
      auditHash: hash,
      behavioralSignature: humanitySignature,
      userId: req.user?.id,
      features: {
        ticketsSold: qty
      }
    });

    res.json({ success: true, auditLogged: true });
  } catch (err) {
    // If it's a duplicate hash, we just ignore it (already logged)
    if (err.code === 11000) return res.json({ success: true, message: 'Audit already exists' });
    next(err);
  }
});

// ── Federated Learning ─────────────────────────────────────────────────────

router.post('/fl/sync', async (req, res) => {
  const { weights, nodeId, reputation } = req.body;
  if (!weights || !reputation) return res.status(400).json({ error: 'Missing sync data' });

  const weight = Math.min(1.0, (reputation.accountAgeDays / 365) + (reputation.purchaseCount / 10));
  let l2NormSq = 0;
  for (const l of weights) {
    if (l.data && Array.isArray(l.data)) {
      for (const v of l.data) l2NormSq += v * v;
    }
  }
  const l2Norm = Math.sqrt(l2NormSq);

  if (weight < 0.05) return res.status(403).json({ error: 'SYNC_REJECTED' });

  const clipFactor = l2Norm > CLIP_NORM ? CLIP_NORM / l2Norm : 1.0;
  const clippedWeights = weights.map(l => ({
    name: l.name,
    shape: l.shape,
    data: l.data.map(v => v * clipFactor)
  }));

  federatedUpdatesBuffer.push({ nodeId, reputationScore: weight, l2NormBeforeClip: l2Norm, clippedWeights, timestamp: Date.now() });
  res.json({ success: true, buffered: true });
});

router.post('/fl/aggregate', authMiddleware, requireRole('admin'), requireDB, async (req, res, next) => {
  if (federatedUpdatesBuffer.length < AGGREGATION_THRESHOLD) {
    return res.status(400).json({ error: `Insufficient participants (${federatedUpdatesBuffer.length}/${AGGREGATION_THRESHOLD}). Wait for more updates.` });
  }

  try {
    const participants = federatedUpdatesBuffer.length;
    let totalReputation = 0;
    const aggMap = new Map();

    // ── Statistical Outlier Detection (Z-Score) ──
    const norms = federatedUpdatesBuffer.map(u => u.l2NormBeforeClip);
    const meanNorm = norms.reduce((a, b) => a + b, 0) / participants;
    const stdNorm = Math.sqrt(norms.reduce((a, b) => a + Math.pow(b - meanNorm, 2), 0) / participants) || 1;

    let rejectedOutliers = 0;

    for (const update of federatedUpdatesBuffer) {
      // Reject if update is > 3 standard deviations away (anomalous)
      const zScore = Math.abs(update.l2NormBeforeClip - meanNorm) / stdNorm;
      if (zScore > 3.0 && participants > 5) {
        console.warn(`[FederatedBrain] 🚩 Rejected outlier node ${update.nodeId} (Z-Score: ${zScore.toFixed(2)})`);
        rejectedOutliers++;
        continue;
      }

      totalReputation += update.reputationScore;
      for (const layer of update.clippedWeights) {
        if (!aggMap.has(layer.name)) aggMap.set(layer.name, { shape: layer.shape, data: new Array(layer.data.length).fill(0) });
        const aggLayer = aggMap.get(layer.name);
        for (let i = 0; i < layer.data.length; i++) aggLayer.data[i] += layer.data[i] * update.reputationScore;
      }
    }

    const finalWeights = [];
    let aggL2NormSq = 0;
    for (const [name, layer] of aggMap.entries()) {
      const averagedData = layer.data.map(val => {
        let finalVal = val / totalReputation;
        // Differential Privacy Noise
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
    const modelVersion = `v1.${currentRoundNumber}`;

    await FLRoundLog.create({
      roundNumber: currentRoundNumber,
      participantsCount: participants - rejectedOutliers,
      rejectedSubmissions: rejectedOutliers,
      aggregatedWeightsNorm: Math.sqrt(aggL2NormSq),
      modelVersion,
      weightsHash,
      clippingThreshold: CLIP_NORM,
      dpEpsilon: DP_EPSILON
    });

    try { await axios.post(`${ML_SERVICE_URL}/admin/apply-update`, { weights: finalWeights, version: modelVersion }); } catch {}

    federatedUpdatesBuffer.length = 0;
    currentRoundNumber++;
    res.json({ success: true, modelVersion, participants: participants - rejectedOutliers });
  } catch (err) { next(err); }
});

router.get('/fl/rounds', requireDB, requireRole('admin'), async (req, res, next) => {
  try {
    const rounds = await FLRoundLog.find().sort({ roundNumber: -1 }).limit(20);
    res.json(rounds);
  } catch (err) { next(err); }
});

// ── Simulator ──────────────────────────────────────────────────────────────

router.post('/simulator/start', requireDB, (req, res) => {
  res.json({ success: true, message: 'Simulation started (Modular Monolith Context)' });
});

router.get('/simulator/status', (req, res) => {
  res.json({ running: false, progress: 0 });
});

export default router;
