import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import * as adminController from './controller/admin.controller.js';

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.get('/stats', requireDB, adminController.getStats);
router.get('/events', requireDB, adminController.getEvents);
router.post('/events', requireDB, adminController.createEvent);
router.put('/events/:id', requireDB, adminController.updateEventStatus);
router.post('/events/:id/complete', requireDB, adminController.updateEventStatus);
router.delete('/events/:id', requireDB, adminController.deleteEvent);
router.get('/tickets', requireDB, adminController.getTickets);
router.get('/admins', requireDB, adminController.getAdmins);
router.get('/users', requireDB, adminController.getUsers);
router.put('/users/:id/role', requireDB, adminController.updateRole);
router.post('/broadcast', requireDB, adminController.broadcast);
router.get('/commissions', requireDB, adminController.getCommissions);
router.get('/wallets', requireDB, adminController.getWallets);
router.post('/wallets/:id/adjust', requireDB, adminController.adjustWallet);
router.get(['/health', '/system/health'], adminController.health);

export default router;
