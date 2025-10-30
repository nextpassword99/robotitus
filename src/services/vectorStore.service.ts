import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { env } from '../config/env.js';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export class VectorStoreService {
  private embeddings: OpenAIEmbeddings;
  private client: ChromaClient;
  private vectorstore?: Chroma;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: env.EMBEDDING_MODEL,
      openAIApiKey: env.OPENAI_API_KEY
    });
    this.client = new ChromaClient({ path: env.CHROMA_PERSIST_DIR });
    console.log(`✅ VectorStore inicializado: ${env.COLLECTION_NAME}`);
  }

  private async initVectorStore() {
    try {
      const collection = await this.client.getOrCreateCollection({ name: env.COLLECTION_NAME });
      this.vectorstore = new Chroma(this.embeddings, { collectionName: env.COLLECTION_NAME, index: collection });
    } catch (error) {
      console.warn('⚠️ No se pudo conectar a ChromaDB, continuando sin RAG');
    }
  }

  async loadDocuments() {
    const documents: any[] = [];
    const loadDir = (dir: string) => {
      for (const file of readdirSync(dir)) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          loadDir(filePath);
        } else if (stat.isFile()) {
          const ext = extname(filePath);
          try {
            if (['.txt', '.md'].includes(ext)) {
              documents.push(new TextLoader(filePath).load());
              console.log(`📄 Cargado: ${file}`);
            } else if (ext === '.pdf') {
              documents.push(new PDFLoader(filePath).load());
              console.log(`📄 Cargado: ${file}`);
            }
          } catch (error) {
            console.error(`❌ Error cargando ${file}:`, error);
          }
        }
      }
    };
    loadDir(env.DATA_DIR);
    if (documents.length > 0) {
      const allDocs = (await Promise.all(documents)).flat();
      await this.indexDocuments(allDocs);
    } else {
      console.warn('⚠️ No se encontraron documentos');
    }
  }

  private async indexDocuments(documents: any[]) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: env.CHUNK_SIZE,
      chunkOverlap: env.CHUNK_OVERLAP
    });
    const chunks = await splitter.splitDocuments(documents);
    console.log(`📊 Generando ${chunks.length} chunks...`);
    const collection = await this.client.getOrCreateCollection({ name: env.COLLECTION_NAME });
    await collection.add({
      ids: chunks.map((_, i) => `doc_${i}`),
      documents: chunks.map(c => c.pageContent),
      metadatas: chunks.map(c => c.metadata)
    });
    this.vectorstore = new Chroma(this.embeddings, { collectionName: env.COLLECTION_NAME, index: collection });
    console.log(`✅ ${chunks.length} chunks indexados`);
  }

  async search(query: string, k?: number) {
    if (!this.vectorstore) await this.initVectorStore();
    if (!this.vectorstore) return [];
    const results = await this.vectorstore.similaritySearch(query, k || env.TOP_K_RESULTS);
    console.log(`🔍 Encontrados ${results.length} resultados`);
    return results;
  }

  async getContext(query: string) {
    const results = await this.search(query);
    return results.map(doc => doc.pageContent).join('\n\n');
  }
}
