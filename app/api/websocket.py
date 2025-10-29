from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.silence_detector import SilenceDetector
from app.services.openai_service import SpeechRecognitionService, LLMService
from app.core.config import settings
import logging
import io
import wave

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/ws/audio")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    silence_detector = SilenceDetector()
    speech_service = SpeechRecognitionService()
    llm_service = LLMService()
    
    audio_buffer = []
    chunk_count = 0
    
    try:
        logger.info("✅ Cliente conectado - Esperando audio...")
        await websocket.send_json({"status": "ready"})
        
        while True:
            audio_chunk = await websocket.receive_bytes()
            chunk_count += 1
            audio_buffer.append(audio_chunk)
            
            if chunk_count % 50 == 0:
                logger.info(f"📊 Chunks: {chunk_count} | Buffer: {len(audio_buffer)}")
            
            if silence_detector.check_silence_end(audio_chunk):
                logger.info(f"🔇 Silencio detectado, procesando {len(audio_buffer)} chunks...")
                
                wav_data = _create_wav(audio_buffer)
                
                try:
                    # 1. Transcribir audio a texto
                    text = await speech_service.transcribe(wav_data)
                    await websocket.send_json({
                        "status": "transcribed",
                        "text": text
                    })
                    
                    # 2. Obtener respuesta del LLM
                    response = await llm_service.get_response(text)
                    await websocket.send_json({
                        "status": "response",
                        "text": response
                    })
                    
                except Exception as e:
                    logger.error(f"❌ Error: {e}")
                    await websocket.send_json({
                        "status": "error",
                        "message": str(e)
                    })
                
                audio_buffer = []
                silence_detector.reset()
            
    except WebSocketDisconnect:
        logger.info(f"❌ Cliente desconectado")
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        await websocket.close()

def _create_wav(audio_chunks: list[bytes]) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(settings.sample_rate)
        wav.writeframes(b''.join(audio_chunks))
    return buffer.getvalue()
