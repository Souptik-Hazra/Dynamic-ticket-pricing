import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware from '../../middleware/auth.js';
import * as notificationController from './controller/notification.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireDB, notificationController.listAll);
router.put('/mark-all-read', requireDB, notificationController.markAllRead);
router.put('/:id/read', requireDB, notificationController.markRead);

export default router;
