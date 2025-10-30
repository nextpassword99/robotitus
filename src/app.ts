import express from 'express';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use('/api', router);
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);

export default app;
