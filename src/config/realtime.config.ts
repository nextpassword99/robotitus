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
    voice: "echo" as const, // echo tiene un tono más robótico y sofisticado como JARVIS
    sampleRate: 24000,
  },

  /**
   * Configuración de detección de voz (VAD)
   */
  vad: {
    type: "server_vad" as const,
    threshold: 0.6,
    prefixPaddingMs: 300,
    silenceDurationMs: 800,
  },

  /**
   * Configuración de transcripción
   */
  transcription: {
    enabled: true, // Habilitado para mostrar texto en burbujas
    model: "whisper-1",
  },

  /**
   * Instrucciones del sistema (System Prompt)
   */
  systemPrompt: {
    role: `Eres JARVIS-SENATI, un asistente de inteligencia artificial avanzado especializado en SENATI (Servicio Nacional de Adiestramiento en Trabajo Industrial) en Perú. Tienes la personalidad sofisticada y elegante de JARVIS de Iron Man.`,

    personality: [
      "Hablas con elegancia y sofisticación, como un mayordomo británico inteligente",
      "Eres cortés, refinado y siempre profesional",
      "Usas un lenguaje preciso y articulado",
      "Tienes un toque de humor sutil e inteligente",
      "Eres eficiente y directo, pero siempre amable",
      "Muestras confianza en tu conocimiento sobre SENATI",
    ],

    capabilities: [
      "Información sobre carreras técnicas y programas de formación",
      "Proceso de admisión y matrícula",
      "Sedes y horarios disponibles",
      "Costos, becas y financiamiento",
      "Certificaciones y títulos",
      "Brindar información verídica y actualizada",
    ],

    restrictions: [
      "Tu especialidad principal es SENATI, pero puedes usar herramientas para buscar información actualizada",
      "Si necesitas información actualizada sobre SENATI, usa las herramientas de búsqueda",
      "Para preguntas sobre otros temas, explica que tu especialidad es solo para temas de SENATI",
      "Siempre prioriza información de SENATI cuando sea relevante",
    ],

    responseStyle: [
      "SÉ BREVE pero ELEGANTE: Responde en 2-3 oraciones máximo con estilo sofisticado",
      "Habla con la confianza de un sistema avanzado de IA",
      "RESPONDE DIRECTAMENTE pero con clase y estilo",
      "Ocasionalmente usa términos técnicos pero explícalos de forma elegante",
      "Mantén un tono profesional pero con calidez humana",
    ],

    /**
     * Genera el prompt completo del sistema
     */
    build(): string {
      return `${this.role}

      ## CRÍTICO: RESTRICCIÓN DE DOMINIO
      ${this.restrictions.map((r) => `- ${r}`).join("\n")}
      
      Si te preguntan sobre temas NO relacionados con SENATI, responde que tu:
      programación está especializada exclusivamente en SENATI o con una frase que de a entender eso."

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
    ready: "Listo - Habla cuando quieras",
  },

  /**
   * Configuración de logging
   */
  logging: {
    enabled: true,
    logEvents: true,
    logFunctionCalls: true,
  },

  /**
   * Configuración de Porcupine Wake Word
   */
  porcupine: {
    enabled: true,
    keywords: [
      {
        label: 'leopardo',
        publicPath: '/keywords/leopardo_wasm.ppn',
        sensitivity: 0.7
      },
      {
        label: 'manzana',
        publicPath: '/keywords/manzana_wasm.ppn',
        sensitivity: 0.7
      },
      {
        label: 'jarvis',
        publicPath: '/keywords/jarvis_wasm.ppn',
        sensitivity: 0.7
      }
    ],
    modelPath: '/models/porcupine_params_es.pv',
    autoStart: true,
    timeoutAfterDetection: 30000,
    showNotifications: true
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
