import catalogRepo from '../repository/catalog.repo.js';
import { cacheGet, cacheSet, getCacheVersion } from '../../../shared/utils/cache.js';
import { aiService } from '../../ai/index.js';

export const getPublicEventList = async ({ page = 1, limit = 20, cursor = null } = {}) => {
  const version = await getCacheVersion();
  const cacheKey = `events:list:public:v${version}:p${page}:l${limit}`;
  const cached = await cacheGet(cacheKey, { includeMetadata: true });

  if (cached) {
    // 🔄 Stale-While-Revalidate (Phase 16)
    const age = (Date.now() - cached.at) / 1000;
    if (age > cached.ttl * 0.8) {
      (async () => {
        try {
          const events = await catalogRepo.listPublicEvents({ page, limit, cursor });
          const total = await catalogRepo.countEvents({ status: { $ne: 'cancelled' } });
          const payload = { items: events, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit || 20)) };
          await cacheSet(cacheKey, payload, 300);
        } catch (e) { }
      })();
    }
    if (page === 1) prefetchNextPages({ limit });
    return cached.val;
  }

  const events = await catalogRepo.listPublicEvents({ page, limit, cursor });
  const total = await catalogRepo.countEvents({ status: { $ne: 'cancelled' } });
  const totalPages = Math.ceil(total / Number(limit || 20));

  const payload = {
    items: events,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await cacheSet(cacheKey, payload, 300); // 5 mins cache for list pages

  // Trigger background pre-caching for next few pages
  prefetchNextPages({ currentPage: page, limit });

  return payload;
};

/**
 * 🚀 Background Pre-caching Logic
 * Fetches and stores the next 2 pages in Redis to eliminate "Next" click lag.
 */
async function prefetchNextPages({ currentPage = 1, limit = 20, category = null } = {}) {
  const nextPages = [Number(currentPage) + 1, Number(currentPage) + 2];

  for (const page of nextPages) {
    const cacheKey = category
      ? `events:list:cat:${category}:page:${page}:limit:${limit}`
      : `events:list:public:page:${page}:limit:${limit}`;

    // Check if already in cache to avoid redundant DB hits
    const exists = await cacheGet(cacheKey);
    if (exists) continue;

    // Fetch and cache without awaiting (background)
    (async () => {
      try {
        let items, total;
        if (category) {
          items = await catalogRepo.findByCategory(category, { page, limit });
          total = await catalogRepo.countEvents({ category, status: 'upcoming' });
        } else {
          items = await catalogRepo.listPublicEvents({ page, limit });
          total = await catalogRepo.countEvents({ status: { $ne: 'cancelled' } });
        }

        if (items && items.length > 0) {
          const payload = {
            items,
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          };
          await cacheSet(cacheKey, payload, 300);
        }
      } catch (err) {
        // Silently fail background pre-fetch
      }
    })();
  }
}

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
const priceInFlight = new Map();

export const getLivePricing = async (eventId, cognitiveScore = 1.0, userId = null) => {
  const cacheKey = `pricing:${eventId}:${cognitiveScore}:${userId || 'anon'}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // 💎 Step: Request Collapsing (Phase 16)
  // If a calculation is already in progress, join it instead of starting a new one.
  if (priceInFlight.has(cacheKey)) return await priceInFlight.get(cacheKey);

  const calculationPromise = (async () => {
    try {
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

      await cacheSet(cacheKey, response, 5);
      return response;
    } finally {
      priceInFlight.delete(cacheKey);
    }
  })();

  priceInFlight.set(cacheKey, calculationPromise);
  return await calculationPromise;
};

export const getEventsByCategory = async (category, { page = 1, limit = 20 } = {}) => {
  const version = await getCacheVersion();
  const cacheKey = `events:list:cat:${category}:v${version}:p${page}:l${limit}`;
  const cached = await cacheGet(cacheKey, { includeMetadata: true });

  if (cached) {
    // 🔄 Stale-While-Revalidate (Phase 16)
    const age = (Date.now() - cached.at) / 1000;
    if (age > cached.ttl * 0.8) {
      (async () => {
        try {
          const events = await catalogRepo.findByCategory(category, { page, limit });
          const total = await catalogRepo.countEvents({ category, status: 'upcoming' });
          const payload = { items: events, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) };
          await cacheSet(cacheKey, payload, 300);
        } catch (e) { }
      })();
    }
    return cached.val;
  }

  const events = await catalogRepo.findByCategory(category, { page, limit });
  const total = await catalogRepo.countEvents({ category, status: 'upcoming' });

  const payload = {
    items: events,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit))
  };

  await cacheSet(cacheKey, payload, 300);
  prefetchNextPages({ currentPage: page, limit, category });

  return payload;
};

// Advanced Service Methods
export const countEvents = (filter = {}) => catalogRepo.countEvents(filter);
export const findById = (id) => catalogRepo.findById(id);
export const create = (data) => catalogRepo.create(data);
export const findOneAndDelete = (filter, options = {}) => catalogRepo.findOneAndDelete(filter, options);
export const findMany = (filter, select = {}, options = {}) => catalogRepo.findMany(filter, select, options);
export const findOneAndUpdate = (filter, update, options = { new: true }) => catalogRepo.findOneAndUpdate(filter, update, options);
export const findByIdAndOrganizer = (id, organizerId) => catalogRepo.findOne({ _id: id, organizerId });
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
  findMany,
  findOneAndUpdate,
  findByIdAndOrganizer,
  updateInventory
};
