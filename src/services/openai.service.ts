import OpenAI from 'openai';
import { env } from '../config/env.js';

export class SpeechService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    console.log('✅ Speech Service inicializado');
  }

  async transcribe(audioData: Buffer): Promise<string> {
    console.log(`🎤 Transcribiendo audio (${audioData.length} bytes)...`);
    const file = new File([audioData], 'audio.wav', { type: 'audio/wav' });
    const response = await this.client.audio.transcriptions.create({
      model: env.WHISPER_MODEL,
      file
    });
    console.log(`✅ Transcripción: ${response.text}`);
    return response.text;
  }
}
