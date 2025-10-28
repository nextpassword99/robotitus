import numpy as np
from app.core.config import settings

class SilenceDetector:
    def __init__(self):
        self.threshold = settings.silence_threshold
        self.silence_chunks_needed = int(settings.silence_duration * settings.sample_rate / 1280)
        self.silence_count = 0
    
    def is_silence(self, audio_chunk: bytes) -> bool:
        """Detecta si el chunk de audio es silencio basado en energía RMS"""
        audio_array = np.frombuffer(audio_chunk, dtype=np.int16)
        rms = np.sqrt(np.mean(audio_array**2))
        return rms < self.threshold
    
    def check_silence_end(self, audio_chunk: bytes) -> bool:
        """Retorna True si se detectó el final del habla (silencio prolongado)"""
        if self.is_silence(audio_chunk):
            self.silence_count += 1
        else:
            self.silence_count = 0
        
        return self.silence_count >= self.silence_chunks_needed
    
    def reset(self):
        """Reinicia el contador de silencio"""
        self.silence_count = 0
