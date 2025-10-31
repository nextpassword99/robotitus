import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  APP_NAME: z.string().default('SENATI Assistant API'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.string().transform(Number).default('8000'),
  OPENAI_API_KEY: z.string(),
  WHISPER_MODEL: z.string().default('whisper-1'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  USE_RAG: z.string().transform(v => v === 'true').default('true'),
  CHROMA_PERSIST_DIR: z.string().default('./data/chroma'),
  COLLECTION_NAME: z.string().default('senati_knowledge'),
  CHUNK_SIZE: z.string().transform(Number).default('500'),
  CHUNK_OVERLAP: z.string().transform(Number).default('50'),
  TOP_K_RESULTS: z.string().transform(Number).default('3'),
  USE_MCP: z.string().transform(v => v === 'true').default('false'),
  DATA_DIR: z.string().default('./data/senati'),
  PORCUPINE_ACCESS_KEY: z.string().optional(),
  RECORDING_DURATION_SEC: z.string().transform(Number).default('5'),
  SILENCE_TIMEOUT_SEC: z.string().transform(Number).default('2')
});

export const env = envSchema.parse(process.env);
