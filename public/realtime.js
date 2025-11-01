let pc = null;
let dc = null;
let micStream = null;
let isConnected = false;

const API_KEY = 'OPENAI_API_KEY'; // Se obtiene del servidor

async function getApiKey() {
  const res = await fetch('/api/config');
  const config = await res.json();
  return config.openaiApiKey;
}

async function connectRealtime() {
  try {
    updateStatus('Solicitando micrófono...', 'processing');
    
    const apiKey = await getApiKey();
    
    // 1. Capturar micrófono
    micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    updateStatus('Creando sesión WebRTC...', 'processing');

    // 2. Crear peer connection
    pc = new RTCPeerConnection();

    // 3. Audio remoto (respuesta del modelo)
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
    };

    // 4. Data channel para eventos
    dc = pc.createDataChannel('oai-events');
    
    dc.onopen = () => {
      console.log('✅ Data channel abierto');
      sendSessionUpdate();
    };

    dc.onmessage = (e) => {
      const event = JSON.parse(e.data);
      handleServerEvent(event);
    };

    // 5. Añadir pistas locales
    micStream.getTracks().forEach(track => pc.addTrack(track, micStream));

    // 6. Crear oferta
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    updateStatus('Conectando con GPT-4o...', 'processing');

    // 7. Enviar oferta a OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/sdp'
      },
      body: offer.sdp
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    // 8. Establecer respuesta remota
    const answer = {
      type: 'answer',
      sdp: await response.text()
    };
    await pc.setRemoteDescription(answer);

    isConnected = true;
    updateStatus('✅ Conectado - Habla cuando quieras', 'success');

  } catch (error) {
    console.error('❌ Error:', error);
    updateStatus('Error: ' + error.message, 'error');
    cleanup();
  }
}

function sendSessionUpdate() {
  const event = {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: 'Eres un asistente amigable de SENATI en Perú. Responde brevemente en español sobre carreras, admisión, sedes y costos.',
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    }
  };
  
  dc.send(JSON.stringify(event));
}

function handleServerEvent(event) {
  console.log('📨', event.type);

  switch (event.type) {
    case 'session.created':
    case 'session.updated':
      updateStatus('Listo - Habla cuando quieras', 'success');
      break;

    case 'input_audio_buffer.speech_started':
      updateStatus('Escuchando...', 'listening');
      break;

    case 'input_audio_buffer.speech_stopped':
      updateStatus('Procesando...', 'processing');
      break;

    case 'conversation.item.input_audio_transcription.completed':
      if (event.transcript) {
        addMessage('user', event.transcript);
      }
      break;

    case 'response.audio_transcript.delta':
      addMessage('assistant', event.delta, true);
      break;

    case 'response.done':
      updateStatus('Listo - Habla cuando quieras', 'success');
      break;

    case 'error':
      console.error('Error:', event.error);
      updateStatus('Error: ' + (event.error?.message || 'Desconocido'), 'error');
      break;
  }
}

function cleanup() {
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
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
  if (!isConnected) {
    await connectRealtime();
    document.getElementById('micCircle').classList.add('scale-110', 'shadow-2xl');
    document.getElementById('pulse').classList.remove('hidden');
  } else {
    cleanup();
    updateStatus('Desconectado', 'error');
    document.getElementById('micCircle').classList.remove('scale-110', 'shadow-2xl');
    document.getElementById('pulse').classList.add('hidden');
  }
}

function updateStatus(text, type) {
  const status = document.getElementById('status');
  const colors = {
    success: 'bg-green-100 text-green-800',
    listening: 'bg-blue-100 text-blue-800',
    processing: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800'
  };
  status.innerHTML = `
    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${colors[type] || colors.success}">
      <span class="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></span>
      ${text}
    </span>
  `;
}

let lastAssistantMessage = null;

function addMessage(role, text, isPartial = false) {
  const conversation = document.getElementById('conversation');
  
  if (role === 'assistant' && isPartial) {
    if (!lastAssistantMessage) {
      lastAssistantMessage = document.createElement('div');
      lastAssistantMessage.className = 'flex items-start space-x-3';
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
    lastAssistantMessage.querySelector('p').textContent += text;
  } else {
    lastAssistantMessage = null;
    const messageDiv = document.createElement('div');
    messageDiv.className = role === 'user' ? 'flex items-start space-x-3 justify-end' : 'flex items-start space-x-3';
    messageDiv.innerHTML = role === 'user' 
      ? `
        <div class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl rounded-tr-none p-4 max-w-md ml-auto">
          <p>${text}</p>
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
          <p class="text-gray-800">${text}</p>
        </div>
      `;
    conversation.appendChild(messageDiv);
  }
  
  conversation.scrollTop = conversation.scrollHeight;
}
