let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function updateStatus(message, type = 'idle') {
  const statusEl = document.getElementById('status');
  const colors = {
    idle: 'bg-gray-100 text-gray-800',
    recording: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800'
  };
  const dotColors = {
    idle: 'bg-gray-400',
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

async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      await processAudio();
    };
    
    mediaRecorder.start();
    isRecording = true;
    
    updateStatus('🎙️ Grabando... Presiona de nuevo para detener', 'recording');
    document.getElementById('pulse').classList.remove('hidden');
    document.getElementById('micCircle').classList.add('scale-110', 'bg-red-500');
  } catch (error) {
    console.error('Error al acceder al micrófono:', error);
    addMessage('❌ Error al acceder al micrófono. Por favor, permite el acceso.', false);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    isRecording = false;
    
    updateStatus('📤 Procesando...', 'processing');
    document.getElementById('pulse').classList.add('hidden');
    document.getElementById('micCircle').classList.remove('scale-110', 'bg-red-500');
  }
}

async function processAudio() {
  try {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    
    const response = await fetch('/api/process-audio', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Error al procesar el audio');
    }
    
    const data = await response.json();
    
    addMessage(data.transcription, true);
    addMessage(data.response, false);
    
    updateStatus('Presiona el micrófono para hablar', 'idle');
  } catch (error) {
    console.error('Error:', error);
    addMessage('❌ Error al procesar el audio. Intenta de nuevo.', false);
    updateStatus('Presiona el micrófono para hablar', 'idle');
  }
}
