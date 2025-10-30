import { Request, Response } from 'express';
import { llmService } from './audio.controller.js';
import { env } from '../config/env.js';

export const chat = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Campo 'text' requerido" });
    const response = await llmService.getResponse(text);
    res.json({ response, rag_enabled: env.USE_RAG });
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const resetConversation = async (req: Request, res: Response) => {
  llmService.resetConversation();
  res.json({ status: 'ok' });
};

export const loadKnowledgeBase = async (req: Request, res: Response) => {
  if (!env.USE_RAG) return res.status(400).json({ error: 'RAG no está habilitado' });
  try {
    llmService.loadKnowledgeBase();
    res.json({ status: 'ok', message: 'Base de conocimiento cargada' });
  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getConfig = async (req: Request, res: Response) => {
  res.json({
    app_name: env.APP_NAME,
    rag_enabled: env.USE_RAG,
    mcp_enabled: env.USE_MCP,
    llm_model: env.LLM_MODEL,
    embedding_model: env.EMBEDDING_MODEL,
    collection_name: env.COLLECTION_NAME
  });
};

export const getMcpStatus = async (req: Request, res: Response) => {
  if (!env.USE_MCP || !llmService.mcpService) return res.json({ enabled: false });
  const tools = llmService.mcpService.getTools();
  const servers = llmService.mcpService.listAvailableServers();
  res.json({ enabled: true, servers, tools_count: tools.length, tools: tools.map(t => t.function.name) });
};
