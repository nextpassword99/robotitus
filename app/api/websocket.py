from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.wake_word_detector import WakeWordDetector
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/ws/audio")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    detector = WakeWordDetector()
    
    try:
        logger.info("Cliente ESP32 conectado")
        
        while True:
            audio_chunk = await websocket.receive_bytes()
            
            detected, confidence = detector.detect(audio_chunk)
            
            if detected:
                logger.info(f"Wake word detectado! Confianza: {confidence:.2f}")
                await websocket.send_json({
                    "detected": True,
                    "confidence": confidence
                })
                detector.reset()
            
    except WebSocketDisconnect:
        logger.info("Cliente desconectado")
    except Exception as e:
        logger.error(f"Error: {e}")
        await websocket.close()
