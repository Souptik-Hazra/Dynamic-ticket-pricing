import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import * as analyticsController from './controller/analytics.controller.js';

const router = express.Router();

router.get('/health', analyticsController.status);
router.get('/dashboard', authMiddleware, requireDB, analyticsController.getDashboard);
router.get('/system-logs', authMiddleware, requireRole('admin'), requireDB, analyticsController.getLogs);
router.get('/system-health', authMiddleware, requireRole('admin'), requireDB, analyticsController.getHealth);

export default router;
