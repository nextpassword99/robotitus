from openai import OpenAI
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class SpeechRecognitionService:
    """Servicio de reconocimiento de voz usando Whisper de OpenAI"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        logger.info("✅ Speech Recognition Service inicializado")
    
    async def transcribe(self, audio_data: bytes) -> str:
        """
        Transcribe audio a texto usando Whisper.
        
        Args:
            audio_data: Audio en formato WAV
            
        Returns:
            Texto transcrito
        """
        try:
            logger.info(f"🎤 Transcribiendo audio ({len(audio_data)} bytes)...")
            
            response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=("audio.wav", audio_data, "audio/wav")
            )
            
            text = response.text
            logger.info(f"✅ Transcripción: {text}")
            return text
            
        except Exception as e:
            logger.error(f"❌ Error transcribiendo: {e}")
            raise


class LLMService:
    """Servicio de LLM usando GPT-4o-mini de OpenAI"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.conversation_history = []
        logger.info("✅ LLM Service inicializado")
    
    async def get_response(self, user_message: str) -> str:
        """
        Obtiene respuesta del LLM.
        
        Args:
            user_message: Mensaje del usuario
            
        Returns:
            Respuesta del asistente
        """
        try:
            self.conversation_history.append({
                "role": "user",
                "content": user_message
            })
            
            logger.info(f"🤖 Consultando GPT-4o-mini...")
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Eres un asistente de información institucional. Responde de forma clara y concisa."
                    },
                    *self.conversation_history
                ]
            )
            
            assistant_message = response.choices[0].message.content
            
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message
            })
            
            logger.info(f"✅ Respuesta: {assistant_message[:100]}...")
            return assistant_message
            
        except Exception as e:
            logger.error(f"❌ Error en LLM: {e}")
            raise
    
    def reset_conversation(self):
        """Reinicia el historial de conversación"""
        self.conversation_history = []
        logger.info("🔄 Conversación reiniciada")
