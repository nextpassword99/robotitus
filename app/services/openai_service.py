from openai import OpenAI
from app.core.config import settings
from app.services.rag.vector_store import VectorStoreService
from app.services.rag.mcp_client import MCPClient
import logging
import json

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
    """Servicio de LLM con RAG y MCP tools usando GPT-4o-mini"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.conversation_history = []
        
        # Inicializar RAG
        self.vector_store = VectorStoreService() if settings.use_rag else None
        
        # Inicializar MCP
        self.mcp_client = MCPClient() if settings.use_mcp else None
        
        logger.info("✅ LLM Service inicializado")
        
        if self.mcp_client:
            import asyncio
            asyncio.create_task(self.mcp_client.connect_all())
    
    async def chat(self, messages: list, use_tools: bool = True) -> dict:
        """Chat con soporte de tools MCP"""
        tools = self.mcp_client.get_tools() if (use_tools and self.mcp_client) else None
        
        params = {
            "model": settings.llm_model,
            "messages": messages
        }
        
        if tools:
            params["tools"] = tools
            params["tool_choice"] = "auto"
        
        response = self.client.chat.completions.create(**params)
        return response.choices[0].message
    
    async def chat_without_tools(self, messages: list) -> dict:
        """Chat sin tools"""
        return await self.chat(messages, use_tools=False)
    
    async def get_response(self, user_message: str) -> str:
        """Obtiene respuesta del LLM con contexto RAG y MCP tools"""
        try:
            # Obtener contexto RAG
            context = ""
            if self.vector_store:
                rag_context = self.vector_store.get_context(user_message)
                if rag_context:
                    context += f"\n\nCONTEXTO SENATI:\n{rag_context}"
            
            # Construir mensaje del sistema
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
            
            messages = [
                {"role": "system", "content": system_message},
                *self.conversation_history
            ]
            
            logger.info(f"🤖 Consultando {settings.llm_model}...")
            
            # Primera llamada con tools
            response_message = await self.chat(messages)
            
            # Manejar tool calls
            while response_message.tool_calls:
                messages.append(response_message)
                
                for tool_call in response_message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    
                    logger.info(f"🔧 Ejecutando tool: {tool_name}")
                    
                    # Ejecutar tool MCP
                    tool_result = await self.mcp_client.execute_tool(tool_name, tool_args)
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result or "Error ejecutando tool"
                    })
                
                # Llamar nuevamente con resultados de tools
                response_message = await self.chat(messages)
            
            assistant_message = response_message.content
            
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
    
    def load_knowledge_base(self):
        """Carga la base de conocimiento en el vector store"""
        if self.vector_store:
            self.vector_store.load_documents()
