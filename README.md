# SENATI Assistant API - Node.js

Sistema de asistencia conversacional para SENATI con RAG (Retrieval-Augmented Generation) usando ChromaDB y soporte MCP multi-servidor.

## Características

- 🎤 **Reconocimiento de voz** con Whisper
- 🔔 **Wake Word Detection** con Porcupine (palabras clave en español)
- 🎙️ **Grabación continua** en tiempo real
- 🔄 **Flujo automático**: Palabra clave → Grabación → Transcripción → LLM → Respuesta
- 🤖 **LLM** con GPT-4o-mini
- 📚 **RAG** con ChromaDB para contexto institucional (opcional)
- 🔌 **MCP Multi-Servidor** (opcional)
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
PORCUPINE_ACCESS_KEY=tu_porcupine_key_aqui
USE_RAG=false
USE_MCP=false
RECORDING_DURATION_SEC=5
SILENCE_TIMEOUT_SEC=2
```

## Uso

### Iniciar servidor (desarrollo)

```bash
npm run dev
```

### Iniciar servidor (producción)

```bash
npm run build
npm start
```

### Endpoints

#### POST /api/process-audio
Procesa audio con Whisper y genera respuesta
```bash
curl -X POST -F "audio=@audio.wav" http://localhost:8000/api/process-audio
```

#### POST /api/chat
Chat directo sin audio
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"¿Qué carreras ofrece SENATI?\"}"
```

#### GET /api/config
Configuración del sistema
```bash
curl http://localhost:8000/api/config
```

#### GET /health
Health check
```bash
curl http://localhost:8000/health
```

#### POST /api/porcupine/start
Inicia detección continua de palabra clave (flujo completo automático)
```bash
curl -X POST http://localhost:8000/api/porcupine/start \
  -H "Content-Type: application/json" \
  -d '{"keywordIndex": 0}'
```

**Flujo automático:**
1. 🎤 Escucha continua de palabra clave
2. 🔔 Detecta palabra (ej: "emparedado")
3. 🎙️ Graba comando del usuario (5 segundos)
4. 🔄 Transcribe con Whisper
5. 🤖 Genera respuesta con GPT-4o-mini
6. 💬 Retorna resultado en consola

#### POST /api/porcupine/stop
Detiene detección de palabra clave
```bash
curl -X POST http://localhost:8000/api/porcupine/stop
```

#### GET /api/porcupine/keywords
Lista palabras clave disponibles
```bash
curl http://localhost:8000/api/porcupine/keywords
```

#### GET /api/porcupine/status
Estado de Porcupine
```bash
curl http://localhost:8000/api/porcupine/status
```

## Arquitectura

```
src/
├── config/
│   ├── env.ts              # Configuración con Zod
│   └── mcpRegistry.ts      # Registro MCP
├── controllers/
│   ├── audio.controller.ts # Procesar audio
│   └── chat.controller.ts  # Chat y configuración
├── services/
│   ├── openai.service.ts   # Whisper
│   ├── llm.service.ts      # GPT-4o-mini + RAG
│   ├── vectorStore.service.ts  # ChromaDB
│   └── mcp.service.ts      # MCP Client
├── routes/
│   └── index.ts            # Rutas Express
├── middleware/
│   └── errorHandler.ts     # Manejo de errores
├── scripts/
│   └── loadKnowledgeBase.ts
├── app.ts                  # Express app
└── server.ts               # Entry point
```

## Tecnologías

- **Express.js** + TypeScript
- **OpenAI SDK** (Whisper + GPT-4o-mini)
- **ChromaDB** + LangChain.js (opcional)
- **MCP SDK** (@modelcontextprotocol/sdk) (opcional)
- **Zod** (validación)
- **Multer** (upload de archivos)

## Mapeo Python → Node.js

| Python | Node.js |
|--------|---------|
| FastAPI | Express.js |
| Uvicorn | Node.js HTTP |
| Pydantic Settings | Zod |
| openai (Python) | openai (Node.js) |
| chromadb (Python) | chromadb (Node.js) |
| langchain | @langchain/openai + @langchain/community |
| mcp (Python) | @modelcontextprotocol/sdk |
| python-multipart | multer |

## Notas

- **RAG**: Requiere ChromaDB corriendo localmente o configurar correctamente el path
- **MCP**: Requiere servidores MCP configurados en `data/mcp/servers.json`
- Por defecto, RAG y MCP están deshabilitados para facilitar el inicio rápido
