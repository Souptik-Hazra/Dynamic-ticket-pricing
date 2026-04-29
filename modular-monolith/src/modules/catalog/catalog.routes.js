import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import * as catalogController from './controller/catalog.controller.js';

import { pricingScraperLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.get(['/', '/events'], requireDB, catalogController.listPublic);
router.get(['/:id', '/events/:id'], pricingScraperLimiter, requireDB, catalogController.getDetail);
router.get(['/:id/dynamic-prices', '/events/:id/dynamic-prices'], pricingScraperLimiter, requireDB, catalogController.getPricing);
router.get('/categories/:category', requireDB, catalogController.getByCategory);


export default router;
