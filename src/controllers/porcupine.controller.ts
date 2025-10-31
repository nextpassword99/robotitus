import { Request, Response } from 'express';
import { porcupineKeywords } from '../config/porcupine.config.js';

export const getKeywords = async (req: Request, res: Response) => {
  const keywords = porcupineKeywords.map((k, i) => ({ index: i, label: k.label }));
  res.json({ keywords });
};

export const getPorcupineStatus = async (req: Request, res: Response) => {
  res.json({
    message: 'Porcupine se ejecuta en el navegador. Visita http://localhost:8000 para usar la interfaz web.'
  });
};
