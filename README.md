# SENATI Assistant API - Node.js

Sistema de asistencia conversacional para SENATI con RAG (Retrieval-Augmented Generation) usando ChromaDB y soporte MCP multi-servidor.

## Características

- 🎤 **Reconocimiento de voz** con Whisper
- 🔊 **Síntesis de voz** con OpenAI TTS
- 🎙️ **Grabación de audio** en el navegador
- 🔄 **Flujo automático**: Grabación → Transcripción → LLM → Respuesta → Audio
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
USE_RAG=false
USE_MCP=false
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

#### Interfaz Web
Abre http://localhost:8000 en tu navegador para:
1. Presionar el micrófono para grabar
2. Hablar tu pregunta
3. Presionar de nuevo para detener
4. El sistema transcribe y genera respuesta

**Flujo automático:**
1. 🎙️ Usuario presiona micrófono y habla
2. 📤 Audio se envía al servidor
3. 🔄 Transcribe con Whisper
4. 🤖 Genera respuesta con GPT-4o-mini
5. 💬 Muestra resultado en pantalla

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
