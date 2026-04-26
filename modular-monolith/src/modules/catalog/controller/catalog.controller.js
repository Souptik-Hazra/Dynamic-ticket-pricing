import * as catalogService from '../service/catalog.service.js';
import response from '../../../shared/utils/response.js';

export const listPublic = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const cursor = req.query.cursor || null;

    const eventsPage = await catalogService.getPublicEventList({ page, limit, cursor });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    response.success(res, eventsPage);
  } catch (err) { next(err); }
};

export const getDetail = async (req, res, next) => {
  try {
    const event = await catalogService.getEventDetail(req.params.id);
    response.success(res, event);
  } catch (err) { 
    if (err.message === 'EVENT_NOT_FOUND') return response.error(res, 'Event not found', 404);
    next(err); 
  }
};

export const getPricing = async (req, res, next) => {
  try {
    const cognitiveScore = parseFloat(req.query.cognitive_score || '1.0');
    const pricing = await catalogService.getLivePricing(req.params.id, cognitiveScore, req.user?.id);
    
    // Data Step: Log viewing intent (Phase 7)
    if (req.user?.id) {
      const { logIntent } = await import('../../analytics/behavioral.service.js');
      logIntent(req.user.id, req.params.id, 'view_price', { cognitiveScore, result: pricing.prices });
    }

    res.setHeader('Cache-Control', 'private, max-age=5');
    response.success(res, pricing);
  } catch (err) {
    if (err.message === 'EVENT_NOT_FOUND') return response.error(res, 'Event not found', 404);
    next(err);
  }
};

export const getByCategory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const category = req.params.category;

    const events = await catalogService.getEventsByCategory(category, { page, limit });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    response.success(res, events);
  } catch (err) { next(err); }
};

export default {
  listPublic,
  getDetail,
  getPricing,
  getByCategory
};
