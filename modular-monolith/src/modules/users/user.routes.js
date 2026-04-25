import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import * as userController from './controller/user.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/me', requireDB, userController.getMe);
router.get('/', requireDB, requireRole('admin'), userController.listAll);
router.get('/:id', requireDB, userController.getOne);
router.put('/:id', requireDB, userController.update);
router.delete('/:id', requireDB, requireRole('admin'), userController.remove);

export default router;
