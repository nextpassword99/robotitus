import { Request, Response } from 'express';
import { SpeechService } from '../services/openai.service.js';
import { LLMService } from '../services/llm.service.js';
import { TTSService } from '../services/tts.service.js';
import { env } from '../config/env.js';

const speechService = new SpeechService();
const llmService = new LLMService();
const ttsService = new TTSService();

export const processAudio = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo de audio' });
    const audioData = req.file.buffer;
    console.log(`📥 Audio recibido: ${audioData.length} bytes`);
    const text = await speechService.transcribe(audioData);
    const response = await llmService.getResponse(text);
    const audioResponse = await ttsService.synthesize(response);
    res.json({ 
      transcription: text, 
      response, 
      audio: audioResponse.toString('base64'),
      rag_enabled: env.USE_RAG, 
      mcp_enabled: env.USE_MCP 
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export { llmService };
