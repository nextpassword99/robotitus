import numpy as np
from openwakeword.model import Model
from app.core.config import settings

class WakeWordDetector:
    def __init__(self):
        self.model = Model(
            wakeword_models=[settings.wake_word_model],
            inference_framework='onnx'
        )
        self.threshold = settings.detection_threshold
    
    def detect(self, audio_chunk: bytes) -> tuple[bool, float]:
        """
        Detecta wake word en chunk de audio.
        
        Args:
            audio_chunk: Audio en formato PCM 16-bit mono
            
        Returns:
            (detected, confidence): Tupla con detección y confianza
        """
        audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
        prediction = self.model.predict(audio_array)
        
        confidence = prediction.get(settings.wake_word_model, 0.0)
        detected = confidence >= self.threshold
        
        return detected, float(confidence)
    
    def reset(self):
        """Reinicia el estado del detector"""
        self.model.reset()
