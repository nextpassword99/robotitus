import asyncio
import json
import logging
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.mcp_registry import MCPServerConfig, mcp_registry

logger = logging.getLogger(__name__)


class MCPClient:
    """Cliente para Model Context Protocol con soporte multi-servidor"""

    def __init__(self):
        self.enabled = settings.use_mcp
        self.active_servers: Dict[str, asyncio.subprocess.Process] = {}
        logger.info(f"✅ MCP Client inicializado (enabled={self.enabled})")

    async def start_server(self, server_key: str) -> bool:
        """Inicia un servidor MCP"""
        if not self.enabled:
            return False

        config = mcp_registry.get_server(server_key)
        if not config or not config.enabled:
            logger.warning(f"⚠️ Servidor {server_key} no disponible")
            return False

        try:
            # Preparar entorno
            env = {**config.env}

            # Iniciar proceso
            process = await asyncio.create_subprocess_exec(
                config.command,
                *config.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )

            self.active_servers[server_key] = process
            logger.info(f"✅ Servidor MCP '{config.name}' iniciado")
            return True

        except Exception as e:
            logger.error(f"❌ Error iniciando servidor {server_key}: {e}")
            return False

    async def stop_server(self, server_key: str):
        """Detiene un servidor MCP"""
        if server_key in self.active_servers:
            process = self.active_servers[server_key]
            process.terminate()
            await process.wait()
            del self.active_servers[server_key]
            logger.info(f"🛑 Servidor {server_key} detenido")

    async def call_tool(self, server_key: str, tool_name: str, params: dict) -> Optional[dict]:
        """Llama a una herramienta de un servidor MCP"""
        if not self.enabled or server_key not in self.active_servers:
            return None

        try:
            process = self.active_servers[server_key]

            # Preparar request JSON-RPC
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": params
                }
            }

            # Enviar request
            process.stdin.write(json.dumps(request).encode() + b'\n')
            await process.stdin.drain()

            # Leer respuesta
            response_line = await process.stdout.readline()
            response = json.loads(response_line.decode())

            if "result" in response:
                logger.info(f"✅ Tool {tool_name} ejecutado en {server_key}")
                return response["result"]
            else:
                logger.error(
                    f"❌ Error en tool {tool_name}: {response.get('error')}")
                return None

        except Exception as e:
            logger.error(f"❌ Error llamando tool {tool_name}: {e}")
            return None

    async def get_context(self, query: str, servers: List[str] = None) -> dict:
        """Obtiene contexto desde múltiples servidores MCP"""
        if not self.enabled:
            return {}

        servers = servers or list(mcp_registry.get_enabled_servers().keys())
        context = {}

        for server_key in servers:
            if server_key not in self.active_servers:
                await self.start_server(server_key)

            # Llamar a herramienta de búsqueda/contexto según servidor
            result = await self.call_tool(
                server_key,
                "search" if server_key == "wikipedia" else "get_context",
                {"query": query}
            )

            if result:
                context[server_key] = result

        return context

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
