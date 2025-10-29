from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.wake_word_detector import WakeWordDetector
from app.services.silence_detector import SilenceDetector
from app.services.openai_service import OpenAIService
from app.core.config import settings
import logging
import io
import wave
import time

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
    chunk_count = 0
    start_time = time.time()
    
    try:
        logger.info("✅ Cliente conectado")
        
        while True:
            audio_chunk = await websocket.receive_bytes()
            chunk_count += 1
            
            if chunk_count % 50 == 0:
                elapsed = time.time() - start_time
                logger.info(f"📊 Chunks recibidos: {chunk_count} | Tiempo: {elapsed:.1f}s | Estado: {'ESCUCHANDO' if listening else 'ESPERANDO WAKE WORD'}")
            
            if not listening:
                detected, confidence = wake_detector.detect(audio_chunk)
                
                if chunk_count % 10 == 0:
                    logger.info(f"🔍 Wake word confianza: {confidence:.4f} (threshold: {settings.detection_threshold})")
                
                if detected:
                    logger.info(f"🎤 ¡ALEXA ACTIVADA! (confianza: {confidence:.2f})")
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
                is_silent = silence_detector.is_silence(audio_chunk)
                
                if len(audio_buffer) % 20 == 0:
                    logger.info(f"🎙️ Grabando... chunks: {len(audio_buffer)} | Silencio: {silence_detector.silence_count}/{silence_detector.silence_chunks_needed}")
                
                if silence_detector.check_silence_end(audio_chunk):
                    logger.info(f"🔇 Silencio detectado ({silence_detector.silence_count} chunks), procesando {len(audio_buffer)} chunks de audio...")
                    
                    wav_data = _create_wav(audio_buffer)
                    logger.info(f"📦 Audio WAV generado: {len(wav_data)} bytes")
                    
                    try:
                        logger.info("🤖 Enviando a GPT-4o-mini...")
                        response_text = await openai_service.process_audio(wav_data)
                        await websocket.send_json({
                            "status": "response",
                            "text": response_text
                        })
                        logger.info(f"✅ Respuesta recibida: {response_text[:100]}...")
                    except Exception as e:
                        logger.error(f"❌ Error procesando: {e}")
                        await websocket.send_json({
                            "status": "error",
                            "message": str(e)
                        })
                    
                    listening = False
                    audio_buffer = []
                    silence_detector.reset()
            
    except WebSocketDisconnect:
        logger.info(f"❌ Cliente desconectado (procesó {chunk_count} chunks)")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}", exc_info=True)
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
