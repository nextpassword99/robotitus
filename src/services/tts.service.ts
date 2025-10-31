import OpenAI from "openai";
import { env } from "../config/env.js";

export class TTSService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    console.log("✅ TTS Service inicializado");
  }

  async synthesize(text: string): Promise<Buffer> {
    console.log(`🔊 Sintetizando voz: ${text.substring(0, 50)}...`);
    const mp3 = await this.client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "shimmer",
      input: text,
      instructions: `
Voice: High-energy, upbeat, and encouraging, projecting enthusiasm and motivation.

Punctuation: Short, punchy sentences with strategic pauses to maintain excitement and clarity.

Delivery: Fast-paced and dynamic, with rising intonation to build momentum and keep engagement high.

Phrasing: Action-oriented and direct, using motivational cues to push participants forward.

Tone: Positive, energetic, and empowering, creating an atmosphere of encouragement and achievement.`,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    console.log(`✅ Audio generado: ${buffer.length} bytes`);
    return buffer;
  }
}
