import crypto from 'crypto';
import axios from 'axios';

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
  const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
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
  } catch (err) {
    return category ? Number(category.price) : (Number(event.basePrice) || 0);
  }
};
