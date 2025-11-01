/**
 * Configuración centralizada para Realtime API
 * Todos los prompts, parámetros de voz y configuraciones de sesión
 */

export const RealtimeConfig = {
  /**
   * Configuración del modelo
   */
  model: {
    name: "gpt-4o-realtime-preview-2024-12-17",
    modalities: ["text", "audio"] as const,
  },

  /**
   * Configuración de audio
   */
  audio: {
    inputFormat: "pcm16" as const,
    outputFormat: "pcm16" as const,
    voice: "alloy" as const, // alloy, echo, shimmer, ash, ballad, coral, sage, verse
    sampleRate: 24000,
  },

  /**
   * Configuración de detección de voz (VAD)
   */
  vad: {
    type: "server_vad" as const,
    threshold: 0.5,
    prefixPaddingMs: 300,
    silenceDurationMs: 500,
  },

  /**
   * Configuración de transcripción
   */
  transcription: {
    enabled: true,
    model: "whisper-1",
  },

  /**
   * Instrucciones del sistema (System Prompt)
   */
  systemPrompt: {
    role: `Eres un asistente virtual amigable y profesional de SENATI (Servicio Nacional de Adiestramiento en Trabajo Industrial) en Perú.`,

    personality: [
      "Hablas con calidez y empatía",
      "Eres profesional pero cercano",
      "Transmites confianza en cada respuesta",
      "Muestras entusiasmo por ayudar",
    ],

    capabilities: [
      "Información sobre carreras técnicas y programas de formación",
      "Proceso de admisión y matrícula",
      "Sedes y horarios disponibles",
      "Costos, becas y financiamiento",
      "Certificaciones y títulos",
    ],

    responseStyle: [
      "SÉ BREVE: Responde en 2-3 oraciones máximo",
      "Ve directo al punto sin rodeos innecesarios",
      "Usa un tono conversacional como si estuvieras hablando",
    ],

    /**
     * Genera el prompt completo del sistema
     */
    build(): string {
      return `${this.role}

      ## CRÍTICO: IDIOMA OBLIGATORIO
      Responde ÚNICAMENTE en español. NUNCA uses inglés, eslovaco u otro idioma.
      Si el usuario habla en otro idioma, responde en español de todas formas.

      ## Personalidad
      ${this.personality.map((p) => `- ${p}`).join("\n")}

      ## Puedes ayudar con
      ${this.capabilities.map((c) => `- ${c}`).join("\n")}

      ## Estilo de respuesta
      ${this.responseStyle.map((s) => `- ${s}`).join("\n")}`;
    },
  },

  /**
   * Configuración de herramientas (MCP)
   */
  tools: {
    enabled: true,
    choice: "auto" as const, // auto, none, required
  },

  /**
   * Timeouts y límites
   */
  limits: {
    maxSessionDurationMs: 30 * 60 * 1000, // 30 minutos
    reconnectAttempts: 3,
    reconnectDelayMs: 1000,
  },

  /**
   * Mensajes de estado para el usuario
   */
  statusMessages: {
    connecting: "Conectando con el asistente...",
    connected: "Conectado - Habla cuando quieras",
    listening: "Escuchando...",
    processing: "Procesando...",
    error: "Error de conexión",
    disconnected: "Desconectado",
    microphoneRequest: "Solicitando micrófono...",
    webrtcSetup: "Configurando conexión...",
  },

  /**
   * Configuración de logging
   */
  logging: {
    enabled: true,
    logEvents: true,
    logFunctionCalls: true,
  },
} as const;

/**
 * Tipos derivados de la configuración
 */
export type Voice = typeof RealtimeConfig.audio.voice;
export type Modality = (typeof RealtimeConfig.model.modalities)[number];
export type AudioFormat = typeof RealtimeConfig.audio.inputFormat;
export type VADType = typeof RealtimeConfig.vad.type;
export type ToolChoice = typeof RealtimeConfig.tools.choice;
