import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import * as organizerController from './controller/organizer.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('organizer'));

router.get('/stats', requireDB, organizerController.getStats);
router.get(['/events', '/my-events'], requireDB, organizerController.getMyEvents);
router.post(['/', '/events'], requireDB, organizerController.createEvent);
router.put(['/:id', '/events/:id'], requireDB, organizerController.updateEvent);
router.delete(['/:id', '/events/:id'], requireDB, organizerController.deleteEvent);
router.get('/tickets', requireDB, organizerController.getMyTickets);
router.post('/broadcast', requireDB, organizerController.broadcast);
router.post('/message-admin', requireDB, organizerController.messageAdmin);
router.get('/health', organizerController.health);

export default router;
