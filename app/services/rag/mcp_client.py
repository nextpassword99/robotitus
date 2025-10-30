import logging
from typing import Dict, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from app.core.config import settings
from app.core.mcp_registry import mcp_registry

logger = logging.getLogger(__name__)

class MCPServerConnection:
    """Conexión a un servidor MCP individual"""
    
    def __init__(self, server_key: str, config):
        self.server_key = server_key
        self.config = config
        self.session: Optional[ClientSession] = None
        self.context_manager = None
    
    async def connect(self):
        """Conecta al servidor MCP"""
        server_params = StdioServerParameters(
            command=self.config.command,
            args=self.config.args,
            env=self.config.env
        )
        
        self.context_manager = stdio_client(server_params)
        read_stream, write_stream = await self.context_manager.__aenter__()
        self.session = ClientSession(read_stream, write_stream)
        
        await self.session.initialize()
        logger.info(f"✅ Conectado a servidor MCP: {self.config.name}")
    
    async def get_tools(self) -> List[dict]:
        """Obtiene tools del servidor en formato OpenAI"""
        if not self.session:
            return []
        
        result = await self.session.list_tools()
        
        return [
            {
                "type": "function",
                "function": {
                    "name": f"{self.server_key}_{tool.name}",
                    "description": tool.description or "",
                    "parameters": tool.inputSchema
                }
            }
            for tool in result.tools
        ]
    
    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """Llama a un tool del servidor"""
        if not self.session:
            return ""
        
        result = await self.session.call_tool(tool_name, arguments)
        
        # Extraer texto de los contenidos
        return "\n".join(
            item.text for item in result.content 
            if hasattr(item, 'text')
        )
    
    async def close(self):
        """Cierra la conexión"""
        if self.context_manager:
            await self.context_manager.__aexit__(None, None, None)
        logger.info(f"🛑 Desconectado de: {self.config.name}")


class MCPClient:
    """Cliente para Model Context Protocol - Gestiona múltiples servidores MCP"""
    
    def __init__(self):
        self.enabled = settings.use_mcp
        self.connections: Dict[str, MCPServerConnection] = {}
        self.available_tools: List[dict] = []
        logger.info(f"✅ MCP Client inicializado (enabled={self.enabled})")
    
    async def initialize_servers(self):
        """Inicializa servidores MCP habilitados"""
        if not self.enabled:
            return
        
        for server_key in mcp_registry.get_enabled_servers().keys():
            await self.start_server(server_key)
    
    async def start_server(self, server_key: str) -> bool:
        """Inicia un servidor MCP y obtiene sus tools"""
        config = mcp_registry.get_server(server_key)
        if not config:
            logger.error(f"❌ Servidor '{server_key}' no encontrado en configuración")
            return False
        
        if not config.enabled:
            logger.info(f"⏭️ Servidor '{server_key}' deshabilitado, omitiendo...")
            return False
        
        try:
            connection = MCPServerConnection(server_key, config)
            await connection.connect()
            
            tools = await connection.get_tools()
            self.available_tools.extend(tools)
            
            self.connections[server_key] = connection
            
            logger.info(f"✅ Servidor '{config.name}' iniciado con {len(tools)} tools")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error iniciando servidor '{server_key}': {e}")
            return False
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> Optional[str]:
        """Ejecuta un tool MCP"""
        # Extraer server_key del nombre del tool
        parts = tool_name.split("_", 1)
        if len(parts) != 2:
            return None
        
        server_key, actual_tool_name = parts
        
        if server_key not in self.connections:
            logger.warning(f"⚠️ Servidor {server_key} no conectado")
            return None
        
        try:
            connection = self.connections[server_key]
            result = await connection.call_tool(actual_tool_name, arguments)
            logger.info(f"✅ Tool {tool_name} ejecutado")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error ejecutando tool {tool_name}: {e}")
            return None
    
    def get_tools(self) -> List[dict]:
        """Retorna lista de tools disponibles en formato OpenAI"""
        return self.available_tools
    
    async def stop_server(self, server_key: str):
        """Detiene un servidor MCP"""
        if server_key in self.connections:
            connection = self.connections[server_key]
            await connection.close()
            del self.connections[server_key]
            
            # Remover tools del servidor
            self.available_tools = [
                t for t in self.available_tools 
                if not t["function"]["name"].startswith(f"{server_key}_")
            ]
            
            logger.info(f"🛑 Servidor {server_key} detenido")
    
    async def shutdown(self):
        """Detiene todos los servidores activos"""
        for server_key in list(self.connections.keys()):
            await self.stop_server(server_key)
        logger.info("🛑 Todos los servidores MCP detenidos")
    
    def list_available_servers(self) -> Dict[str, dict]:
        """Lista servidores disponibles"""
        return {
            k: {
                "name": v.name,
                "enabled": v.enabled,
                "active": k in self.connections
            }
            for k, v in mcp_registry.servers.items()
        }
