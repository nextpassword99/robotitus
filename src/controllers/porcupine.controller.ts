import { Request, Response } from 'express';
import { PorcupineService } from '../services/porcupine.service.js';
import { SpeechService } from '../services/openai.service.js';
import { LLMService } from '../services/llm.service.js';
import { env } from '../config/env.js';

let porcupineService: PorcupineService | null = null;
const speechService = new SpeechService();
const llmService = new LLMService();

export const initPorcupine = async (req: Request, res: Response) => {
  try {
    const { accessKey, keywordIndex } = req.body;
    
    const key = accessKey || env.PORCUPINE_ACCESS_KEY;
    if (!key) {
      return res.status(400).json({ error: 'accessKey requerido o configurar PORCUPINE_ACCESS_KEY en .env' });
    }

    if (keywordIndex === undefined) {
      return res.status(400).json({ error: 'keywordIndex requerido' });
    }

    if (!porcupineService) {
      porcupineService = new PorcupineService(key, speechService, llmService);
    }

    await porcupineService.start(keywordIndex, (transcription, response) => {
      console.log(`📝 Transcripción: ${transcription}`);
      console.log(`💬 Respuesta: ${response}`);
    });

    res.json({ 
      status: 'ok', 
      message: 'Porcupine iniciado - Escuchando palabra clave',
      keyword: porcupineService.getKeywords()[keywordIndex]
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const stopPorcupine = async (req: Request, res: Response) => {
  try {
    if (porcupineService) {
      await porcupineService.stop();
      porcupineService = null;
      res.json({ status: 'ok', message: 'Porcupine detenido' });
    } else {
      res.status(400).json({ error: 'Porcupine no está activo' });
    }
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getKeywords = async (req: Request, res: Response) => {
  try {
    if (!porcupineService) {
      const key = env.PORCUPINE_ACCESS_KEY || '';
      porcupineService = new PorcupineService(key, speechService, llmService);
    }
    const keywords = porcupineService.getKeywords();
    res.json({ keywords });
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPorcupineStatus = async (req: Request, res: Response) => {
  res.json({
    active: porcupineService?.isActive() || false,
    keywords: porcupineService?.getKeywords() || []
  });
};
