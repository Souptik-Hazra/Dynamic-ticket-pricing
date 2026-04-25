import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { purchaseLimiter } from '../../middleware/rateLimiter.js';
import * as paymentController from './controller/payment.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/pay', purchaseLimiter, requireDB, paymentController.payTicket);
router.get('/wallet', requireDB, paymentController.getWallet);
router.post('/wallet/deposit', requireDB, paymentController.deposit);
router.post('/wallet/withdraw', requireDB, paymentController.withdraw);
router.post('/refund/:id', requireRole('admin'), requireDB, paymentController.refund);

export default router;
