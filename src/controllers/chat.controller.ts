import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { RealtimeConfig } from '../config/realtime.config.js';

export const getConfig = (req: Request, res: Response) => {
  res.json({
    app_name: env.APP_NAME,
    mcp_enabled: env.USE_MCP,
    openaiApiKey: env.OPENAI_API_KEY,
    realtime: {
      model: RealtimeConfig.model.name,
      modalities: RealtimeConfig.model.modalities,
      voice: RealtimeConfig.audio.voice,
      instructions: RealtimeConfig.systemPrompt.build(),
      audio: {
        inputFormat: RealtimeConfig.audio.inputFormat,
        outputFormat: RealtimeConfig.audio.outputFormat,
        sampleRate: RealtimeConfig.audio.sampleRate,
      },
      vad: {
        type: RealtimeConfig.vad.type,
        threshold: RealtimeConfig.vad.threshold,
        prefixPaddingMs: RealtimeConfig.vad.prefixPaddingMs,
        silenceDurationMs: RealtimeConfig.vad.silenceDurationMs,
      },
      transcription: RealtimeConfig.transcription,
      statusMessages: RealtimeConfig.statusMessages,
    },
  });
};
