import logging
import asyncio
from typing import Dict, List, Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from app.core.config import settings
from app.core.mcp_registry import mcp_registry

logger = logging.getLogger(__name__)


class MCPClient:
    """Cliente para Model Context Protocol - Gestiona múltiples servidores MCP"""
    
    def __init__(self):
        self.enabled = settings.use_mcp
        self.clients: Dict[str, ClientSession] = {}
        self.transports: Dict[str, any] = {}
        self.tool_to_server: Dict[str, str] = {}
        self.available_tools: List[dict] = []
        logger.info(f"✅ MCP Client creado (enabled={self.enabled})")
    
    async def connect_all(self):
        """Conecta a todos los servidores MCP habilitados"""
        if not self.enabled:
            logger.info("MCP deshabilitado")
            return
        
        enabled_servers = mcp_registry.get_enabled_servers()
        if not enabled_servers:
            logger.warning("No hay servidores MCP habilitados")
            return
        
        for server_key, config in enabled_servers.items():
            try:
                logger.info(f"🔌 Conectando a {server_key}...")
                
                server_params = StdioServerParameters(
                    command=config.command,
                    args=config.args,
                    env=config.env
                )
                
                transport = stdio_client(server_params)
                read, write = await transport.__aenter__()
                
                client = ClientSession(read, write)
                await client.initialize()
                
                self.clients[server_key] = client
                self.transports[server_key] = transport
                
                result = await client.list_tools()
                exclude_tools = config.exclude_tools or []
                filtered_tools = [t for t in result.tools if t.name not in exclude_tools]
                
                logger.info(f"📋 {server_key}: {len(filtered_tools)} herramientas")
                
                for tool in filtered_tools:
                    self.tool_to_server[tool.name] = server_key
                    self.available_tools.append({
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description or "",
                            "parameters": tool.inputSchema
                        }
                    })
                
                logger.info(f"✅ {server_key} conectado")
                
            except Exception as e:
                logger.error(f"❌ Error conectando {server_key}: {e}")
        
        logger.info(f"🛠️  Total herramientas: {len(self.available_tools)}")
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> Optional[str]:
        """Ejecuta un tool MCP"""
        server_key = self.tool_to_server.get(tool_name)
        if not server_key:
            logger.error(f"Tool {tool_name} no encontrado")
            return None
        
        client = self.clients.get(server_key)
        if not client:
            logger.error(f"Cliente {server_key} no conectado")
            return None
        
        try:
            result = await client.call_tool(tool_name, arguments)
            return "\n".join(
                item.text for item in result.content 
                if hasattr(item, 'text')
            )
        except Exception as e:
            logger.error(f"❌ Error ejecutando {tool_name}: {e}")
            return None
    
    def get_tools(self) -> List[dict]:
        """Retorna lista de tools disponibles en formato OpenAI"""
        return self.available_tools
    
    async def shutdown(self):
        """Detiene todos los servidores activos"""
        for server_key, transport in self.transports.items():
            try:
                await transport.__aexit__(None, None, None)
                logger.info(f"🛑 {server_key} desconectado")
            except Exception as e:
                logger.error(f"Error cerrando {server_key}: {e}")
        
        self.clients.clear()
        self.transports.clear()
        self.tool_to_server.clear()
        self.available_tools.clear()
    
    def list_available_servers(self) -> Dict[str, dict]:
        """Lista servidores disponibles"""
        return {
            k: {
                "name": v.name,
                "enabled": v.enabled,
                "active": k in self.clients
            }
            for k, v in mcp_registry.servers.items()
        }
