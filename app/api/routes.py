from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.openai_service import SpeechRecognitionService, LLMService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

speech_service = SpeechRecognitionService()
llm_service = LLMService()

@router.post("/process-audio")
async def process_audio(audio: UploadFile = File(...)):
    """
    Procesa audio: transcribe con Whisper y genera respuesta con GPT-4o-mini.
    
    Args:
        audio: Archivo de audio (WAV, MP3, etc.)
        
    Returns:
        JSON con transcripción y respuesta del LLM
    """
    try:
        audio_data = await audio.read()
        logger.info(f"📥 Audio recibido: {len(audio_data)} bytes")
        
        # 1. Transcribir
        text = await speech_service.transcribe(audio_data)
        
        # 2. Generar respuesta
        response = await llm_service.get_response(text)
        
        return {
            "transcription": text,
            "response": response
        }
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset-conversation")
async def reset_conversation():
    """Reinicia el historial de conversación"""
    llm_service.reset_conversation()
    return {"status": "ok"}
