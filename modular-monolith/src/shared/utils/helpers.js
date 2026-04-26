import crypto from 'crypto';
import axios from 'axios';
import config from '../config/index.js';

export const verifyTemporalProof = (challenge, proof, difficulty = 2000) => {
  let result = challenge;
  for (let i = 0; i < difficulty; i++) {
    result = crypto.createHash('sha256').update(result + i).digest('hex');
  }
  return result === proof;
};

export const createBookingReference = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `FF-${ts}-${rand}`;
};

export const createTicketQrToken = () => crypto.randomBytes(32).toString('base64url');

export const predictMLPrice = async (category, event, cognitive_score = 1.0) => {
  const ML_SERVICE_URL = config.ml.serviceUrl;
  try {
    const basePrice = category ? Number(category.price) : (Number(event.basePrice) || 0);
    const maxPrice = category ? (Number(category.maxPrice) || basePrice * 3) : (basePrice * 3);

    const payload = {
      base_price: basePrice,
      capacity: event.capacity || 1000,
      tickets_sold: event.ticketsSold || 0,
      days_until_event: Math.max(0, Math.ceil((new Date(event.startDate) - new Date()) / (1000 * 60 * 60 * 24))),
      event_popularity: event.eventPopularity || 0.5,
      cognitive_score: cognitive_score,
      is_holiday: event.isHoliday ? 1 : 0
    };

    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, payload, { timeout: 2000 });
    return Math.max(basePrice, Math.min(Math.round(data.predicted_price), maxPrice));
  } catch (_err) {
    return category ? Number(category.price) : (Number(event.basePrice) || 0);
  }
};

/**
 * validateBehavioralTelemetry
 * 
 * Server-side auditor for Edge-AI signatures.
 * Detects "Impossible Actions" that even the client-side model might miss.
 */
export const validateBehavioralTelemetry = (signature, telemetry = {}) => {
  if (!signature || typeof signature !== 'string') return false;

  const { durationMs, sampleCount } = telemetry;

  // 1. Velocity Audit: A human cannot perform a complex behavioral capture in < 500ms
  // Most bots using headless browsers or scripts will trigger this immediately.
  if (durationMs && durationMs < 500) {
    console.warn(`[BehavioralAuditor] 🚩 Velocity Violation: Capture took only ${durationMs}ms`);
    return false;
  }

  // 2. Data Integrity: The CNN model requires at least 50 samples for a valid inference.
  // If the client claims a high score with fewer samples, it is a forgery.
  if (sampleCount !== undefined && sampleCount < 50) {
    console.warn(`[BehavioralAuditor] 🚩 Sample Violation: Only ${sampleCount} samples provided`);
    return false;
  }

  return true;
};
