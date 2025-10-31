import OpenAI from 'openai';
import { env } from '../config/env.js';

export class TTSService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    console.log('✅ TTS Service inicializado');
  }

  async synthesize(text: string): Promise<Buffer> {
    console.log(`🔊 Sintetizando voz: ${text.substring(0, 50)}...`);
    const mp3 = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      speed: 1.0
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    console.log(`✅ Audio generado: ${buffer.length} bytes`);
    return buffer;
  }
}
