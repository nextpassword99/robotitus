import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import { env } from './config/env.js';
import { llmService } from './controllers/audio.controller.js';
import { RealtimeService } from './services/realtime.service.js';

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/realtime' });

wss.on('connection', (ws) => {
  console.log('🔌 Cliente conectado a Realtime');
  const realtimeService = new RealtimeService();
  realtimeService.connect(ws);
});

async function startServer() {
  if (llmService.mcpService) await llmService.mcpService.connectAll();
  server.listen(env.PORT, () => {
    console.log(`🚀 ${env.APP_NAME} corriendo en http://${env.HOST}:${env.PORT}`);
    console.log(`🎙️ Realtime WebSocket en ws://${env.HOST}:${env.PORT}/realtime`);
  });
}

async function shutdown() {
  if (llmService.mcpService) await llmService.mcpService.shutdown();
}

startServer().catch(console.error);

process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await shutdown();
  process.exit(0);
});
