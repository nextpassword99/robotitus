let serverConfig = null;
let pc = null;
let dc = null;
let micStream = null;
let isConnected = false;
let lastAssistantMessage = null;
let currentResponseId = null;
let isProcessingResponse = false;
let audioActivated = false;
let dummyAudioContext = null;

// Cargar config al inicio
(async () => {
  const res = await fetch("/api/config");
  serverConfig = await res.json();
  console.log("✅ Configuración cargada");
  
  // Detectar si es móvil y mostrar aviso de activación de audio
  checkMobileAudio();
})();

// Detectar móvil y preparar activación de audio
function checkMobileAudio() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    const warningDiv = document.getElementById('audioWarning');
    const activateBtn = document.getElementById('activateAudioBtn');
    
    if (warningDiv && activateBtn) {
      warningDiv.classList.remove('hidden');
      
      activateBtn.addEventListener('click', () => {
        activateAudio();
        warningDiv.classList.add('hidden');
      });
    }
  }
}

// Activar audio para Bluetooth (requerido por navegadores móviles)
function activateAudio() {
  if (audioActivated) return;
  
  try {
    // Crear un AudioContext dummy que se activa con interacción del usuario
    dummyAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Reproducir un silencio breve para "desbloquear" el audio
    const oscillator = dummyAudioContext.createOscillator();
    const gainNode = dummyAudioContext.createGain();
    gainNode.gain.value = 0.001; // Volumen muy bajo
    oscillator.connect(gainNode);
    gainNode.connect(dummyAudioContext.destination);
    oscillator.start();
    oscillator.stop(dummyAudioContext.currentTime + 0.1);
    
    audioActivated = true;
    console.log('✅ Audio activado para Bluetooth');
    
    // Mostrar confirmación visual
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.innerHTML = `
        <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          Audio activado - Presiona el micrófono para hablar
        </span>
      `;
    }
  } catch (error) {
    console.error('Error activando audio:', error);
  }
}

// Cargar config al inicio
(async () => {
  const res = await fetch("/api/config");
  serverConfig = await res.json();
  console.log("✅ Configuración cargada");
})();

async function connectRealtime() {
  try {
    if (!serverConfig) {
      const res = await fetch("/api/config");
      serverConfig = await res.json();
    }
    const { realtime, openaiApiKey } = serverConfig;

    updateStatus(realtime.statusMessages.microphoneRequest, "processing");

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: realtime.audio.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    updateStatus(realtime.statusMessages.webrtcSetup, "processing");

    pc = new RTCPeerConnection();

    // Crear elemento de audio con configuración optimizada para Bluetooth móvil
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true; // Crítico para iOS
    audioEl.controls = false; // Ocultar controles pero mantener funcionalidad
    audioEl.volume = 1.0; // Volumen máximo
    audioEl.style.display = "none";
    
    // Configurar para salida de audio Bluetooth
    if (audioEl.setSinkId) {
      // Intentar usar el dispositivo de audio predeterminado
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
          console.log('📱 Dispositivos de audio disponibles:', audioOutputs.length);
          audioOutputs.forEach(d => console.log(`  - ${d.label || 'Desconocido'} (${d.deviceId})`));
        })
        .catch(err => console.warn('No se pudieron enumerar dispositivos:', err));
    }
    
    document.body.appendChild(audioEl);
    
    pc.ontrack = (e) => {
      console.log("🔊 Audio remoto recibido");
      audioEl.srcObject = e.streams[0];
      
      // Forzar reproducción con múltiples intentos
      const playAudio = () => {
        audioEl.play()
          .then(() => {
            console.log('✅ Audio reproduciéndose correctamente');
            // Verificar que realmente esté sonando
            if (audioEl.paused) {
              console.warn('⚠️ Audio pausado inesperadamente, reintentando...');
              setTimeout(playAudio, 100);
            }
          })
          .catch(err => {
            console.error("❌ Error reproduciendo audio:", err);
            // Reintentar en caso de error (común en móviles)
            setTimeout(playAudio, 200);
          });
      };
      
      playAudio();
      
      // Monitorear estado del audio
      audioEl.onplaying = () => console.log('🎵 Audio playing');
      audioEl.onpause = () => console.warn('⏸️ Audio pausado');
      audioEl.onerror = (err) => console.error('❌ Error en elemento audio:', err);
    };

    dc = pc.createDataChannel("oai-events");

    dc.onopen = () => {
      console.log("✅ Data channel abierto");
      sendSessionUpdate();
    };

    dc.onmessage = (e) => {
      const event = JSON.parse(e.data);
      handleServerEvent(event);
    };

    micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    updateStatus(realtime.statusMessages.connecting, "processing");

    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=${realtime.model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      }
    );

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    const answer = {
      type: "answer",
      sdp: await response.text(),
    };
    await pc.setRemoteDescription(answer);

    isConnected = true;
    updateStatus(realtime.statusMessages.connected, "success");
  } catch (error) {
    console.error("❌ Error:", error);
    updateStatus(`Error: ${error.message}`, "error");
    cleanup();
  }
}

function sendSessionUpdate() {
  const { realtime } = serverConfig;

  const session = {
    modalities: realtime.modalities,
    instructions: realtime.instructions,
    voice: realtime.voice,
    input_audio_format: realtime.audio.inputFormat,
    output_audio_format: realtime.audio.outputFormat,
    turn_detection: {
      type: realtime.vad.type,
      threshold: realtime.vad.threshold,
      prefix_padding_ms: realtime.vad.prefixPaddingMs,
      silence_duration_ms: realtime.vad.silenceDurationMs,
    },
  };

  if (realtime.transcription.enabled) {
    session.input_audio_transcription = { model: realtime.transcription.model };
  }

  const event = {
    type: "session.update",
    session: session,
  };
  
  console.log("📤 Enviando configuración:", JSON.stringify(event, null, 2));
  dc.send(JSON.stringify(event));
}

function handleServerEvent(event) {
  console.log("📨", event.type, event);
  const { statusMessages } = serverConfig.realtime;

  switch (event.type) {
    case "session.created":
    case "session.updated":
      updateStatus(statusMessages.ready, "success");
      break;

    case "input_audio_buffer.speech_started":
      updateStatus(statusMessages.listening, "listening");
      break;

    case "input_audio_buffer.speech_stopped":
      updateStatus(statusMessages.processing, "processing");
      break;

    case "conversation.item.input_audio_transcription.completed":
      if (event.transcript) addMessage("user", event.transcript);
      break;

    case "conversation.item.input_audio_transcription.failed":
      console.warn("⚠️ Transcripción fallida:", event.error);
      break;

    case "response.audio.delta":
      console.log("🎵 Audio delta recibido");
      break;

    case "response.audio.done":
      console.log("✅ Audio completo");
      break;

    case "response.audio_transcript.delta":
      // Solo procesar si es una nueva respuesta o continuación de la actual
      if (event.response_id && event.response_id !== currentResponseId) {
        currentResponseId = event.response_id;
        lastAssistantMessage = null; // Reset para nueva respuesta
      }
      if (event.delta && !isProcessingResponse) {
        addMessage("assistant", event.delta, true);
      }
      break;

    case "response.audio_transcript.done":
      // Solo procesar si no hemos procesado ya esta respuesta completa
      if (event.transcript && event.response_id !== currentResponseId) {
        currentResponseId = event.response_id;
        lastAssistantMessage = null;
        addMessage("assistant", event.transcript);
      }
      break;

    case "response.done":
      console.log("🏁 Respuesta completa:", event.response);
      isProcessingResponse = false;
      lastAssistantMessage = null;
      updateStatus(statusMessages.ready, "success");
      break;

    case "error":
      console.error("Error:", event.error);
      isProcessingResponse = false;
      updateStatus(
        `${statusMessages.error}: ${event.error?.message || "Desconocido"}`,
        "error"
      );
      break;
  }
}

function cleanup() {
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  if (pc) {
    pc.close();
    pc = null;
  }
  dc = null;
  isConnected = false;
}

async function toggleRecording() {
  // Activar audio automáticamente al primer clic (crítico para móviles)
  if (!audioActivated) {
    activateAudio();
  }
  
  if (!isConnected) {
    await connectRealtime();
    document
      .getElementById("micCircle")
      .classList.add("scale-110", "shadow-2xl");
    document.getElementById("pulse").classList.remove("hidden");
  } else {
    cleanup();
    updateStatus(serverConfig.realtime.statusMessages.disconnected, "error");
    document
      .getElementById("micCircle")
      .classList.remove("scale-110", "shadow-2xl");
    document.getElementById("pulse").classList.add("hidden");
  }
}

function updateStatus(text, type) {
  const status = document.getElementById("status");
  const colors = {
    success: "bg-green-100 text-green-800",
    listening: "bg-blue-100 text-blue-800",
    processing: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
  };
  status.innerHTML = `
    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
      colors[type] || colors.success
    }">
      <span class="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></span>
      ${text}
    </span>
  `;
}

function addMessage(role, text, isPartial = false) {
  const conversation = document.getElementById("conversation");
  if (!text || text.trim() === "") return;

  if (role === "assistant" && isPartial) {
    isProcessingResponse = true;
    if (!lastAssistantMessage) {
      lastAssistantMessage = document.createElement("div");
      lastAssistantMessage.className = "flex items-start space-x-3 mb-4";
      lastAssistantMessage.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <span class="text-white text-sm">🤖</span>
        </div>
        <div class="flex-1 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl rounded-tl-none p-4">
          <p class="text-gray-800"></p>
        </div>
      `;
      conversation.appendChild(lastAssistantMessage);
    }
    const textElement = lastAssistantMessage.querySelector("p");
    textElement.textContent += text;
  } else {
    // Solo crear nuevo mensaje si no estamos en modo parcial
    if (!isProcessingResponse) {
      const messageDiv = document.createElement("div");
      messageDiv.className =
        role === "user"
          ? "flex items-start space-x-3 justify-end mb-4"
          : "flex items-start space-x-3 mb-4";
      messageDiv.innerHTML =
        role === "user"
          ? `
          <div class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl rounded-tr-none p-4 max-w-md ml-auto">
            <p>${escapeHtml(text)}</p>
          </div>
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <span class="text-white text-sm">👤</span>
          </div>
        `
          : `
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span class="text-white text-sm">🤖</span>
          </div>
          <div class="flex-1 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl rounded-tl-none p-4">
            <p class="text-gray-800">${escapeHtml(text)}</p>
          </div>
        `;
      conversation.appendChild(messageDiv);
    }
  }

  conversation.scrollTop = conversation.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
