import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import * as authController from './controller/auth.controller.js';

const router = express.Router();

router.post(['/signup', '/register'], authLimiter, requireDB, authController.signup);
router.post(['/login', '/signin'], authLimiter, requireDB, authController.login);
router.post('/refresh', requireDB, authController.refresh);
router.get('/verify', authMiddleware, authController.verify);
router.post('/logout', requireDB, authMiddleware, authController.logout);

export default router;
