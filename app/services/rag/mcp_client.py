import asyncio
import json
import logging
from typing import Dict, List, Optional
from app.core.config import settings
from app.core.mcp_registry import mcp_registry

logger = logging.getLogger(__name__)

class MCPClient:
    """Cliente para Model Context Protocol - Gestiona servidores MCP como tools"""
    
    def __init__(self):
        self.enabled = settings.use_mcp
        self.active_servers: Dict[str, asyncio.subprocess.Process] = {}
        self.available_tools: List[dict] = []
        logger.info(f"✅ MCP Client inicializado (enabled={self.enabled})")
    
    async def initialize_servers(self):
        """Inicializa servidores MCP habilitados"""
        if not self.enabled:
            return
        
        for server_key in settings.mcp_enabled_servers:
            await self.start_server(server_key)
    
    async def start_server(self, server_key: str) -> bool:
        """Inicia un servidor MCP y obtiene sus tools"""
        config = mcp_registry.get_server(server_key)
        if not config or not config.enabled:
            return False
        
        try:
            process = await asyncio.create_subprocess_exec(
                config.command,
                *config.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=config.env
            )
            
            self.active_servers[server_key] = process
            
            # Obtener tools disponibles del servidor
            tools = await self._get_server_tools(server_key)
            if tools:
                self.available_tools.extend(tools)
            
            logger.info(f"✅ Servidor MCP '{config.name}' iniciado con {len(tools)} tools")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error iniciando servidor {server_key}: {e}")
            return False
    
    async def _get_server_tools(self, server_key: str) -> List[dict]:
        """Obtiene la lista de tools de un servidor MCP"""
        try:
            process = self.active_servers[server_key]
            
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list"
            }
            
            process.stdin.write(json.dumps(request).encode() + b'\n')
            await process.stdin.drain()
            
            response_line = await process.stdout.readline()
            response = json.loads(response_line.decode())
            
            if "result" in response and "tools" in response["result"]:
                tools = response["result"]["tools"]
                # Convertir a formato OpenAI tools
                return [self._convert_to_openai_tool(tool, server_key) for tool in tools]
            
            return []
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo tools de {server_key}: {e}")
            return []
    
    def _convert_to_openai_tool(self, mcp_tool: dict, server_key: str) -> dict:
        """Convierte tool MCP a formato OpenAI function calling"""
        return {
            "type": "function",
            "function": {
                "name": f"{server_key}_{mcp_tool['name']}",
                "description": mcp_tool.get("description", ""),
                "parameters": mcp_tool.get("inputSchema", {
                    "type": "object",
                    "properties": {}
                })
            }
        }
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> Optional[str]:
        """Ejecuta un tool MCP"""
        # Extraer server_key del nombre del tool
        parts = tool_name.split("_", 1)
        if len(parts) != 2:
            return None
        
        server_key, actual_tool_name = parts
        
        if server_key not in self.active_servers:
            return None
        
        try:
            process = self.active_servers[server_key]
            
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": actual_tool_name,
                    "arguments": arguments
                }
            }
            
            process.stdin.write(json.dumps(request).encode() + b'\n')
            await process.stdin.drain()
            
            response_line = await process.stdout.readline()
            response = json.loads(response_line.decode())
            
            if "result" in response:
                result = response["result"]
                logger.info(f"✅ Tool {tool_name} ejecutado")
                return json.dumps(result.get("content", []))
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error ejecutando tool {tool_name}: {e}")
            return None
    
    def get_tools(self) -> List[dict]:
        """Retorna lista de tools disponibles en formato OpenAI"""
        return self.available_tools
    
    async def stop_server(self, server_key: str):
        """Detiene un servidor MCP"""
        if server_key in self.active_servers:
            process = self.active_servers[server_key]
            process.terminate()
            await process.wait()
            del self.active_servers[server_key]
            
            # Remover tools del servidor
            self.available_tools = [
                t for t in self.available_tools 
                if not t["function"]["name"].startswith(f"{server_key}_")
            ]
            
            logger.info(f"🛑 Servidor {server_key} detenido")
    
    async def shutdown(self):
        """Detiene todos los servidores activos"""
        for server_key in list(self.active_servers.keys()):
            await self.stop_server(server_key)
        logger.info("🛑 Todos los servidores MCP detenidos")
    
    def list_available_servers(self) -> Dict[str, dict]:
        """Lista servidores disponibles"""
        return {
            k: {
                "name": v.name,
                "enabled": v.enabled,
                "active": k in self.active_servers
            }
            for k, v in mcp_registry.servers.items()
        }
