from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import os
import json
import re
from pathlib import Path


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

    def __init__(self, config_file: str = "data/mcp/servers.json"):
        self.servers: Dict[str, MCPServerConfig] = {}
        self._load_from_json(config_file)
    
    def _resolve_env_vars(self, value: Any) -> Any:
        """Resuelve variables de entorno recursivamente"""
        if isinstance(value, str):
            # Reemplazar ${VAR_NAME} con el valor de la variable
            return re.sub(r'\$\{([^}]+)\}', lambda m: os.getenv(m.group(1), ""), value)
        elif isinstance(value, dict):
            return {k: self._resolve_env_vars(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._resolve_env_vars(item) for item in value]
        return value
    
    def _load_from_json(self, config_file: str):
        """Carga servidores desde JSON"""
        config_path = Path(config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                data = json.load(f)
                for key, server_data in data.items():
                    resolved_data = self._resolve_env_vars(server_data)
                    self.servers[key] = MCPServerConfig(**resolved_data)

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
