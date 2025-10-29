from openai import OpenAI
from app.core.config import settings
from app.services.rag.vector_store import VectorStoreService
from app.services.rag.mcp_client import MCPClient
import logging

logger = logging.getLogger(__name__)

class SpeechRecognitionService:
    """Servicio de reconocimiento de voz usando Whisper de OpenAI"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        logger.info("✅ Speech Recognition Service inicializado")
    
    async def transcribe(self, audio_data: bytes) -> str:
        """Transcribe audio a texto usando Whisper"""
        try:
            logger.info(f"🎤 Transcribiendo audio ({len(audio_data)} bytes)...")
            
            response = self.client.audio.transcriptions.create(
                model=settings.whisper_model,
                file=("audio.wav", audio_data, "audio/wav")
            )
            
            text = response.text
            logger.info(f"✅ Transcripción: {text}")
            return text
            
        except Exception as e:
            logger.error(f"❌ Error transcribiendo: {e}")
            raise


class LLMService:
    """Servicio de LLM con RAG usando GPT-4o-mini de OpenAI"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.conversation_history = []
        
        # Inicializar RAG si está habilitado
        self.vector_store = VectorStoreService() if settings.use_rag else None
        self.mcp_client = MCPClient() if settings.use_mcp else None
        
        logger.info("✅ LLM Service inicializado")
    
    async def get_response(self, user_message: str) -> str:
        """Obtiene respuesta del LLM con contexto RAG"""
        try:
            # Obtener contexto RAG
            context = ""
            if self.vector_store:
                rag_context = self.vector_store.get_context(user_message)
                if rag_context:
                    context += f"\n\nCONTEXTO SENATI:\n{rag_context}"
            
            # Obtener contexto MCP
            if self.mcp_client:
                mcp_context = await self.mcp_client.get_context(user_message)
                if mcp_context:
                    context += f"\n\nCONTEXTO ADICIONAL:\n{mcp_context.get('context', '')}"
            
            # Construir mensaje con contexto
            system_message = """Eres un asistente virtual de SENATI (Servicio Nacional de Adiestramiento en Trabajo Industrial).
Tu función es ayudar a estudiantes, postulantes y público en general con información sobre:
- Carreras técnicas y programas de formación
- Proceso de admisión y matrícula
- Sedes y horarios
- Costos y becas
- Certificaciones

Responde de forma clara, precisa y amigable. Si no tienes información específica, indícalo."""

            if context:
                system_message += f"\n\nUsa la siguiente información para responder:{context}"
            
            self.conversation_history.append({
                "role": "user",
                "content": user_message
            })
            
            logger.info(f"🤖 Consultando {settings.llm_model}...")
            
            response = self.client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": system_message},
                    *self.conversation_history
                ]
            )
            
            assistant_message = response.choices[0].message.content
            
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message
            })
            
            # Log en MCP
            if self.mcp_client:
                await self.mcp_client.log_interaction(user_message, assistant_message)
            
            logger.info(f"✅ Respuesta: {assistant_message[:100]}...")
            return assistant_message
            
        except Exception as e:
            logger.error(f"❌ Error en LLM: {e}")
            raise
    
    def reset_conversation(self):
        """Reinicia el historial de conversación"""
        self.conversation_history = []
        logger.info("🔄 Conversación reiniciada")
    
    def load_knowledge_base(self):
        """Carga la base de conocimiento en el vector store"""
        if self.vector_store:
            self.vector_store.load_documents()
