import { Router } from 'express';
import multer from 'multer';
import { processAudio } from '../controllers/audio.controller.js';
import { chat, resetConversation, loadKnowledgeBase, getConfig, getMcpStatus } from '../controllers/chat.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/process-audio', upload.single('audio'), processAudio);
router.post('/chat', chat);
router.post('/reset-conversation', resetConversation);
router.post('/load-knowledge-base', loadKnowledgeBase);
router.get('/config', getConfig);
router.get('/mcp/status', getMcpStatus);

export default router;
