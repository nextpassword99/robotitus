import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { env } from '../config/env.js';
import { mcpRegistry } from '../config/mcpRegistry.js';

export class MCPService {
  private enabled: boolean;
  private clients = new Map<string, Client>();
  private transports = new Map<string, StdioClientTransport>();
  private toolToServer = new Map<string, string>();
  private availableTools: any[] = [];

  constructor() {
    this.enabled = env.USE_MCP;
    console.log(`✅ MCP Service creado (enabled=${this.enabled})`);
  }

  async connectAll() {
    if (!this.enabled) return console.log('MCP deshabilitado');
    const enabledServers = mcpRegistry.getEnabledServers();
    if (enabledServers.size === 0) return console.warn('No hay servidores MCP habilitados');

    for (const [serverKey, config] of enabledServers) {
      try {
        console.log(`🔌 Conectando a ${serverKey}...`);
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: Object.fromEntries(Object.entries({ ...process.env, ...config.env }).filter(([, value]) => value !== undefined)) as Record<string, string>
        });
        const client = new Client({ name: 'senati-assistant', version: '1.0.0' }, { capabilities: {} });
        await client.connect(transport);
        this.clients.set(serverKey, client);
        this.transports.set(serverKey, transport);

        const result = await client.listTools();
        const filteredTools = result.tools.filter(t => !config.exclude_tools.includes(t.name));
        console.log(`📋 ${serverKey}: ${filteredTools.length} herramientas`);

        for (const tool of filteredTools) {
          this.toolToServer.set(tool.name, serverKey);
          this.availableTools.push({
            type: 'function',
            function: { name: tool.name, description: tool.description || '', parameters: tool.inputSchema }
          });
        }
        console.log(`✅ ${serverKey} conectado`);
      } catch (error) {
        console.error(`❌ Error conectando ${serverKey}:`, error);
      }
    }
    console.log(`🛠️  Total herramientas: ${this.availableTools.length}`);
  }

  async executeTool(toolName: string, args: any): Promise<string | null> {
    const serverKey = this.toolToServer.get(toolName);
    if (!serverKey) return console.error(`Tool ${toolName} no encontrado`), null;
    const client = this.clients.get(serverKey);
    if (!client) return console.error(`Cliente ${serverKey} no conectado`), null;
    try {
      const result = await client.callTool({ name: toolName, arguments: args });
      return (result.content as Array<{ type: string; text: string }>).filter((i) => i.type === 'text').map((i) => i.text).join('\n');
    } catch (error) {
      return console.error(`❌ Error ejecutando ${toolName}:`, error), null;
    }
  }

  getTools() { return this.availableTools; }

  async shutdown() {
    for (const [serverKey, client] of this.clients) {
      try {
        await client.close();
        console.log(`🛑 ${serverKey} desconectado`);
      } catch (error) {
        console.error(`Error cerrando ${serverKey}:`, error);
      }
    }
    this.clients.clear();
    this.transports.clear();
    this.toolToServer.clear();
    this.availableTools = [];
  }

  listAvailableServers() {
    const servers: Record<string, any> = {};
    for (const [key, config] of mcpRegistry.getAllServers()) {
      servers[key] = { name: config.name, enabled: config.enabled, active: this.clients.has(key) };
    }
    return servers;
  }
}
