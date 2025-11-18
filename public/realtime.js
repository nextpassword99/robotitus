let serverConfig = null;
let pc = null;
let dc = null;
let micStream = null;
let isConnected = false;
let lastAssistantMessage = null;
let currentResponseId = null;
let audioActivated = false;
let dummyAudioContext = null;

// Cargar config al inicio
(async () => {
  const res = await fetch("/api/config");
  serverConfig = await res.json();
  console.log("✅ Configuración cargada");
  checkMobileAudio();
})();

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

function activateAudio() {
  if (audioActivated) return;
  
  try {
    dummyAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = dummyAudioContext.createOscillator();
    const gainNode = dummyAudioContext.createGain();
    gainNode.gain.value = 0.001;
    oscillator.connect(gainNode);
    gainNode.connect(dummyAudioContext.destination);
    oscillator.start();
    oscillator.stop(dummyAudioContext.currentTime + 0.1);
    
    audioActivated = true;
    console.log('✅ Audio activado para Bluetooth');
  } catch (error) {
    console.error('Error activando audio:', error);
  }
}

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

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.controls = false;
    audioEl.volume = 1.0;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);
    
    pc.ontrack = (e) => {
      console.log("🔊 Audio remoto recibido");
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(err => console.error("Error reproduciendo audio:", err));
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
    input_audio_transcription: realtime.transcription.enabled 
      ? { model: realtime.transcription.model } 
      : null,
    turn_detection: {
      type: realtime.vad.type,
      threshold: realtime.vad.threshold,
      prefix_padding_ms: realtime.vad.prefixPaddingMs,
      silence_duration_ms: realtime.vad.silenceDurationMs,
    },
  };

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

    case "response.audio_transcript.done":
      if (event.transcript) {
        // Solo mostrar el texto completo final
        showAssistantMessage(event.transcript);
      }
      break;

    case "response.done":
      console.log("🏁 Respuesta completa:", event.response);
      lastAssistantMessage = null;
      currentResponseId = null;
      updateStatus(statusMessages.ready, "success");
      break;

    case "error":
      console.error("Error:", event.error);
      updateStatus(
        `${statusMessages.error}: ${event.error?.message || "Desconocido"}`,
        "error"
      );
      break;
  }
}

function showAssistantMessage(text) {
  const conversation = document.getElementById("conversation");
  if (!text || text.trim() === "") return;

  // Crear nueva burbuja para cada respuesta completa
  const messageDiv = document.createElement("div");
  messageDiv.className = "flex items-start space-x-3 mb-4";
  messageDiv.innerHTML = `
    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/50 border border-cyan-400/50">
      <span class="text-white text-sm">🤖</span>
    </div>
    <div class="flex-1 bg-gradient-to-r from-slate-800/80 to-purple-900/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-4 shadow-sm border border-cyan-500/30">
      <p class="text-cyan-100 font-medium">${escapeHtml(text)}</p>
    </div>
  `;
  conversation.appendChild(messageDiv);
  conversation.scrollTop = conversation.scrollHeight;
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
  if (!audioActivated) {
    activateAudio();
  }
  
  if (!isConnected) {
    await connectRealtime();
    document.getElementById("micCircle").classList.add("scale-110", "shadow-2xl");
    document.getElementById("pulse").classList.remove("hidden");
  } else {
    cleanup();
    updateStatus(serverConfig.realtime.statusMessages.disconnected, "error");
    document.getElementById("micCircle").classList.remove("scale-110", "shadow-2xl");
    document.getElementById("pulse").classList.add("hidden");
  }
}

function updateStatus(text, type) {
  const status = document.getElementById("status");
  const colors = {
    success: "bg-green-900/50 text-green-300 border border-green-500/30",
    listening: "bg-cyan-900/50 text-cyan-300 border border-cyan-500/30",
    processing: "bg-yellow-900/50 text-yellow-300 border border-yellow-500/30",
    error: "bg-red-900/50 text-red-300 border border-red-500/30",
  };
  status.innerHTML = `
    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm ${
      colors[type] || colors.success
    }">
      <span class="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></span>
      ${text}
    </span>
  `;
}

function addMessage(role, text) {
  const conversation = document.getElementById("conversation");
  if (!text || text.trim() === "") return;

  if (role === "user") {
    const messageDiv = document.createElement("div");
    messageDiv.className = "flex items-start space-x-3 justify-end mb-4";
    messageDiv.innerHTML = `
      <div class="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-none p-4 max-w-md ml-auto shadow-lg border border-blue-400/50">
        <p class="font-medium">${escapeHtml(text)}</p>
      </div>
      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg border border-blue-400/50">
        <span class="text-white text-sm">👤</span>
      </div>
    `;
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}