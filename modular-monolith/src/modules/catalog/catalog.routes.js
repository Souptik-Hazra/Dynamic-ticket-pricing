import express from 'express';
import Event from '../../shared/models/Event.js';
import { requireDB } from '../../shared/database.js';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../../shared/cache.js';
import { getCalculatedPrice, getAiHealth } from '../ai/ai.service.js';

const router = express.Router();

/**
 * Catalog Module
 * 
 * Public-facing event discovery and catalog services.
 * Isolated from management (Organizer) and sales (Tickets).
 */

// ── GET /api/catalog ──
// List all upcoming events (Public)
router.get(['/', '/events'], requireDB, async (req, res, next) => {
  try {
    const cacheKey = 'events:list:public';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const events = await Event.find({ 
      status: { $ne: 'cancelled' },
      startDate: { $gte: new Date() }
    }).sort({ startDate: 1 });
    
    await cacheSet(cacheKey, events, 300); // 5 min cache
    res.json(events);
  } catch (err) { 
    next(err); 
  }
});

// ── GET /api/catalog/:id ──
// Detailed event view (Public)
router.get(['/:id', '/events/:id'], requireDB, async (req, res, next) => {
  try {
    const cacheKey = `event:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    await cacheSet(cacheKey, event, 600); // 10 min cache
    res.json(event);
  } catch (err) { 
    next(err); 
  }
});

// ── GET /api/catalog/events/:id/dynamic-prices ──
// Live pricing engine access for public views
router.get(['/:id/dynamic-prices', '/events/:id/dynamic-prices'], requireDB, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const cognitiveScore = parseFloat(req.query.cognitive_score || '1.0');
    const prices = {};
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      for (const cat of event.ticketCategories) {
        prices[cat.name] = await getCalculatedPrice(cat, event, cognitiveScore);
      }
    } else {
      prices['standard'] = await getCalculatedPrice(null, event, cognitiveScore);
    }
    
    const aiStatus = await getAiHealth();

    res.json({ 
      eventId: event._id, 
      prices, 
      occupancyRate: Math.round(((event.ticketsSold || 0) / (event.capacity || 1)) * 100),
      mlStatus: aiStatus
    });
  } catch (err) { next(err); }
});

// ── GET /api/catalog/categories/:id ──
// Filtered view by category (Public)
router.get('/categories/:category', requireDB, async (req, res, next) => {
    try {
      const events = await Event.find({ 
        category: req.params.category,
        status: { $ne: 'cancelled' }
      }).sort({ startDate: 1 });
      res.json(events);
    } catch (err) { next(err); }
});

export default router;
