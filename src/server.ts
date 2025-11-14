import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import { env } from './config/env.js';
import { RealtimeService } from './services/realtime.service.js';
import { MCPService } from './services/mcp.service.js';

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const faceWss = new WebSocketServer({ noServer: true });
const mcpService = env.USE_MCP ? new MCPService() : null;

// Array para almacenar clientes del rostro
const faceClients = new Set();

// Manejar upgrade de HTTP a WebSocket
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  
  if (pathname === '/realtime') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/face-control') {
    faceWss.handleUpgrade(request, socket, head, (ws) => {
      faceWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  console.log('🔌 Cliente conectado a Realtime');
  const realtimeService = new RealtimeService();
  realtimeService.connect(ws, mcpService);
});

// WebSocket para control de emociones del rostro
faceWss.on('connection', (ws) => {
  console.log('😊 Cliente conectado al control de rostro');
  faceClients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Comando de emoción recibido:', data);

      // Reenviar a todos los clientes conectados (pantallas de rostro)
      faceClients.forEach((client: any) => {
        if (client !== ws && client.readyState === 1) { // 1 = OPEN
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error('Error procesando mensaje de rostro:', error);
    }
  });

  ws.on('close', () => {
    console.log('😊 Cliente desconectado del control de rostro');
    faceClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('Error en WebSocket de rostro:', error);
    faceClients.delete(ws);
  });
});

async function startServer() {
  if (mcpService) await mcpService.connectAll();
  server.listen(env.PORT, () => {
    console.log(`🚀 ${env.APP_NAME} corriendo en http://${env.HOST}:${env.PORT}`);
    console.log(`🎙️ Realtime WebSocket en ws://${env.HOST}:${env.PORT}/realtime`);
    console.log(`😊 Face Control WebSocket en ws://${env.HOST}:${env.PORT}/face-control`);
  });
}

async function shutdown() {
  if (mcpService) await mcpService.shutdown();
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
