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
      model: 'gpt-4o-mini-tts',
      voice: 'shimmer',
      input: text,
      instructions: 'Habla con una voz cálida, amable y tierna. Usa un tono amigable y acogedor, como si estuvieras ayudando a un amigo cercano. Transmite confianza y empatía en cada palabra.',
      speed: 0.95
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    console.log(`✅ Audio generado: ${buffer.length} bytes`);
    return buffer;
  }
}
