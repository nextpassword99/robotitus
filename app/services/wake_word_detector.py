import numpy as np
from openwakeword.model import Model
from app.core.config import settings
import logging
from scipy import signal

logger = logging.getLogger(__name__)

class WakeWordDetector:
    def __init__(self):
        logger.info(f"🔧 Inicializando detector con modelo: {settings.wake_word_model}")
        self.model = Model(
            wakeword_models=[settings.wake_word_model],
            inference_framework='onnx'
        )
        self.threshold = settings.detection_threshold
        self.buffer = np.array([], dtype=np.float32)
        self.melspec_buffer = []
        logger.info(f"✅ Detector inicializado (threshold: {self.threshold})")
    
    def detect(self, audio_chunk: bytes) -> tuple[bool, float]:
        """
        Detecta wake word en chunk de audio.
        
        Args:
            audio_chunk: Audio en formato PCM 16-bit mono
            
        Returns:
            (detected, confidence): Tupla con detección y confianza
        """
        try:
            audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
            
            if len(audio_array) == 0:
                return False, 0.0
            
            # Resample de 48kHz a 16kHz
            num_samples_16k = int(len(audio_array) * 16000 / 48000)
            resampled = signal.resample(audio_array, num_samples_16k)
            
            # Normalizar a float32 [-1, 1]
            audio_float = resampled.astype(np.float32) / 32768.0
            
            # Acumular en buffer
            self.buffer = np.append(self.buffer, audio_float)
            
            # OpenWakeWord necesita frames de 1280 samples (80ms a 16kHz)
            frame_size = 1280
            
            if len(self.buffer) >= frame_size:
                frame = self.buffer[:frame_size]
                self.buffer = self.buffer[frame_size:]
                
                # Predecir
                prediction = self.model.predict(frame)
                
                confidence = prediction.get(settings.wake_word_model, 0.0)
                detected = confidence >= self.threshold
                
                return detected, float(confidence)
            
            return False, 0.0
            
        except Exception as e:
            logger.error(f"❌ Error en detección: {e}", exc_info=True)
            return False, 0.0
    
    def reset(self):
        """Reinicia el estado del detector"""
        self.model.reset()
        self.buffer = np.array([], dtype=np.float32)
