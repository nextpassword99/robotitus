from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.wake_word_detector import WakeWordDetector
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
    detector = WakeWordDetector()
    openai_service = OpenAIService()
    
    recording = False
    audio_buffer = []
    chunks_received = 0
    max_chunks = int(settings.recording_duration * settings.sample_rate / 1280)
    
    try:
        logger.info("Cliente ESP32 conectado")
        
        while True:
            audio_chunk = await websocket.receive_bytes()
            
            if not recording:
                detected, confidence = detector.detect(audio_chunk)
                
                if detected:
                    logger.info(f"Wake word detectado! Confianza: {confidence:.2f}")
                    await websocket.send_json({
                        "status": "wake_word_detected",
                        "confidence": confidence
                    })
                    recording = True
                    audio_buffer = []
                    chunks_received = 0
                    detector.reset()
            else:
                audio_buffer.append(audio_chunk)
                chunks_received += 1
                
                if chunks_received >= max_chunks:
                    logger.info("Grabación completa, procesando con GPT...")
                    
                    wav_data = _create_wav(audio_buffer)
                    
                    try:
                        response_text = await openai_service.process_audio(wav_data)
                        await websocket.send_json({
                            "status": "response",
                            "text": response_text
                        })
                        logger.info(f"Respuesta enviada: {response_text}")
                    except Exception as e:
                        await websocket.send_json({
                            "status": "error",
                            "message": str(e)
                        })
                    
                    recording = False
                    audio_buffer = []
            
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
