from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.wake_word_detector import WakeWordDetector
from app.services.silence_detector import SilenceDetector
from app.services.openai_service import OpenAIService
from app.core.config import settings
import logging
import io
import wave

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/ws/audio")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    wake_detector = WakeWordDetector()
    silence_detector = SilenceDetector()
    openai_service = OpenAIService()
    
    listening = False
    audio_buffer = []
    
    try:
        logger.info("Cliente conectado")
        
        while True:
            audio_chunk = await websocket.receive_bytes()
            
            if not listening:
                detected, confidence = wake_detector.detect(audio_chunk)
                
                if detected:
                    logger.info(f"🎤 Alexa activada! (confianza: {confidence:.2f})")
                    await websocket.send_json({
                        "status": "listening",
                        "message": "Alexa activada, escuchando..."
                    })
                    listening = True
                    audio_buffer = [audio_chunk]
                    silence_detector.reset()
                    wake_detector.reset()
            else:
                audio_buffer.append(audio_chunk)
                
                if silence_detector.check_silence_end(audio_chunk):
                    logger.info("🔇 Silencio detectado, procesando...")
                    
                    wav_data = _create_wav(audio_buffer)
                    
                    try:
                        response_text = await openai_service.process_audio(wav_data)
                        await websocket.send_json({
                            "status": "response",
                            "text": response_text
                        })
                        logger.info(f"✅ Respuesta: {response_text}")
                    except Exception as e:
                        logger.error(f"❌ Error: {e}")
                        await websocket.send_json({
                            "status": "error",
                            "message": str(e)
                        })
                    
                    listening = False
                    audio_buffer = []
                    silence_detector.reset()
            
    except WebSocketDisconnect:
        logger.info("Cliente desconectado")
    except Exception as e:
        logger.error(f"Error: {e}")
        await websocket.close()

def _create_wav(audio_chunks: list[bytes]) -> bytes:
    """Convierte chunks PCM a formato WAV"""
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(settings.sample_rate)
        wav.writeframes(b''.join(audio_chunks))
    return buffer.getvalue()
