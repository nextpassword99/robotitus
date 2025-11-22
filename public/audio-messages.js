/**
 * Configuración de sonidos para robot (sin mensajes de voz TTS)
 * Solo usa beeps/tonos para feedback del sistema
 */

const AudioMessages = {

  /**
   * Configuración de beeps/tonos para feedback del sistema
   */
  beeps: {
    // Sonido al iniciar el sistema
    init: {
      frequency: 523, // Do (C5)
      duration: 0.15,
      type: 'sine',
    },
    // Sonido al activar con wake word
    activation: {
      frequencies: [440, 554, 659], // La-Do#-Mi (acorde ascendente)
      duration: 0.1,
      gap: 0.05,
      type: 'sine',
    },
    // Sonido al desactivar
    deactivation: {
      frequencies: [659, 554, 440], // Mi-Do#-La (acorde descendente)
      duration: 0.1,
      gap: 0.05,
      type: 'sine',
    },
    // Sonido de error
    error: {
      frequency: 200,
      duration: 0.2,
      type: 'square',
    },
    // Sonido cuando el sistema está listo
    ready: {
      frequency: 880, // La agudo
      duration: 0.1,
      type: 'sine',
    },
  },

  /**
   * Tiempos de espera (en milisegundos)
   */
  delays: {
    afterBeep: 300,
    beforeDeactivation: 1500,
    beforeResumeWakeWord: 1000,
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
