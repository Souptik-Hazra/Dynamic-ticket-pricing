import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import * as aiController from './controller/ai.controller.js';

const router = express.Router();

router.get('/health', aiController.health);
router.get('/prices/:eventId', requireDB, aiController.getPrices);
router.post('/federated/sync', authMiddleware, requireDB, aiController.syncFederated);
router.post('/federated/aggregate', authMiddleware, requireRole('admin'), requireDB, aiController.aggregateFederated);

export default router;
