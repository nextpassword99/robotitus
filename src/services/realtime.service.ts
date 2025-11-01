import WebSocket from 'ws';
import { env } from '../config/env.js';
import { MCPService } from './mcp.service.js';
import { RealtimeConfig } from '../config/realtime.config.js';

export class RealtimeService {
  private openaiWs: WebSocket | null = null;
  private clientWs: WebSocket | null = null;
  private sessionReady = false;
  private mcpService: MCPService | null = null;

  async connect(clientWs: WebSocket, mcpService: MCPService | null = null) {
    this.clientWs = clientWs;
    this.mcpService = mcpService;
    
    const url = `wss://api.openai.com/v1/realtime?model=${RealtimeConfig.model.name}`;
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
      
      if (RealtimeConfig.logging.logEvents) {
        console.log('📩 OpenAI:', event.type);
      }
      
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
        modalities: RealtimeConfig.model.modalities,
        instructions: RealtimeConfig.systemPrompt.build(),
        voice: RealtimeConfig.audio.voice,
        input_audio_format: RealtimeConfig.audio.inputFormat,
        output_audio_format: RealtimeConfig.audio.outputFormat,
        input_audio_transcription: RealtimeConfig.transcription.enabled 
          ? { model: RealtimeConfig.transcription.model } 
          : undefined,
        turn_detection: {
          type: RealtimeConfig.vad.type,
          threshold: RealtimeConfig.vad.threshold,
          prefix_padding_ms: RealtimeConfig.vad.prefixPaddingMs,
          silence_duration_ms: RealtimeConfig.vad.silenceDurationMs
        },
        tools: tools,
        tool_choice: RealtimeConfig.tools.choice
      }
    };

    if (RealtimeConfig.logging.enabled) {
      console.log(`🛠️  MCP Tools configurados: ${tools.length}`);
    }
    
    this.openaiWs?.send(JSON.stringify(event));
  }

  private async handleFunctionCall(event: any) {
    if (!this.mcpService) return;
    
    const { item_id, call_id, name, arguments: argsStr } = event;
    
    if (RealtimeConfig.logging.logFunctionCalls) {
      console.log(`🔧 Function call: ${name}`);
    }
    
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
