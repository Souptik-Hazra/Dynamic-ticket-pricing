import axios from 'axios';
import { predictMLPrice, validateBehavioralTelemetry as validateSignature } from '../../shared/utils.js';
import User from '../../shared/models/User.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * AI Service
 * 
 * Centralized "Brain" for dynamic pricing and behavioral auditing.
 */

/**
 * getCurrentPrice
 * 
 * Fetches the AI-predicted price for a specific event/category.
 */
export async function getCalculatedPrice(category, event, cognitiveScore = 1.0) {
  try {
    return await predictMLPrice(category, event, cognitiveScore);
  } catch (err) {
    console.warn('[AIService] Price prediction fallback triggered');
    const occupancyRate = (event.ticketsSold || 0) / (event.capacity || 1000);
    const multiplier = 1 + (occupancyRate * 0.5);
    const basePrice = category ? category.price : (event.currentPrice || event.basePrice);
    return Math.round(basePrice * multiplier);
  }
}

/**
 * auditHumanity
 * 
 * Verifies if the behavioral signature matches the telemetry.
 * If validation fails, escalates the user's botScore.
 */
export async function auditHumanity(userId, signature, telemetry) {
  const isValid = validateSignature(signature, telemetry);
  
  if (!isValid && userId) {
    console.warn(`[Sentinel] 🚩 Behavioral anomaly for user ${userId}. Escalating botScore.`);
    await User.findByIdAndUpdate(userId, { $inc: { botScore: 1 } }).catch(() => null);
  }

  return isValid;
}

/**
 * notifyPurchaseToML
 * 
 * Asynchronously informs the ML sidecar about a successful purchase.
 */
export async function notifyPurchaseToML(eventId, ticketCount) {
    try {
        await axios.post(`${ML_SERVICE_URL}/events/${eventId}/purchase`, { 
            eventId, 
            tickets: ticketCount 
        }, { timeout: 1000 });
    } catch (_e) {
        // Silent failure for non-critical ML sync
    }
}

/**
 * getAiHealth
 * 
 * Diagnostic probe to check if the ML sidecar is responsive.
 */
export async function getAiHealth() {
  try {
    const r = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 1200 });
    return { ok: r?.data?.status === 'ok' };
  } catch (_e) {
    return { ok: false, fallback: true };
  }
}
