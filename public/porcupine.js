import { PorcupineWorker } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

const porcupineKeywords = [
  { label: "emparedado", publicPath: "keywords/emparedado_wasm.ppn", customWritePath: "3.0.0_emparedado_wasm.ppn", sensitivity: 0.7 },
  { label: "leopardo", publicPath: "keywords/leopardo_wasm.ppn", customWritePath: "3.0.0_leopardo_wasm.ppn", sensitivity: 0.7 },
  { label: "manzana", publicPath: "keywords/manzana_wasm.ppn", customWritePath: "3.0.0_manzana_wasm.ppn", sensitivity: 0.7 },
  { label: "murciélago", publicPath: "keywords/murciélago_wasm.ppn", customWritePath: "3.0.0_murciélago_wasm.ppn", sensitivity: 0.7 }
];

const porcupineModel = {
  publicPath: "models/porcupine_params_es.pv",
  customWritePath: "3.0.0_porcupine_params_es.pv"
};

let porcupine = null;
let isRecording = false;
let recordedFrames = [];
const RECORDING_DURATION_MS = 5000;

window.addEventListener('load', () => {
  const select = document.getElementById('keywords');
  porcupineKeywords.forEach((k, i) => {
    const el = document.createElement('option');
    el.textContent = k.label;
    el.value = i;
    select.appendChild(el);
  });
});

function writeMessage(message) {
  console.log(message);
  document.getElementById('status').innerHTML = `Estado: ${message}`;
}

async function porcupineKeywordCallback(detection) {
  const time = new Date();
  const message = `🔔 Palabra detectada: ${detection.label} (${time.toLocaleTimeString()})`;
  console.log(message);
  document.getElementById('result').innerHTML = message;
  
  await recordCommand();
}

async function recordCommand() {
  if (isRecording) return;
  
  isRecording = true;
  recordedFrames = [];
  writeMessage('🎙️ Grabando comando...');
  
  const startTime = Date.now();
  
  const recordInterval = setInterval(() => {
    if (Date.now() - startTime >= RECORDING_DURATION_MS) {
      clearInterval(recordInterval);
      isRecording = false;
      processRecording();
    }
  }, 100);
}

async function processRecording() {
  writeMessage('📤 Enviando audio...');
  
  try {
    const audioBlob = new Blob(recordedFrames, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'command.wav');
    
    const response = await fetch('/api/process-audio', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    document.getElementById('result').innerHTML = `
      📝 Transcripción: ${data.transcription}<br>
      💬 Respuesta: ${data.response}
    `;
    
    writeMessage('✅ Listo - Escuchando palabra clave...');
  } catch (error) {
    console.error('Error:', error);
    writeMessage('❌ Error procesando audio');
  }
}

window.startPorcupine = async function() {
  const keywordIndex = parseInt(document.getElementById('keywords').value);
  const accessKey = 'e52jZGc5CoakyDBGY44MaD5PtJtgONGq3HxLqWQNEwp6TPrTreXOIA==';
  
  if (WebVoiceProcessor.isRecording) {
    await WebVoiceProcessor.unsubscribe(porcupine);
    await porcupine.terminate();
  }

  writeMessage('Cargando Porcupine...');
  
  try {
    porcupine = await PorcupineWorker.create(
      accessKey,
      [porcupineKeywords[keywordIndex]],
      porcupineKeywordCallback,
      porcupineModel
    );

    writeMessage('Porcupine listo');
    await WebVoiceProcessor.subscribe(porcupine);
    
    writeMessage('✅ Escuchando palabra clave...');
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
  } catch (err) {
    writeMessage(`Error: ${err.message}`);
  }
};

window.stopPorcupine = async function() {
  if (porcupine) {
    await WebVoiceProcessor.unsubscribe(porcupine);
    await porcupine.terminate();
    porcupine = null;
  }
  
  writeMessage('Detenido');
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
};
