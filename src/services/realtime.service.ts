import WebSocket from 'ws';
import { env } from '../config/env.js';
import { MCPService } from './mcp.service.js';

export class RealtimeService {
  private openaiWs: WebSocket | null = null;
  private clientWs: WebSocket | null = null;
  private sessionReady = false;
  private mcpService: MCPService | null = null;

  async connect(clientWs: WebSocket, mcpService: MCPService | null = null) {
    this.clientWs = clientWs;
    this.mcpService = mcpService;
    
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
    this.openaiWs = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    this.openaiWs.on('open', () => {
      console.log('✅ Conectado a OpenAI Realtime API');
    });

    this.openaiWs.on('message', async (data) => {
      const message = data.toString();
      const event = JSON.parse(message);
      console.log('📩 OpenAI:', event.type);
      
      if (event.type === 'session.created' && !this.sessionReady) {
        this.sessionReady = true;
        this.sendSessionUpdate();
      }
      
      // Manejar function calls
      if (event.type === 'response.function_call_arguments.done') {
        await this.handleFunctionCall(event);
        return;
      }
      
      if (this.clientWs?.readyState === WebSocket.OPEN) {
        this.clientWs.send(message);
      }
    });

    this.openaiWs.on('error', (error) => {
      console.error('❌ Error en OpenAI WebSocket:', error);
      this.clientWs?.close();
    });

    this.openaiWs.on('close', () => {
      console.log('🔌 Desconectado de OpenAI Realtime API');
      this.clientWs?.close();
    });

    clientWs.on('message', (data) => {
      const message = data.toString();
      console.log('📨 Cliente:', message.substring(0, 100));
      if (this.openaiWs?.readyState === WebSocket.OPEN) {
        this.openaiWs.send(message);
      }
    });

    clientWs.on('close', () => {
      this.openaiWs?.close();
    });
  }

  private sendSessionUpdate() {
    const tools = this.mcpService?.getTools() || [];
    
    const event = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'Eres un asistente amigable de SENATI en Perú. Responde brevemente en español sobre carreras, admisión, sedes y costos.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: tools,
        tool_choice: 'auto'
      }
    };

    this.openaiWs?.send(JSON.stringify(event));
    console.log(`🛠️  MCP Tools configurados: ${tools.length}`);
  }

  private async handleFunctionCall(event: any) {
    if (!this.mcpService) return;
    
    const { item_id, call_id, name, arguments: argsStr } = event;
    console.log(`🔧 Function call: ${name}`);
    
    try {
      const args = JSON.parse(argsStr);
      const result = await this.mcpService.executeTool(name, args);
      
      // Enviar resultado a OpenAI
      const outputEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: call_id,
          output: JSON.stringify({ result: result || 'Error ejecutando herramienta' })
        }
      };
      
      this.openaiWs?.send(JSON.stringify(outputEvent));
      
      // Crear respuesta
      this.openaiWs?.send(JSON.stringify({ type: 'response.create' }));
      
    } catch (error) {
      console.error('❌ Error en function call:', error);
    }
  }
}
