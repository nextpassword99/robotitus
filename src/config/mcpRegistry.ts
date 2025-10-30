import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MCPServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  exclude_tools: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

class MCPRegistry {
  private servers = new Map<string, MCPServerConfig>();

  constructor(configFile = './data/mcp/servers.json') {
    this.loadFromJson(configFile);
  }

  private resolveEnvVars(value: any): any {
    if (typeof value === 'string') {
      return value.replace(/\$\{([^}]+)\}/g, (_, v) => process.env[v] || '');
    }
    if (Array.isArray(value)) return value.map(i => this.resolveEnvVars(i));
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.resolveEnvVars(v)]));
    }
    return value;
  }

  private loadFromJson(configFile: string): void {
    const path = resolve(configFile);
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      for (const [key, serverData] of Object.entries(data)) {
        this.servers.set(key, MCPServerConfigSchema.parse(this.resolveEnvVars(serverData)));
      }
    }
  }

  getServer(name: string) { return this.servers.get(name); }
  getEnabledServers() { return new Map([...this.servers].filter(([_, c]) => c.enabled)); }
  getAllServers() { return this.servers; }
  addServer(key: string, config: MCPServerConfig) { this.servers.set(key, config); }
  disableServer(name: string) { const s = this.servers.get(name); if (s) s.enabled = false; }
  enableServer(name: string) { const s = this.servers.get(name); if (s) s.enabled = true; }
}

export const mcpRegistry = new MCPRegistry();
