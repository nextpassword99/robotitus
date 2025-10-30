from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.openai_service import SpeechRecognitionService, LLMService
from app.core.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

speech_service = SpeechRecognitionService()
llm_service = LLMService()

@router.post("/process-audio")
async def process_audio(audio: UploadFile = File(...)):
    """Procesa audio: transcribe con Whisper y genera respuesta con GPT-4o-mini + RAG"""
    try:
        audio_data = await audio.read()
        logger.info(f"📥 Audio recibido: {len(audio_data)} bytes")
        
        text = await speech_service.transcribe(audio_data)
        response = await llm_service.get_response(text)
        
        return {
            "transcription": text,
            "response": response,
            "rag_enabled": settings.use_rag,
            "mcp_enabled": settings.use_mcp
        }
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(message: dict):
    """Endpoint de chat directo (sin audio)"""
    try:
        text = message.get("text")
        if not text:
            raise HTTPException(status_code=400, detail="Campo 'text' requerido")
        
        response = await llm_service.get_response(text)
        
        return {
            "response": response,
            "rag_enabled": settings.use_rag
        }
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset-conversation")
async def reset_conversation():
    """Reinicia el historial de conversación"""
    llm_service.reset_conversation()
    return {"status": "ok"}

@router.post("/load-knowledge-base")
async def load_knowledge_base():
    """Carga/recarga la base de conocimiento en el vector store"""
    if not settings.use_rag:
        raise HTTPException(status_code=400, detail="RAG no está habilitado")
    
    try:
        llm_service.load_knowledge_base()
        return {"status": "ok", "message": "Base de conocimiento cargada"}
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
async def get_config():
    """Retorna la configuración actual del sistema"""
    return {
        "app_name": settings.app_name,
        "rag_enabled": settings.use_rag,
        "mcp_enabled": settings.use_mcp,
        "llm_model": settings.llm_model,
        "embedding_model": settings.embedding_model,
        "collection_name": settings.collection_name
    }

@router.get("/mcp/status")
async def mcp_status():
    """Estado de servidores MCP"""
    if not settings.use_mcp or not llm_service.mcp_client:
        return {"enabled": False}
    
    tools = llm_service.mcp_client.get_tools()
    servers = llm_service.mcp_client.list_available_servers()
    
    return {
        "enabled": True,
        "servers": servers,
        "tools_count": len(tools),
        "tools": [t["function"]["name"] for t in tools]
    }
