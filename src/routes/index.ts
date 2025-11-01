import { Router } from 'express';
import { getConfig } from '../controllers/chat.controller.js';

const router = Router();

router.get('/config', getConfig);

export default router;
