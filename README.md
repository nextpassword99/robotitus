# SENATI Assistant - Realtime Voice AI

Sistema de asistencia conversacional en tiempo real para SENATI usando OpenAI Realtime API con WebRTC y soporte MCP.

## Características

- 🎙️ **Conversación en tiempo real** con OpenAI Realtime API
- 🔊 **Audio bidireccional** con WebRTC (baja latencia)
- 🤖 **GPT-4o Realtime** con detección de voz automática (VAD)
- 🔌 **MCP Multi-Servidor** para herramientas externas (opcional)
- ⚙️ **Configurable** desde .env
- 🏗️ **Clean Architecture** con TypeScript

## Instalación

```bash
npm install
```

## Configuración

1. Copiar `.env.example` a `.env`
2. Configurar `OPENAI_API_KEY`

```env
OPENAI_API_KEY=tu_api_key_aqui
USE_MCP=false
```

## Uso

### Iniciar servidor (desarrollo)

```bash
npm run dev
```

Luego abre tu navegador en: **http://localhost:8000**

### Iniciar servidor (producción)

```bash
npm run build
npm start
```

### Interfaz Web

Abre http://localhost:8000 en tu navegador para:
1. Presionar el micrófono para conectar
2. Hablar naturalmente
3. El sistema detecta automáticamente cuando hablas (VAD)
4. Recibe respuestas en tiempo real con voz y texto

**Flujo automático:**
1. 🎙️ Usuario presiona micrófono
2. 🔗 Conexión WebRTC con OpenAI
3. 🗣️ Usuario habla (detección automática)
4. 🤖 GPT-4o responde en tiempo real
5. 💬 Transcripción en pantalla + audio

## Arquitectura

```
src/
├── config/
│   ├── env.ts              # Variables de entorno (Zod)
│   ├── realtime.config.ts  # Configuración centralizada Realtime
│   └── mcpRegistry.ts      # Registro MCP
├── controllers/
│   └── chat.controller.ts  # API endpoints
├── services/
│   ├── realtime.service.ts # Realtime API + MCP
│   └── mcp.service.ts      # MCP Client
├── routes/
│   └── index.ts            # Rutas Express
├── middleware/
│   └── errorHandler.ts     # Manejo de errores
├── app.ts                  # Express app
└── server.ts               # Entry point + WebSocket

public/
├── realtime.js             # Cliente WebRTC (config centralizada)
└── index.html              # Interfaz web
```

## Tecnologías

- **Express.js** + TypeScript
- **OpenAI Realtime API** (WebRTC)
- **WebSocket** (para proxy opcional)
- **MCP SDK** (@modelcontextprotocol/sdk) (opcional)
- **Zod** (validación)

## MCP (Model Context Protocol)

El sistema soporta herramientas MCP que se integran automáticamente con el Realtime API:

1. Configura servidores MCP en `data/mcp/servers.json`
2. Habilita MCP con `USE_MCP=true` en `.env`
3. Las herramientas se registran automáticamente en la sesión
4. El modelo puede llamar herramientas durante la conversación

## Configuración Centralizada

Toda la configuración del sistema está centralizada en:

- **Servidor**: `src/config/realtime.config.ts`
  - System prompts
  - Parámetros de voz y audio
  - Configuración VAD
  - Mensajes de estado
  - Límites y timeouts

- **Cliente**: `public/realtime.js` (objeto `ClientConfig`)
  - Mensajes de estado UI
  - Parámetros de audio
  - URLs y modelos

## Notas

- **WebRTC**: Conexión directa cliente → OpenAI (baja latencia)
- **VAD**: Detección automática de voz (no necesitas presionar para hablar)
- **MCP**: Opcional, requiere servidores configurados
- **HTTPS**: Requerido en producción para WebRTC (dev server funciona con HTTP)
- **Clean Code**: Configuración centralizada para fácil mantenimiento

## Endpoints

#### GET /api/config
Configuración del sistema (incluye API key para cliente)
```bash
curl http://localhost:8000/api/config
```

#### GET /health
Health check
```bash
curl http://localhost:8000/health
```

## Personalización

Para personalizar el asistente, edita `src/config/realtime.config.ts`:

```typescript
// Cambiar voz
audio: {
  voice: 'sage' // alloy, echo, shimmer, ash, ballad, coral, sage, verse
}

// Modificar system prompt
systemPrompt: {
  role: 'Tu descripción del rol...',
  personality: ['Característica 1', 'Característica 2'],
  // ...
}

// Ajustar VAD
vad: {
  threshold: 0.7, // Más alto = menos sensible
  silenceDurationMs: 700 // Más tiempo antes de detectar fin
}
```
