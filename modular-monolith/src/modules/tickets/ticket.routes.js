import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware from '../../middleware/auth.js';
import { purchaseLimiter, ticketReleaseLimiter } from '../../middleware/rateLimiter.js';
import * as ticketController from './controller/ticket.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/my-tickets', requireDB, ticketController.getMyTickets);
router.get('/:id', requireDB, ticketController.getDetail);
router.post('/purchase', ticketReleaseLimiter, purchaseLimiter, requireDB, ticketController.purchase);
router.post('/verify', requireDB, ticketController.verify);


export default router;
