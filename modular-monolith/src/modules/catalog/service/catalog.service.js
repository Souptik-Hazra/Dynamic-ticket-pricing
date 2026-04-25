import catalogRepo from '../repository/catalog.repo.js';
import { cacheGet, cacheSet } from '../../../shared/utils/cache.js';
import aiService from '../../ai/service/ai.service.js';

export const getPublicEventList = async () => {
  const cacheKey = 'events:list:public';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const events = await catalogRepo.listPublicEvents();
  
  await cacheSet(cacheKey, events, 300);
  return events;
};

export const getEventDetail = async (eventId) => {
  const cacheKey = `event:${eventId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const event = await catalogRepo.findById(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  
  await cacheSet(cacheKey, event, 600);
  return event;
};

/**
 * ⚡ Hot-Path Caching for Live Pricing
 * 
 * Uses Redis to store calculated prices for 5 seconds.
 * Drastically reduces Mongo/ML load during flash sales.
 */
export const getLivePricing = async (eventId, cognitiveScore = 1.0, userId = null) => {
  const cacheKey = `pricing:${eventId}:${cognitiveScore}:${userId || 'anon'}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const event = await catalogRepo.findById(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  
  const prices = {};
  if (event.ticketCategories && event.ticketCategories.length > 0) {
    for (const cat of event.ticketCategories) {
      prices[cat.name] = await aiService.getCalculatedPrice(cat, event, cognitiveScore, userId);
    }
  } else {
    prices['standard'] = await aiService.getCalculatedPrice(null, event, cognitiveScore, userId);
  }
  
  const aiStatus = await aiService.getAiHealth();

  const response = { 
    eventId: event._id, 
    prices, 
    occupancyRate: Math.round(((event.ticketsSold || 0) / (event.capacity || 1)) * 100),
    mlStatus: aiStatus
  };

  // Cache high-traffic pricing for 5 seconds
  await cacheSet(cacheKey, response, 5);
  return response;
};

export const getEventsByCategory = async (category) => {
  return await catalogRepo.findByCategory(category);
};

// Advanced Service Methods
export const countEvents = (filter = {}) => catalogRepo.countEvents(filter);
export const findById = (id) => catalogRepo.findById(id);
export const create = (data) => catalogRepo.create(data);
export const findOneAndDelete = (filter) => catalogRepo.findOneAndDelete(filter);
export const updateInventory = (filter, update, options) => catalogRepo.updateInventory(filter, update, options);

export default { 
  getPublicEventList, 
  getEventDetail, 
  getLivePricing, 
  getEventsByCategory,
  countEvents,
  findById,
  create,
  findOneAndDelete,
  updateInventory
};
