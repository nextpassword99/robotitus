/**
 * Configuración de mensajes de audio para robot
 * Personaliza aquí todos los mensajes de voz del sistema
 */

const AudioMessages = {
  /**
   * Mensajes del sistema
   */
  system: {
    init: "Sistema iniciado. Di leopardo para activar.",
    configuring: "Configurando. Listo para responder.",
    ready: "Sistema listo.",
    processing: "Procesando.",
    deactivating: "Desactivando sistema.",
    error: "Error en el sistema.",
    noVoiceDetected: "No detecté tu voz. Desactivando.",
  },

  /**
   * Configuración de velocidad de habla (rate)
   * 0.1 - 10 (normal = 1.0)
   */
  speechRate: {
    init: 1,
    configuring: 1.1,
    ready: 1.2,
    processing: 1.3,
    deactivating: 1.1,
    error: 1.1,
    noVoiceDetected: 1.1,
  },

  /**
   * Configuración de tono de voz (pitch)
   * 0 - 2 (normal = 1.0)
   */
  pitch: {
    default: 1,
    error: 0.9,
  },

  /**
   * Configuración de beeps/tonos
   */
  beeps: {
    activation: {
      frequency: 440, // Hz (La = 440Hz)
      duration: 0.2, // segundos
      type: 'sine', // sine, square, sawtooth, triangle
    },
    deactivation: {
      startFrequency: 440,
      endFrequency: 220,
      duration: 0.3,
      type: 'sine',
    },
  },

  /**
   * Tiempos de espera (en milisegundos)
   */
  delays: {
    afterBeep: 300, // Espera después del beep de activación
    beforeDeactivation: 1500, // Espera antes de desactivar después de responder
    afterTTS: 2000, // Espera después de mensaje TTS antes de cleanup
    beforeResumeWakeWord: 1000, // Espera antes de volver a escuchar wake words
  },

  /**
   * Obtener mensaje por clave
   */
  get(key) {
    const keys = key.split('.');
    let value = this;
    for (const k of keys) {
      value = value[k];
      if (value === undefined) return null;
    }
    return value;
  },

  /**
   * Personalización de mensajes según contexto
   * Puedes agregar variaciones o condicionales aquí
   */
  getContextualMessage(key, context = {}) {
    const message = this.system[key];
    
    // Ejemplo: Agregar nombre del usuario si está disponible
    if (context.userName && key === 'ready') {
      return `Sistema listo, ${context.userName}.`;
    }
    
    // Ejemplo: Mensaje diferente en primera activación
    if (context.isFirstTime && key === 'init') {
      return "Bienvenido. Sistema JARVIS iniciado. Di leopardo para activar.";
    }
    
    return message;
  },
};

// Exponer globalmente
if (typeof globalThis !== 'undefined') {
  globalThis.AudioMessages = AudioMessages;
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioMessages;
}
