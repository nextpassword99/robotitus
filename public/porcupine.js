// Módulo de Porcupine Wake Word Detection
let porcupineWorker = null;
let isListeningForWakeWord = false;
let wakeWordTimeout = null;
let isInitialized = false;
let porcupineConfig = null;

// Estadísticas
const wakeWordStats = {
  detectionsCount: 0,
  lastDetection: null,
  startTime: null
};

/**
 * Cargar configuración de Porcupine desde el servidor
 */
async function loadPorcupineConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) { 
      throw new Error(`Error cargando configuración: ${response.statusText}`);
    }
    const config = await response.json();
    porcupineConfig = config.porcupine;
    console.log('✅ Configuración de Porcupine cargada desde servidor');
    return porcupineConfig;
  } catch (error) {
    console.error('❌ Error cargando configuración de Porcupine:', error);
    throw error;
  }
}

/**
 * Inicializar Porcupine con la configuración
 */
async function initPorcupine() {
  if (isInitialized) {
    console.log('⚠️ Porcupine ya está inicializado');
    return true;
  }

  // Cargar configuración desde el servidor si no está disponible
  if (!porcupineConfig) {
    await loadPorcupineConfig();
  }

  const config = porcupineConfig;
  
  if (!config) {
    console.error('❌ No se pudo cargar la configuración de Porcupine');
    return false;
  }

  if (!config.accessKey || config.accessKey === 'tu_porcupine_key_aqui') {
    console.error('❌ Por favor configura tu Access Key de Picovoice en el archivo .env');
    console.info('👉 Agrega: PORCUPINE_ACCESS_KEY=tu_clave_aqui');
    console.info('👉 Obtén una clave gratuita en: https://console.picovoice.ai/');
    return false;
  }

  try {
    console.log('🎤 Inicializando Porcupine Wake Word...');
    
    // Preparar keywords con sus archivos
    const keywords = config.keywords.map(kw => ({
      publicPath: kw.publicPath,
      label: kw.label,
      sensitivity: kw.sensitivity || 0.7
    }));

    // Crear worker de Porcupine
    porcupineWorker = await globalThis.PorcupineWeb.PorcupineWorker.create(
      config.accessKey,
      keywords.map(k => ({ publicPath: k.publicPath, label: k.label })),
      onWakeWordDetected,
      { publicPath: config.modelPath }
    );

    isInitialized = true;
    wakeWordStats.startTime = Date.now();
    
    console.log('✅ Porcupine inicializado correctamente');
    console.log(`📋 Palabras activas: ${keywords.map(k => k.label).join(', ')}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Porcupine:', error);
    console.error('Detalles:', error.message);
    return false;
  }
}

/**
 * Callback cuando se detecta una wake word
 */
function onWakeWordDetected(detection) {
  const timestamp = new Date().toLocaleTimeString();
  
  console.log('🎯 WAKE WORD DETECTADA!');
  console.log(`   Palabra: "${detection.label}"`);
  console.log(`   Hora: ${timestamp}`);
  
  // Actualizar estadísticas
  wakeWordStats.detectionsCount++;
  wakeWordStats.lastDetection = {
    label: detection.label,
    timestamp: Date.now()
  };

  // Mostrar notificación visual
  if (porcupineConfig && porcupineConfig.showNotifications) {
    showWakeWordNotification(detection.label);
  }

  // Parar detección temporalmente
  stopListeningForWakeWord();

  // Activar audio si es necesario
  if (typeof activateAudio === 'function' && !audioActivated) {
    activateAudio();
  }

  // Mostrar mensaje de "Te escucho"
  showListeningPrompt();

  // Activar OpenAI Realtime automáticamente
  if (typeof connectRealtime === 'function' && !isConnected) {
    setTimeout(() => {
      connectRealtime();
      
      // Actualizar UI del botón
      const micCircle = document.getElementById("micCircle");
      const pulse = document.getElementById("pulse");
      if (micCircle && pulse) {
        micCircle.classList.add("scale-110", "shadow-2xl");
        pulse.classList.remove("hidden");
      }
      
      // Reproducir sonido de activación y mensaje de voz
      playActivationPrompt();
    }, 300);
  } else if (isConnected) {
    console.log('⚠️ Ya hay una sesión activa de OpenAI Realtime');
  }

  // Programar timeout para volver a escuchar
  scheduleResumeListening();
}

/**
 * Mostrar prompt visual indicando que el sistema está escuchando
 */
function showListeningPrompt() {
  // Actualizar el estado en la UI
  if (typeof updateStatus === 'function') {
    updateStatus('🎤 Te escucho, ¿en qué puedo ayudarte?', 'active');
  }
  
  // Crear overlay de escucha activa
  const overlay = document.createElement('div');
  overlay.id = 'listeningOverlay';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="bg-gradient-to-br from-cyan-900 to-blue-900 p-8 rounded-2xl shadow-2xl border-2 border-cyan-400 max-w-md text-center animate-pulse">
      <div class="text-6xl mb-4">🎤</div>
      <h3 class="text-2xl font-bold text-white mb-2">¡Te escucho!</h3>
      <p class="text-cyan-200 text-lg">Dime, ¿en qué puedo ayudarte?</p>
      <div class="mt-4 flex justify-center space-x-2">
        <span class="inline-block w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
        <span class="inline-block w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
        <span class="inline-block w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Remover overlay después de 3 segundos
  setTimeout(() => {
    overlay.remove();
  }, 3000);
}

/**
 * Reproducir sonido y mensaje de voz indicando que el sistema está listo
 */
function playActivationPrompt() {
  try {
    // Reproducir tono de activación (beep corto)
    const audioContext = dummyAudioContext || new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    
    // Tono agradable de activación (440Hz = La)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    
    console.log('🔔 Sonido de activación reproducido');
    
    // Reproducir mensaje de voz: "Configurando... Listo para responder"
    setTimeout(() => {
      speakMessage("Configurando. Listo para responder.", 1.1);
    }, 300);
    
  } catch (error) {
    console.error('Error reproduciendo sonido de activación:', error);
  }
}

/**
 * Reproducir mensaje de voz usando Web Speech API
 * @param {string} text - Texto a reproducir
 * @param {number} rate - Velocidad de habla (0.1 - 10, default 1)
 * @param {number} pitch - Tono de voz (0 - 2, default 1)
 */
function speakMessage(text, rate = 1, pitch = 1) {
  if (!('speechSynthesis' in globalThis)) {
    console.warn('⚠️ Web Speech API no disponible');
    return;
  }
  
  // Cancelar cualquier speech en progreso
  globalThis.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = 1;
  
  // Buscar voz en español
  const voices = globalThis.speechSynthesis.getVoices();
  const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }
  
  utterance.onstart = () => console.log('🗣️ TTS iniciado:', text);
  utterance.onend = () => console.log('✅ TTS completado');
  utterance.onerror = (e) => console.error('❌ Error TTS:', e);
  
  globalThis.speechSynthesis.speak(utterance);
}

/**
 * Reproducir sonido de desactivación y mensaje
 */
/**
 * Reproducir sonido de desactivación (solo beep, sin mensaje de voz)
 */
function playDeactivationSound() {
  try {
    const audioContext = dummyAudioContext || new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    
    // Tono descendente (desactivación)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    console.log('🔕 Sonido de desactivación reproducido');
    
  } catch (error) {
    console.error('Error reproduciendo sonido de desactivación:', error);
  }
}

/**
 * Iniciar escucha de wake words
 */
async function startListeningForWakeWord() {
  if (!isInitialized) {
    console.warn('⚠️ Porcupine no está inicializado. Inicializando...');
    const success = await initPorcupine();
    if (!success) {
      return false;
    }
  }

  if (isListeningForWakeWord) {
    console.log('⚠️ Ya se está escuchando wake words');
    return true;
  }

  try {
    await globalThis.WebVoiceProcessor.WebVoiceProcessor.subscribe(porcupineWorker);
    isListeningForWakeWord = true;
    
    console.log('👂 Escuchando wake words...');
    const keywords = porcupineConfig ? porcupineConfig.keywords.map(k => k.label).join(' o ') : 'wake word';
    updateStatus(`Di "${keywords}" para activar`, 'listening');
    
    // Actualizar UI
    updateWakeWordIndicator(true);
    
    return true;
  } catch (error) {
    console.error('❌ Error iniciando escucha:', error);
    return false;
  }
}

/**
 * Detener escucha de wake words
 */
async function stopListeningForWakeWord() {
  if (!isListeningForWakeWord) {
    return;
  }

  try {
    await globalThis.WebVoiceProcessor.WebVoiceProcessor.unsubscribe(porcupineWorker);
    isListeningForWakeWord = false;
    console.log('🔇 Detección de wake word pausada');
    
    // Actualizar UI
    updateWakeWordIndicator(false);
  } catch (error) {
    console.error('Error deteniendo escucha:', error);
  }
}

/**
 * Programar reanudación de escucha después de timeout
 */
function scheduleResumeListening() {
  // Limpiar timeout anterior si existe
  if (wakeWordTimeout) {
    clearTimeout(wakeWordTimeout);
  }

  const timeout = porcupineConfig ? porcupineConfig.timeoutAfterDetection : 30000;
  
  wakeWordTimeout = setTimeout(async () => {
    // Solo reanudar si no hay sesión activa
    if (!isConnected) {
      console.log('⏰ Timeout alcanzado, volviendo a escuchar wake words...');
      await startListeningForWakeWord();
    }
  }, timeout);
}

/**
 * Mostrar notificación visual de detección
 */
function showWakeWordNotification(word) {
  // Crear notificación
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 z-50 animate-bounce';
  notification.innerHTML = `
    <div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg shadow-2xl border-2 border-green-300">
      <div class="flex items-center space-x-2">
        <span class="text-2xl">🎤</span>
        <div>
          <p class="font-bold text-sm">Wake Word Detectada</p>
          <p class="text-xs opacity-90">"${word}"</p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Reproducir sonido de confirmación (opcional)
  playDetectionSound();
  
  // Remover después de 2 segundos
  setTimeout(() => {
    notification.style.transition = 'opacity 0.5s';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 2000);
}

/**
 * Reproducir sonido de confirmación
 */
function playDetectionSound() {
  try {
    const audioContext = dummyAudioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.warn('No se pudo reproducir sonido de detección:', error);
  }
}

/**
 * Actualizar indicador visual de estado de wake word
 */
function updateWakeWordIndicator(isActive) {
  let indicator = document.getElementById('wakeWordIndicator');
  
  if (!indicator) {
    // Crear indicador si no existe
    indicator = document.createElement('div');
    indicator.id = 'wakeWordIndicator';
    indicator.className = 'fixed bottom-4 left-4 z-40';
    document.body.appendChild(indicator);
  }
  
  if (isActive) {
    const keywords = porcupineConfig ? porcupineConfig.keywords.map(k => k.label).join(', ') : 'wake words';
    indicator.innerHTML = `
      <div class="bg-blue-900/80 backdrop-blur-sm text-blue-200 px-4 py-2 rounded-full shadow-lg border border-blue-500/50 flex items-center space-x-2">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
        <span class="text-xs font-medium">Escuchando: ${keywords}</span>
      </div>
    `;
  } else {
    indicator.innerHTML = '';
  }
}

/**
 * Obtener estadísticas de wake word
 */
function getWakeWordStats() {
  return {
    ...wakeWordStats,
    uptime: wakeWordStats.startTime ? Date.now() - wakeWordStats.startTime : 0,
    isActive: isListeningForWakeWord
  };
}

/**
 * Limpiar recursos de Porcupine
 */
async function cleanupPorcupine() {
  if (wakeWordTimeout) {
    clearTimeout(wakeWordTimeout);
  }
  
  if (isListeningForWakeWord) {
    await stopListeningForWakeWord();
  }
  
  if (porcupineWorker) {
    porcupineWorker.terminate();
    porcupineWorker = null;
  }
  
  isInitialized = false;
  console.log('🧹 Porcupine limpiado');
}

// Exponer funciones globalmente
globalThis.initPorcupine = initPorcupine;
globalThis.startListeningForWakeWord = startListeningForWakeWord;
globalThis.stopListeningForWakeWord = stopListeningForWakeWord;
globalThis.getWakeWordStats = getWakeWordStats;
globalThis.cleanupPorcupine = cleanupPorcupine;
globalThis.loadPorcupineConfig = loadPorcupineConfig;
globalThis.speakMessage = speakMessage;
globalThis.playDeactivationSound = playDeactivationSound;
