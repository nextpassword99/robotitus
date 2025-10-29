import base64
import io
from openai import OpenAI
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self):
        logger.info("🔧 Inicializando cliente OpenAI...")
        self.client = OpenAI(api_key=settings.openai_api_key)
        logger.info("✅ Cliente OpenAI inicializado")

    async def process_audio(self, audio_data: bytes) -> str:
        """
        Procesa audio y obtiene respuesta de GPT-4o-mini.

        Args:
            audio_data: Audio en formato PCM 16-bit mono

        Returns:
            Respuesta de texto del asistente
        """
        try:
            logger.info(f"📦 Codificando audio a base64... ({len(audio_data)} bytes)")
            audio_base64 = base64.b64encode(audio_data).decode("utf-8")
            logger.info(f"✅ Audio codificado ({len(audio_base64)} caracteres)")

            logger.info("🚀 Enviando request a GPT-4o-mini...")
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                modalities=["text", "audio"],
                audio={"voice": "alloy", "format": "wav"},
                messages=[
                    {
                        "role": "system",
                        "content": "Eres un asistente de información institucional."
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_audio",
                                "audio_url": f"data:audio/wav;base64,{audio_base64}"
                            }
                        ]
                    }
                ]
            )

            logger.info("✅ Respuesta recibida de OpenAI")
            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"❌ Error procesando audio con OpenAI: {e}", exc_info=True)
            raise
