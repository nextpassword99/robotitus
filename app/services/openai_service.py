import base64
import io
from openai import OpenAI
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)

    async def process_audio(self, audio_data: bytes) -> str:
        """
        Procesa audio y obtiene respuesta de GPT-4o-mini.

        Args:
            audio_data: Audio en formato PCM 16-bit mono

        Returns:
            Respuesta de texto del asistente
        """
        try:
            audio_base64 = base64.b64encode(audio_data).decode("utf-8")

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                modalities=["text", "audio"],
                messages=[
                    {"role": "system",
                        "content": "Eres un asistente de información institucional."},
                    {"role": "user", "content": [
                        {"type": "input_audio", "input_audio": {
                            "data": audio_base64, "format": "wav"}}
                    ]}
                ]
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"Error procesando audio con OpenAI: {e}")
            raise
