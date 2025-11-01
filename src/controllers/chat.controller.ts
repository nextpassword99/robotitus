import { Request, Response } from 'express';
import { env } from '../config/env.js';

export const getConfig = (req: Request, res: Response) => {
  res.json({
    app_name: env.APP_NAME,
    mcp_enabled: env.USE_MCP,
    openaiApiKey: env.OPENAI_API_KEY
  });
};
