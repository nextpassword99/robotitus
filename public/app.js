import { PorcupineWorker } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';
import { CONFIG } from './config.js';

const KEYWORDS = [
  { label: "emparedado", publicPath: "keywords/emparedado_wasm.ppn", customWritePath: "3.0.0_emparedado_wasm.ppn", sensitivity: 0.7 },
  { label: "leopardo", publicPath: "keywords/leopardo_wasm.ppn", customWritePath: "3.0.0_leopardo_wasm.ppn", sensitivity: 0.7 },
  { label: "manzana", publicPath: "keywords/manzana_wasm.ppn", customWritePath: "3.0.0_manzana_wasm.ppn", sensitivity: 0.7 },
  { label: "murciélago", publicPath: "keywords/murciélago_wasm.ppn", customWritePath: "3.0.0_murciélago_wasm.ppn", sensitivity: 0.7 }
];

const MODEL = {
  publicPath: "models/porcupine_params_es.pv",
  customWritePath: "3.0.0_porcupine_params_es.pv"
};

const { ACCESS_KEY, RECORDING_DURATION_MS, API_BASE_URL } = CONFIG;

let porcupine = null;
let isListening = false;
let isRecording = false;
let recordedChunks = [];

window.addEventListener('load', () => {
  const select = document.getElementById('keywords');
  KEYWORDS.forEach((k, i) => {
    const option = document.createElement('option');
    option.textContent = k.label.charAt(0).toUpperCase() + k.label.slice(1);
    option.value = i;
    select.appendChild(option);
  });
});

function updateStatus(message, type = 'idle') {
  const statusEl = document.getElementById('status');
  const colors = {
    idle: 'bg-gray-100 text-gray-800',
    listening: 'bg-green-100 text-green-800',
    recording: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800'
  };
  const dotColors = {
    idle: 'bg-gray-400',
    listening: 'bg-green-500 animate-pulse',
    recording: 'bg-red-500 animate-pulse',
    processing: 'bg-blue-500 animate-pulse'
  };
  
  statusEl.innerHTML = `
    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${colors[type]}">
      <span class="w-2 h-2 ${dotColors[type]} rounded-full mr-2"></span>
      ${message}
    </span>
  `;
}

function addMessage(text, isUser = false) {
  const conversation = document.getElementById('conversation');
  
  if (conversation.querySelector('.text-gray-400')) {
    conversation.innerHTML = '';
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
  
  messageDiv.innerHTML = `
    <div class="max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
      isUser 
        ? 'bg-indigo-600 text-white rounded-br-none' 
        : 'bg-gray-100 text-gray-800 rounded-bl-none'
    }">
      <p class="text-sm">${text}</p>
    </div>
  `;
  
  conversation.appendChild(messageDiv);
  conversation.scrollTop = conversation.scrollHeight;
}

async function onKeywordDetected(detection) {
  console.log(`🔔 Palabra detectada: ${detection.label}`);
  addMessage(`🔔 Palabra clave detectada: "${detection.label}"`, false);
  await recordCommand();
}

async function recordCommand() {
  if (isRecording) return;
  
  isRecording = true;
  recordedChunks = [];
  updateStatus('🎙️ Grabando tu pregunta...', 'recording');
  
  const mediaRecorder = await startMediaRecorder();
  
  setTimeout(async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, RECORDING_DURATION_MS);
}

async function startMediaRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(track => track.stop());
    await processRecording();
    isRecording = false;
  };
  
  mediaRecorder.start();
  return mediaRecorder;
}

async function processRecording() {
  updateStatus('📤 Procesando...', 'processing');
  
  try {
    const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'command.webm');
    
    const response = await fetch(`${API_BASE_URL}/process-audio`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    addMessage(data.transcription, true);
    addMessage(data.response, false);
    
    updateStatus('✅ Escuchando palabra clave...', 'listening');
  } catch (error) {
    console.error('Error:', error);
    addMessage('❌ Error al procesar el audio', false);
    updateStatus('✅ Escuchando palabra clave...', 'listening');
  }
}

window.toggleListening = async function() {
  if (isListening) {
    await stopListening();
  } else {
    await startListening();
  }
};

async function startListening() {
  const keywordIndex = parseInt(document.getElementById('keywords').value);
  
  updateStatus('Cargando...', 'processing');
  
  try {
    porcupine = await PorcupineWorker.create(
      ACCESS_KEY,
      [KEYWORDS[keywordIndex]],
      onKeywordDetected,
      MODEL
    );

    await WebVoiceProcessor.subscribe(porcupine);
    
    isListening = true;
    updateStatus('✅ Escuchando palabra clave...', 'listening');
    document.getElementById('pulse').classList.remove('hidden');
    document.getElementById('micBtn').classList.add('scale-110');
  } catch (err) {
    console.error('Error:', err);
    updateStatus('❌ Error al iniciar', 'idle');
    addMessage(`Error: ${err.message}`, false);
  }
}

async function stopListening() {
  if (porcupine) {
    await WebVoiceProcessor.unsubscribe(porcupine);
    await porcupine.terminate();
    porcupine = null;
  }
  
  isListening = false;
  updateStatus('Detenido', 'idle');
  document.getElementById('pulse').classList.add('hidden');
  document.getElementById('micBtn').classList.remove('scale-110');
}
