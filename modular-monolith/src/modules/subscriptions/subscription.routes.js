import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware from '../../middleware/auth.js';
import * as subscriptionController from './controller/subscription.controller.js';

const router = express.Router();

router.get('/plans', subscriptionController.listPlans);
router.get('/', authMiddleware, requireDB, subscriptionController.getMySubscription);
router.post('/upgrade', authMiddleware, requireDB, subscriptionController.upgrade);

export default router;
