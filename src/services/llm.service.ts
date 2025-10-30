import OpenAI from 'openai';
import { env } from '../config/env.js';
import { VectorStoreService } from './vectorStore.service.js';
import { MCPService } from './mcp.service.js';

export class LLMService {
  private client: OpenAI;
  private history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  public vectorStore?: VectorStoreService;
  public mcpService?: MCPService;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.vectorStore = env.USE_RAG ? new VectorStoreService() : undefined;
    this.mcpService = env.USE_MCP ? new MCPService() : undefined;
    console.log('✅ LLM Service inicializado');
  }

  private async chat(messages: OpenAI.Chat.ChatCompletionMessageParam[], useTools = true) {
    const tools = useTools && this.mcpService ? this.mcpService.getTools() : undefined;
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: env.LLM_MODEL,
      messages,
      ...(tools && { tools, tool_choice: 'auto' as const })
    };
    const response = await this.client.chat.completions.create(params);
    return response.choices[0].message;
  }

  async getResponse(userMessage: string): Promise<string> {
    let context = '';
    if (this.vectorStore) {
      const ragContext = await this.vectorStore.getContext(userMessage);
      if (ragContext) context += `\n\nCONTEXTO SENATI:\n${ragContext}`;
    }

    let systemMessage = `Eres un asistente virtual de SENATI (Servicio Nacional de Adiestramiento en Trabajo Industrial).
Tu función es ayudar a estudiantes, postulantes y público en general con información sobre:
- Carreras técnicas y programas de formación
- Proceso de admisión y matrícula
- Sedes y horarios
- Costos y becas
- Certificaciones

Responde de forma clara, precisa y amigable. Si no tienes información específica, indícalo.`;

    if (context) systemMessage += `\n\nUsa la siguiente información para responder:${context}`;

    this.history.push({ role: 'user', content: userMessage });
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMessage },
      ...this.history
    ];

    console.log(`🤖 Consultando ${env.LLM_MODEL}...`);
    let responseMessage = await this.chat(messages);

    while (responseMessage.tool_calls) {
      messages.push(responseMessage);
      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        console.log(`🔧 Ejecutando tool: ${toolName}`);
        const toolResult = await this.mcpService!.executeTool(toolName, toolArgs);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult || 'Error ejecutando tool'
        });
      }
      responseMessage = await this.chat(messages);
    }

    const assistantMessage = responseMessage.content || '';
    this.history.push({ role: 'assistant', content: assistantMessage });
    console.log(`✅ Respuesta: ${assistantMessage.substring(0, 100)}...`);
    return assistantMessage;
  }

  resetConversation() {
    this.history = [];
    console.log('🔄 Conversación reiniciada');
  }

  loadKnowledgeBase() {
    if (this.vectorStore) this.vectorStore.loadDocuments();
  }
}
