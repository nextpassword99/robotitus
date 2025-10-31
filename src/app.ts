import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));
app.use('/api', router);
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);

export default app;
