let ws = null;
let audioContext = null;
let audioQueue = [];
let isPlaying = false;

async function connectRealtime() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/realtime`;
  
  ws = new WebSocket(wsUrl);
  audioContext = new AudioContext({ sampleRate: 24000 });

  ws.onopen = () => {
    console.log('✅ Conectado a Realtime');
    updateStatus('Conectado - Habla cuando quieras', 'success');
  };

  ws.onmessage = async (event) => {
    const data = typeof event.data === 'string' ? event.data : await event.data.text();
    const serverEvent = JSON.parse(data);
    handleServerEvent(serverEvent);
  };

  ws.onerror = (error) => {
    console.error('❌ Error WebSocket:', error);
    updateStatus('Error de conexión', 'error');
  };

  ws.onclose = () => {
    console.log('🔌 Desconectado');
    updateStatus('Desconectado', 'error');
  };
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

    case 'response.audio_transcript.delta':
      addMessage('assistant', event.delta, true);
      break;

    case 'response.audio.delta':
      if (event.delta) {
        queueAudio(event.delta);
      }
      break;

    case 'response.done':
      updateStatus('Listo - Habla cuando quieras', 'success');
      break;

    case 'error':
      console.error('Error:', event);
      updateStatus('Error: ' + event.error.message, 'error');
      break;
  }
}

function queueAudio(base64Audio) {
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }

  audioQueue.push(float32);
  if (!isPlaying) playNextAudio();
}

async function playNextAudio() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const audioData = audioQueue.shift();
  const audioBuffer = audioContext.createBuffer(1, audioData.length, 24000);
  audioBuffer.getChannelData(0).set(audioData);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.onended = () => playNextAudio();
  source.start();
}

async function startMicrophone() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  
  mediaRecorder.ondataavailable = async (event) => {
    if (event.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
      const arrayBuffer = await event.data.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const pcm16 = convertToPCM16(audioBuffer);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
      
      ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64
      }));
    }
  };

  mediaRecorder.start(100);
  return { mediaRecorder, stream };
}

function convertToPCM16(audioBuffer) {
  const float32 = audioBuffer.getChannelData(0);
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm16;
}

let currentRecording = null;

async function toggleRecording() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    await connectRealtime();
    return;
  }

  if (!currentRecording) {
    currentRecording = await startMicrophone();
    document.getElementById('micCircle').classList.add('scale-110', 'shadow-2xl');
    document.getElementById('pulse').classList.remove('hidden');
  } else {
    currentRecording.mediaRecorder.stop();
    currentRecording.stream.getTracks().forEach(track => track.stop());
    currentRecording = null;
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

connectRealtime();
