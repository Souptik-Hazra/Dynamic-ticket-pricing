import express from 'express';
import { requireDB } from '../../shared/db/index.js';
import * as catalogController from './controller/catalog.controller.js';

const router = express.Router();

router.get(['/', '/events'], requireDB, catalogController.listPublic);
router.get(['/:id', '/events/:id'], requireDB, catalogController.getDetail);
router.get(['/:id/dynamic-prices', '/events/:id/dynamic-prices'], requireDB, catalogController.getPricing);
router.get('/categories/:category', requireDB, catalogController.getByCategory);

export default router;
