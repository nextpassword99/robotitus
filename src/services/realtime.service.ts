import WebSocket from 'ws';
import { env } from '../config/env.js';

export class RealtimeService {
  private openaiWs: WebSocket | null = null;
  private clientWs: WebSocket | null = null;
  private sessionReady = false;

  async connect(clientWs: WebSocket) {
    this.clientWs = clientWs;
    
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

    this.openaiWs.on('message', (data) => {
      const message = data.toString();
      const event = JSON.parse(message);
      console.log('📩 OpenAI:', event.type);
      
      if (event.type === 'session.created' && !this.sessionReady) {
        this.sessionReady = true;
        this.sendSessionUpdate();
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
    const event = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'Eres un asistente amigable de SENATI en Perú. Responde brevemente en español sobre carreras, admisión, sedes y costos.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        }
      }
    };

    const payload = JSON.stringify(event);
    console.log('📤 Enviando session.update:', payload.substring(0, 150));
    this.openaiWs?.send(payload);
  }
}
