import WebSocket from 'ws';
import { env } from '../config/env.js';

export class RealtimeService {
  private openaiWs: WebSocket | null = null;
  private clientWs: WebSocket | null = null;

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
      this.sendSessionUpdate();
    });

    this.openaiWs.on('message', (data) => {
      if (this.clientWs?.readyState === WebSocket.OPEN) {
        this.clientWs.send(data);
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
      if (this.openaiWs?.readyState === WebSocket.OPEN) {
        this.openaiWs.send(data);
      }
    });

    clientWs.on('close', () => {
      this.openaiWs?.close();
    });
  }

  private sendSessionUpdate() {
    const systemMessage = `Eres un asistente virtual cálido y amigable de SENATI (Servicio Nacional de Adiestramiento en Trabajo Industrial) en Perú.

Tu personalidad:
- Hablas con calidez y empatía, como un amigo cercano que genuinamente quiere ayudar
- Eres tierno, acogedor y transmites confianza en cada respuesta
- Usas un lenguaje cercano y natural, evitando ser demasiado formal
- Muestras entusiasmo por ayudar y celebras los intereses del usuario

Tu función es ayudar con información sobre:
- Carreras técnicas y programas de formación
- Proceso de admisión y matrícula
- Sedes y horarios
- Costos y becas
- Certificaciones

ESTILO DE RESPUESTA:
- SÉ BREVE: Responde en 2-3 oraciones máximo
- Ve directo al punto sin rodeos innecesarios
- Usa un tono conversacional como si estuvieras hablando

IMPORTANTE: SIEMPRE responde en español.`;

    const event = {
      type: 'session.update',
      session: {
        model: 'gpt-4o-realtime-preview-2024-12-17',
        output_modalities: ['audio', 'text'],
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: 24000
            },
            turn_detection: {
              type: 'semantic_vad'
            }
          },
          output: {
            format: {
              type: 'audio/pcm'
            },
            voice: 'alloy'
          }
        },
        instructions: systemMessage
      }
    };

    this.openaiWs?.send(JSON.stringify(event));
  }
}
