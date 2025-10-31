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

Luego abre tu navegador en: **http://localhost:8000**

Luego abre tu navegador en: **http://localhost:8000**

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

#### Interfaz Web Porcupine
Abre http://localhost:8000 en tu navegador para:
1. Seleccionar palabra clave (emparedado, leopardo, manzana, murciélago)
2. Iniciar detección continua
3. Hablar la palabra clave
4. El sistema graba 5 segundos automáticamente
5. Transcribe y genera respuesta

**Flujo automático:**
1. 🎤 Escucha continua de palabra clave en el navegador
2. 🔔 Detecta palabra (ej: "emparedado")
3. 🎙️ Graba comando del usuario (5 segundos)
4. 📤 Envía audio al servidor
5. 🔄 Transcribe con Whisper
6. 🤖 Genera respuesta con GPT-4o-mini
7. 💬 Muestra resultado en pantalla

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
