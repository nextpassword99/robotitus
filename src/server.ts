import app from './app.js';
import { env } from './config/env.js';
import { llmService } from './controllers/audio.controller.js';

async function startServer() {
  if (llmService.mcpService) await llmService.mcpService.connectAll();
  app.listen(env.PORT, () => {
    console.log(`🚀 ${env.APP_NAME} corriendo en http://${env.HOST}:${env.PORT}`);
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
