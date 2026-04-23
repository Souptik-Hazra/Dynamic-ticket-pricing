import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import { requestLogger } from '../shared/logger.js';
import crypto from 'crypto';
import axios from 'axios';
import mongoose from 'mongoose';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import User from '../shared/models/User.js';
import PriceLog from '../shared/models/PriceLog.js';
import FLRoundLog from '../shared/models/FLRoundLog.js';
import { verifyTemporalProof } from '../shared/temporalAuthServer.js';
import {
  notify,
  wsNotifyUser,
  cacheDel,
  cacheDelPattern,
  CACHE_KEYS,
} from '../shared/interservice.js';

dotenv.config();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
// Price validation tolerances (configurable via env)
const PRICE_ABS_TOLERANCE = Number(process.env.PRICE_ABS_TOLERANCE) || 1.0; // absolute currency units
const PRICE_REL_TOLERANCE = Number(process.env.PRICE_REL_TOLERANCE) || 0.02; // relative (fraction)

console.log(`Price validation tolerances — abs: ${PRICE_ABS_TOLERANCE}, rel: ${PRICE_REL_TOLERANCE}`);

const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger('OrganizerService'));

connectDB('OrganizerService');

// ── Ironclad Session Nonces ────────────────────────────────────────────────
const sessionNonces = new Map();

app.get('/api/security/nonce', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sessionId = crypto.randomUUID();
  sessionNonces.set(sessionId, { nonce, ts: Date.now() });
  res.json({ nonce, sessionId });
});

// Cleanup old nonces
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of sessionNonces.entries()) {
    if (now - data.ts > 300000) sessionNonces.delete(id); // 5 min expiry
  }
}, 60000);

// ── Dynamic price helper (Fallback) ──────────────────────────────────────────
const getDynamicPriceFallback = (category, event, cognitive_score = 1.0) => {
  if (!event) return 0;
  const basePrice = category ? (Number(category.price) || 0) : (Number(event.basePrice) || 0);
  const maxPrice = category ? (Number(category.maxPrice) || basePrice * 3) : basePrice * 3;
  if (basePrice <= 0) return 0;
  const categories = event.ticketCategories || [];
  const totalCap = categories.reduce((s, c) => s + (Number(c.seats) || 0), 0) || Number(event.capacity) || 1;
  const totalSold = categories.reduce((s, c) => s + (Number(c.seats) || 0) - (Number(c.availableSeats ?? c.seats) || 0), 0);
  const occupancy = Math.max(0, Math.min(1, totalSold / totalCap));
  
  // Base market multiplier
  let multiplier = Math.max(0.9, Math.min(2.0, 1 + occupancy * 0.5));
  
  // ── DECPG Bot Penalty Function ──
  if (cognitive_score < 0.8) {
    const penalty = Math.pow(1.5, (0.8 - cognitive_score) * 10);
    multiplier *= penalty;
  }
  
  const finalPrice = Math.round(basePrice * multiplier);
  // Strictly clamp between [basePrice, maxPrice]
  return Math.max(basePrice, Math.min(finalPrice, maxPrice));
};

async function predictMLPrice(category, event, cognitive_score = 1.0) {
  const basePrice = category ? category.price : event.basePrice;
  const maxPrice = category ? (category.maxPrice || basePrice * 3) : basePrice * 3;
  
  try {
    const now = new Date();
    const start = new Date(event.startDate);
    const totalCap = (event.ticketCategories || []).reduce((s, c) => s + (Number(c.seats) || 0), 0) || Number(event.capacity) || 1;
    const totalSold = (event.ticketCategories || []).reduce((s, c) => s + (Number(c.seats) || 0) - (Number(c.availableSeats ?? c.seats) || 0), 0);
    const daysUntil = Math.max(0, (start - now) / (1000 * 60 * 60 * 24));

    const payload = {
      capacity: totalCap,
      tickets_sold: totalSold,
      base_price: basePrice,
      max_price: maxPrice,
      days_until_event: daysUntil,
      event_popularity: event.eventPopularity || 0.5,
      cognitive_score: cognitive_score,
      category: event.category || 'other',
      is_holiday: event.isHoliday ? 1 : 0
    };

    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, payload, { timeout: 2000 });
    // Note: app.py already clamps, but we apply a safety clamp here too
    return Math.max(basePrice, Math.min(Math.round(data.predicted_price), maxPrice));
  } catch {
    return getDynamicPriceFallback(category, event, cognitive_score);
  }
}

app.get('/api/events', async (req, res, next) => {
  try {
    const events = await Event.find({}).sort({ startDate: 1 });
    res.json(events);
  } catch (err) { next(err); }
});

app.get('/api/events/:id/dynamic-prices', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const cognitive_score = parseFloat(req.query.cognitive_score) || 1.0;
    const prices = {};
    if (event.ticketCategories?.length > 0) {
      for (const cat of event.ticketCategories) {
        prices[cat.name] = await predictMLPrice(cat, event, cognitive_score);
      }
    } else {
      prices['standard'] = await predictMLPrice(null, event, cognitive_score);
    }
    res.json({ prices });
  } catch (err) { next(err); }
});

app.post('/api/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  const { eventId, categoryId, categoryName, quantity, pricePerTicket, sessionId, humanityProof, temporalProof, cognitive_score } = req.body;

  // 1. Verify Temporal Speed-Bump (VDF)
  if (!humanityProof || !temporalProof || !verifyTemporalProof(humanityProof, temporalProof)) {
    return res.status(403).json({ error: 'INVALID_TEMPORAL_PROOF', message: 'Temporal security check failed or was bypassed.' });
  }

  // Verify Session Nonce (Prevent Replay)
  if (!sessionId || !sessionNonces.has(sessionId)) {
    return res.status(403).json({ error: 'INVALID_SESSION', message: 'Security nonce expired or missing.' });
  }
  sessionNonces.delete(sessionId); // One-time use

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Find the ticket category from the event (if provided)
    const cat = (event.ticketCategories || []).find(c => {
      if (categoryId && c._id) return String(c._id) === String(categoryId);
      return c.name === categoryName;
    }) || null;

    // Server-side price recomputation to prevent client-side tampering
    const clientPrice = Number(pricePerTicket) || 0;
    const score = typeof cognitive_score === 'number' ? cognitive_score : 1.0;
    const serverPrice = await predictMLPrice(cat, event, score);

    const absDiff = Math.abs(clientPrice - serverPrice);
    const relDiff = serverPrice > 0 ? absDiff / serverPrice : absDiff;

    // Threshold: reject if both absolute and relative difference exceed configured tolerances
    if (clientPrice > 0 && absDiff > PRICE_ABS_TOLERANCE && relDiff > PRICE_REL_TOLERANCE) {
      return res.status(409).json({ error: 'PRICE_MISMATCH', message: 'Client price does not match server price', serverPrice, clientPrice });
    }

    const finalPrice = serverPrice || clientPrice;

    // Persist a price log (shadow/predicted vs actual)
    try {
      await PriceLog.create({
        eventId: event._id,
        categoryId: cat?._id,
        features: {
          capacity: Number(event.capacity) || 0,
          ticketsSold: (event.ticketsSold || 0),
          basePrice: cat ? Number(cat.price) : Number(event.basePrice) || 0,
          daysUntilEvent: Math.max(0, Math.round((new Date(event.startDate) - Date.now()) / (1000 * 60 * 60 * 24))),
          eventPopularity: event.eventPopularity || 0.5,
          occupancyRate: 0
        },
        predictedPrice: serverPrice,
        actualPrice: finalPrice,
        isSale: true,
        userId: req.user && req.user.id ? req.user.id : undefined
      });
    } catch (logErr) {
      console.warn('PriceLog save failed', logErr && logErr.message);
    }

    const ticket = await Ticket.create({
      eventId, userId: req.user.id, categoryId: cat?._id, categoryName, quantity,
      pricePerTicket: finalPrice, totalAmount: finalPrice * quantity, status: 'confirmed'
    });

    res.status(201).json({ success: true, tickets: [ticket] });
  } catch (err) { next(err); }
});

// 🛡️ IRONCLAD FEDERATED SYNC: Reputation-Weighted Aggregation Buffer
const federatedUpdatesBuffer = [];
let currentRoundNumber = 1;
const CLIP_NORM = 5.0; // Max L2 norm for a client's weight update
const DP_EPSILON = 0.1; // Placeholder for Differential Privacy noise

// Initialize round number from DB
const syncRoundNumber = async () => {
  try {
    const lastRound = await FLRoundLog.findOne().sort({ roundNumber: -1 });
    if (lastRound) {
      currentRoundNumber = lastRound.roundNumber + 1;
      console.log(`[FederatedBrain] Next round initialized to: ${currentRoundNumber}`);
    }
  } catch (err) {
    console.error('Failed to sync round number:', err.message);
  }
};
// We'll call this after DB connection is established or on first request
let roundSynced = false;

app.post('/api/security/federated-sync', async (req, res) => {
  if (!roundSynced) {
    await syncRoundNumber();
    roundSynced = true;
  }
  const { weights, nodeId, reputation } = req.body;

  if (!weights || !reputation) return res.status(400).json({ error: 'Missing sync data' });

  // 1. Calculate Reputation Weight
  // Verified buyers with older accounts have higher weight (0.1 to 1.0)
  const weight = Math.min(1.0, (reputation.accountAgeDays / 365) + (reputation.purchaseCount / 10));

  // 2. Neural Auditor
  let anomaly = false;
  // Compute L2 Norm of weights
  let l2NormSq = 0;
  for (let i = 0; i < weights.length; i++) {
    const l = weights[i];
    if (l.data && Array.isArray(l.data)) {
      for (let j = 0; j < l.data.length; j++) {
        const v = l.data[j];
        if (isFinite(v) && !isNaN(v)) {
          l2NormSq += v * v;
        } else {
          anomaly = true;
        }
        if (Math.abs(v) > 25) anomaly = true;
      }
    } else {
      console.warn(`[FederatedBrain] Missing or invalid data array in layer ${l.name}`);
      anomaly = true;
    }
  }
  const l2Norm = Math.sqrt(l2NormSq);

  if (anomaly || weight < 0.05) {
    console.warn(`[FederatedBrain] 🚩 Rejected sync from low-reputation or anomalous node ${nodeId}`);
    // Log rejection (could be moved to FLRoundLog later, but for now we'll just skip buffer)
    return res.status(403).json({ error: 'SYNC_REJECTED' });
  }

  // L2 Clipping (prevents single node from heavily shifting model)
  let clipFactor = 1.0;
  if (l2Norm > CLIP_NORM) {
    clipFactor = CLIP_NORM / l2Norm;
  }

  // Apply clipping to weights and store in buffer
  const clippedWeights = weights.map(l => {
    let newData = [];
    if (l.data && Array.isArray(l.data)) {
      for (let j = 0; j < l.data.length; j++) {
        newData.push(l.data[j] * clipFactor);
      }
    }
    return {
      name: l.name,
      data: newData,
      shape: l.shape
    };
  });

  federatedUpdatesBuffer.push({
    nodeId,
    reputationScore: weight,
    l2NormBeforeClip: l2Norm,
    clippedWeights,
    timestamp: Date.now()
  });

  console.log(`[FederatedBrain] ✅ Buffered update from node ${nodeId} (Weight: ${weight.toFixed(2)}, L2: ${l2Norm.toFixed(2)})`);
  res.json({ success: true, buffered: true });
});

// Admin endpoint to trigger aggregation round
app.post('/api/federated/aggregate', jwtMiddleware, requireDB, async (req, res, next) => {
  // In production, ensure user is Admin
  // if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  if (federatedUpdatesBuffer.length === 0) {
    return res.status(400).json({ error: 'No updates in buffer to aggregate' });
  }

  try {
    const participants = federatedUpdatesBuffer.length;
    let totalReputation = 0;
    const aggregatedWeightsMap = new Map(); // shape: layerName -> [values]

    // ── Hardening: Statistical Outlier Detection (Z-Score) ───────────
    // We compute the mean L2 norm of the current batch to detect outliers
    const norms = federatedUpdatesBuffer.map(u => u.l2NormBeforeClip);
    const meanNorm = norms.reduce((a, b) => a + b, 0) / participants;
    const stdNorm = Math.sqrt(norms.reduce((a, b) => a + Math.pow(b - meanNorm, 2), 0) / participants) || 1;

    // 1. Reputation-weighted accumulation with Outlier Rejection
    let rejectedOutliers = 0;
    for (const update of federatedUpdatesBuffer) {
      // Z-Score check: Reject if update is > 3 std devs away from mean
      const zScore = Math.abs(update.l2NormBeforeClip - meanNorm) / stdNorm;
      if (zScore > 3.0 && participants > 5) { // Only apply if we have enough samples
        console.warn(`[FederatedBrain] 🚩 Rejected outlier node ${update.nodeId} (Z-Score: ${zScore.toFixed(2)})`);
        rejectedOutliers++;
        continue;
      }

      totalReputation += update.reputationScore;
      
      for (const layer of update.clippedWeights) {
        if (!aggregatedWeightsMap.has(layer.name)) {
          // Initialize layer
          aggregatedWeightsMap.set(layer.name, {
            shape: layer.shape,
            data: new Array(layer.data.length).fill(0)
          });
        }
        
        const aggLayer = aggregatedWeightsMap.get(layer.name);
        for (let i = 0; i < layer.data.length; i++) {
          aggLayer.data[i] += layer.data[i] * update.reputationScore;
        }
      }
    }

    // 2. Finalize aggregation (divide by total reputation to get weighted average)
    // and compute total L2 norm of the new aggregated delta
    let aggL2NormSq = 0;
    const finalAggregatedWeights = [];
    
    for (const [name, layer] of aggregatedWeightsMap.entries()) {
      const averagedData = layer.data.map(val => {
        let finalVal = val / totalReputation;
        
        // ── Hardening: Differential Privacy (DP) Noise ───────────────
        // Add Gaussian noise (Box-Muller transform) scaled by epsilon
        const u1 = Math.random();
        const u2 = Math.random();
        const noise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * DP_EPSILON;
        
        finalVal += noise;
        aggL2NormSq += finalVal * finalVal;
        return finalVal;
      });
      
      finalAggregatedWeights.push({
        name,
        shape: layer.shape,
        data: averagedData
      });
    }

    const aggregatedWeightsNorm = Math.sqrt(aggL2NormSq);

    // Create a hash of the final aggregated weights for audit
    const weightsString = JSON.stringify(finalAggregatedWeights);
    const weightsHash = crypto.createHash('sha256').update(weightsString).digest('hex');
    const newModelVersion = `v1.${currentRoundNumber}`;

    // 3. Save cryptographic audit log
    const participantDetails = federatedUpdatesBuffer.map(u => ({
      nodeId: u.nodeId,
      reputationScore: u.reputationScore,
      l2NormBeforeClip: u.l2NormBeforeClip,
      anomalyFlags: []
    }));

    const roundLog = await FLRoundLog.create({
      roundNumber: currentRoundNumber,
      participantsCount: participants - rejectedOutliers,
      rejectedSubmissions: rejectedOutliers,
      aggregatedWeightsNorm,
      modelVersion: newModelVersion,
      weightsHash,
      clippingThreshold: CLIP_NORM,
      dpEpsilon: DP_EPSILON,
      participantDetails
    });

    console.log(`[FederatedBrain] 🔄 Round ${currentRoundNumber} Aggregated. Participants: ${participants}. Norm: ${aggregatedWeightsNorm.toFixed(2)}`);

    // 4. Forward the aggregated delta to ml-model service to apply and validate
    try {
      await axios.post(`${ML_SERVICE_URL}/admin/apply-update`, { weights: finalAggregatedWeights, version: newModelVersion });
    } catch (mlErr) {
      console.error(`[FederatedBrain] ⚠️ Failed to apply update to ML service: ${mlErr.message}`);
      // We don't fail the whole request here, as the aggregation round itself was successful and logged.
    }

    // Clear buffer and increment round
    federatedUpdatesBuffer.length = 0;
    currentRoundNumber++;

    res.json({ success: true, roundLog, modelVersion: newModelVersion });
  } catch (err) {
    next(err);
  }
});

// ── Standard Health Check ──────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'organizer-service', ts: new Date().toISOString() })
);

/* ═══════════════════════════════════════════════════════════════════════════
   ORGANIZER MANAGEMENT ROUTES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/organizers/stats
 * Dashboard summary for a specific organizer
 */
app.get('/api/organizers/stats', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const organizerId = req.user.id;
    const [eventsCount, ticketsAgg] = await Promise.all([
      Event.countDocuments({ organizerId }),
      Ticket.aggregate([
        { 
          $lookup: {
            from: 'events',
            localField: 'eventId',
            foreignField: '_id',
            as: 'event'
          }
        },
        { $unwind: '$event' },
        { $match: { 'event.organizerId': new mongoose.Types.ObjectId(organizerId), status: 'confirmed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalTickets: { $sum: '$quantity' } } }
      ])
    ]);

    const { totalRevenue = 0, totalTickets = 0 } = ticketsAgg[0] || {};
    
    res.json({
      stats: {
        totalEvents: eventsCount,
        totalTickets,
        totalRevenue
      }
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/organizers/events
 * List all events owned by this organizer
 */
app.get('/api/organizers/events', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user.id }).sort({ startDate: 1 });
    res.json({ events });
  } catch (err) { next(err); }
});

app.get('/api/organizers/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, organizerId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err) { next(err); }
});

app.put('/api/organizers/events/:id', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizerId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    cacheDel(CACHE_KEYS.EVENT_DETAIL(event._id));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);
    
    res.json({ event });
  } catch (err) { next(err); }
});

/**
 * GET /api/organizers/tickets
 * List all ticket sales for this organizer's events
 */
app.get('/api/organizers/tickets', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const tickets = await Ticket.aggregate([
      { 
        $lookup: {
          from: 'events',
          localField: 'eventId',
          foreignField: '_id',
          as: 'event'
        }
      },
      { $unwind: '$event' },
      { $match: { 'event.organizerId': new mongoose.Types.ObjectId(req.user.id) } },
      { $sort: { purchaseDate: -1 } },
      { $limit: 200 },
      {
        $project: {
          _id: 1,
          bookingReference: 1,
          customerName: 1,
          customerEmail: 1,
          eventName: '$event.name',
          categoryName: 1,
          quantity: 1,
          totalAmount: 1,
          status: 1,
          purchaseDate: 1
        }
      }
    ]);
    res.json({ tickets });
  } catch (err) { next(err); }
});

/**
 * POST /api/organizers/broadcast
 * Send notification to all attendees of a specific event
 */
app.post('/api/organizers/broadcast', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { eventId, title, message } = req.body;
    const event = await Event.findOne({ _id: eventId, organizerId: req.user.id });
    if (!event) return res.status(404).json({ error: 'Event not found or unauthorized' });

    const tickets = await Ticket.find({ eventId, status: 'confirmed' }).select('userId');
    const userIds = [...new Set(tickets.map(t => t.userId))];

    userIds.forEach(uid => {
      notify(uid, 'message', `📢 ${event.name}: ${title}`, message);
      wsNotifyUser(uid, 'message', `Organizer Broadcast`, title);
    });

    res.json({ success: true, count: userIds.length });
  } catch (err) { next(err); }
});

/**
 * POST /api/organizers/message-admin
 * Send a support/management message to platform admins
 */
app.post('/api/organizers/message-admin', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { title, message } = req.body;
    const admins = await User.find({ role: 'admin' }).select('_id');
    
    admins.forEach(admin => {
      notify(admin._id, 'alert', `📩 Partner Message: ${req.user.name}`, `${title}: ${message}`);
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

/**
 * POST /api/tickets/revert
 * Internal: Reverse a purchase (refund).
 */
app.post('/api/tickets/revert', requireDB, async (req, res, next) => {
  try {
    const { eventId, categoryName, quantity, amount } = req.body;
    if (!eventId || !categoryName || !quantity) {
      return res.status(400).json({ error: 'Missing required reversal data' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // 1. Update inventory
    const category = event.ticketCategories.find(c => c.name === categoryName.toLowerCase());
    if (category) {
      category.availableSeats += quantity;
    }

    // 2. Adjust revenue
    event.totalRevenue = Math.max(0, (event.totalRevenue || 0) - amount);
    event.commissionCollected = Math.max(0, (event.commissionCollected || 0) - Math.round(amount * 0.20));

    await event.save();

    // 3. Invalidate caches
    cacheDel(CACHE_KEYS.EVENT_DETAIL(eventId));
    cacheDelPattern(CACHE_KEYS.EVENT_LIST_ALL);

    res.json({ success: true, message: 'Purchase reverted successfully' });
  } catch (err) { next(err); }
});

/**
 * 🧪 Simulator Endpoints (Placeholder)
 * These will eventually handle high-volume load testing and bot simulation.
 */
app.post('/api/simulator/start', requireDB, (req, res) => {
  res.json({ success: true, message: 'Simulation started (Placeholder)' });
});

app.get('/api/simulator/status', (req, res) => {
  res.json({ running: false, progress: 0 });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT_ORGANIZER_SERVICE || 4013;
app.listen(PORT, () => console.log(`Organizer Service running on port ${PORT}`));
