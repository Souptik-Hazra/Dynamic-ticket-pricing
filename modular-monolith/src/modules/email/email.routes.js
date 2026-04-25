import express from 'express';
import * as emailController from './controller/email.controller.js';

const router = express.Router();

router.get('/health', emailController.health);
router.post('/send-template', emailController.sendTemplate);

export default router;
