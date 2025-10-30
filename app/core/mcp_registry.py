from typing import Dict, List, Optional
from pydantic import BaseModel
import os


class MCPServerConfig(BaseModel):
    """Configuración de un servidor MCP"""
    name: str
    command: str
    args: List[str] = []
    env: Dict[str, str] = {}
    exclude_tools: List[str] = []
    enabled: bool = True


class MCPRegistry:
    """Registro de servidores MCP disponibles"""

    def __init__(self):
        self.servers: Dict[str, MCPServerConfig] = {
            "serper": MCPServerConfig(
                name="serper-mcp",
                command="uvx",
                args=["serper-mcp-server"],
                env={
                    "SERPER_API_KEY": os.getenv("SERPER_API_KEY", "")
                }
            ),
        }

    def get_server(self, name: str) -> Optional[MCPServerConfig]:
        """Obtiene configuración de un servidor"""
        return self.servers.get(name)

    def get_enabled_servers(self) -> Dict[str, MCPServerConfig]:
        """Obtiene todos los servidores habilitados"""
        return {k: v for k, v in self.servers.items() if v.enabled}

    def add_server(self, key: str, config: MCPServerConfig):
        """Agrega un nuevo servidor al registro"""
        self.servers[key] = config

    def disable_server(self, name: str):
        """Deshabilita un servidor"""
        if name in self.servers:
            self.servers[name].enabled = False

    def enable_server(self, name: str):
        """Habilita un servidor"""
        if name in self.servers:
            self.servers[name].enabled = True


# Instancia global del registro
mcp_registry = MCPRegistry()
