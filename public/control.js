let ws = null;
let isConnected = false;
let espIp = '192.168.1.100';
let motorValue = 90;
let servoValue = 90;
let statusInterval = null;
let faceWs = null;
let faceClients = [];

function log(message, type = 'info') {
  const logsDiv = document.getElementById('logs');
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: 'text-green-400',
    error: 'text-red-400',
    success: 'text-cyan-400',
    warning: 'text-yellow-400'
  };
  
  const logEntry = document.createElement('p');
  logEntry.className = colors[type];
  logEntry.textContent = `[${timestamp}] ${message}`;
  logsDiv.appendChild(logEntry);
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  const btnEl = document.getElementById('connectBtn');
  
  isConnected = connected;
  
  if (connected) {
    statusEl.innerHTML = `<span class="text-green-400">✅ Conectado a ${espIp}</span>`;
    btnEl.textContent = 'Desconectar';
    btnEl.className = 'px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition';
  } else {
    statusEl.innerHTML = '<span class="text-red-400">❌ Desconectado</span>';
    btnEl.textContent = 'Conectar';
    btnEl.className = 'px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition';
  }
}

function toggleConnection() {
  if (isConnected) {
    disconnect();
  } else {
    connect();
  }
}

function connect() {
  espIp = document.getElementById('espIp').value;
  
  try {
    ws = new WebSocket(`ws://${espIp}/ws`);
    
    ws.onopen = () => {
      log(`Conexión establecida con ESP32 en ${espIp}`, 'success');
      updateConnectionStatus(true);
      startStatusPolling();
    };
    
    ws.onmessage = (event) => {
      log(`Mensaje recibido: ${event.data}`, 'info');
    };
    
    ws.onerror = (error) => {
      log(`Error de conexión: ${error.message || 'Desconocido'}`, 'error');
      updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
      log('Conexión cerrada', 'warning');
      updateConnectionStatus(false);
      stopStatusPolling();
    };
    
  } catch (error) {
    log(`Error al conectar: ${error.message}`, 'error');
    updateConnectionStatus(false);
  }
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  stopStatusPolling();
  updateConnectionStatus(false);
  log('Desconectado manualmente', 'info');
}

function sendCommand(data) {
  if (!isConnected || !ws) {
    log('No hay conexión activa', 'error');
    return;
  }
  
  try {
    ws.send(JSON.stringify(data));
    log(`Comando enviado: ${JSON.stringify(data)}`, 'success');
  } catch (error) {
    log(`Error al enviar comando: ${error.message}`, 'error');
  }
}

// Actualizar displays de valores
function updateDisplayValues() {
  document.getElementById('motorValue').textContent = `${motorValue}°`;
  document.getElementById('servoValue').textContent = `${servoValue}°`;
  
  // Actualizar indicador visual del motor
  const percentage = (motorValue / 180) * 100;
  document.getElementById('motorIndicator').style.width = `${percentage}%`;
  
  // Actualizar flecha del servo
  const rotation = (servoValue - 90);
  document.getElementById('servoArrow').style.transform = `rotate(${rotation}deg)`;
}

// Enviar comando actualizado
function sendCurrentValues() {
  sendCommand({ motor: motorValue, servo: servoValue });
  updateDisplayValues();
}

// Control con sliders
function updateMotorSlider(value) {
  motorValue = Number.parseInt(value, 10);
  document.getElementById('motorSliderValue').textContent = motorValue;
  sendCurrentValues();
}

function updateServoSlider(value) {
  servoValue = Number.parseInt(value, 10);
  document.getElementById('servoSliderValue').textContent = servoValue;
  sendCurrentValues();
}

// Polling de estado del ESP32
function startStatusPolling() {
  statusInterval = setInterval(() => {
    if (!espIp) return;
    
    fetch(`http://${espIp}/status`)
      .then(r => r.text())
      .then(text => {
        // Mostrar estado en los logs ocasionalmente
        if (Math.random() < 0.1) { // 10% de las veces
          log(`Estado ESP32: ${text}`, 'info');
        }
      })
      .catch(() => {
        // Silencioso en caso de error
      });
  }, 2000);
}

function stopStatusPolling() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}

function updateMotor(value) {
  document.getElementById('motorValue').textContent = value;
  
  // Actualizar indicador visual
  const percentage = (value / 180) * 100;
  document.getElementById('motorIndicator').style.width = `${percentage}%`;
  
  sendCommand({ motor: Number.parseInt(value, 10) });
}

function setMotor(value) {
  document.getElementById('motorSlider').value = value;
  updateMotor(value);
}

function updateServo(value) {
  document.getElementById('servoValue').textContent = value;
  
  // Actualizar flecha (0° = -90deg, 90° = 0deg, 180° = 90deg)
  const rotation = (value - 90);
  document.getElementById('servoArrow').style.transform = `rotate(${rotation}deg)`;
  
  sendCommand({ servo: Number.parseInt(value, 10) });
}

function setServo(value) {
  document.getElementById('servoSlider').value = value;
  updateServo(value);
}

// Cargar IP guardada del localStorage
window.addEventListener('load', () => {
  const savedIp = localStorage.getItem('espIp');
  if (savedIp) {
    document.getElementById('espIp').value = savedIp;
    espIp = savedIp;
  }
  
  // Guardar IP cuando cambia
  document.getElementById('espIp').addEventListener('change', (e) => {
    localStorage.setItem('espIp', e.target.value);
  });
  
  // Setup sliders
  document.getElementById('motorSlider').addEventListener('input', (e) => {
    updateMotorSlider(e.target.value);
  });
  
  document.getElementById('servoSlider').addEventListener('input', (e) => {
    updateServoSlider(e.target.value);
  });
  
  // Setup gamepad buttons
  setupGamepad();
  
  log('Panel de control iniciado', 'success');
  
  // Auto-conectar si hay IP guardada
  if (savedIp) {
    log('IP guardada detectada, puedes conectar automáticamente', 'info');
  }
});

// ========== GAMEPAD CONTROL ==========
function setupGamepad() {
  const btnUp = document.getElementById('btnUp');
  const btnDown = document.getElementById('btnDown');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnStop = document.getElementById('btnStop');
  
  // Botones de movimiento (motor)
  btnUp.addEventListener('mousedown', () => {
    motorValue = 150;
    sendCurrentValues();
  });
  
  btnUp.addEventListener('mouseup', () => {
    motorValue = 90;
    sendCurrentValues();
  });
  
  btnUp.addEventListener('mouseleave', () => {
    if (motorValue !== 90) {
      motorValue = 90;
      sendCurrentValues();
    }
  });
  
  btnDown.addEventListener('mousedown', () => {
    motorValue = 30;
    sendCurrentValues();
  });
  
  btnDown.addEventListener('mouseup', () => {
    motorValue = 90;
    sendCurrentValues();
  });
  
  btnDown.addEventListener('mouseleave', () => {
    if (motorValue !== 90) {
      motorValue = 90;
      sendCurrentValues();
    }
  });
  
  // Botones de dirección (servo)
  btnLeft.addEventListener('mousedown', () => {
    servoValue = 60;
    sendCurrentValues();
  });
  
  btnLeft.addEventListener('mouseup', () => {
    servoValue = 90;
    sendCurrentValues();
  });
  
  btnRight.addEventListener('mousedown', () => {
    servoValue = 120;
    sendCurrentValues();
  });
  
  btnRight.addEventListener('mouseup', () => {
    servoValue = 90;
    sendCurrentValues();
  });
  
  // Botón de stop
  btnStop.addEventListener('click', () => {
    motorValue = 90;
    servoValue = 90;
    sendCurrentValues();
    log('🛑 STOP - Valores reseteados', 'warning');
  });
  
  // Soporte táctil para móviles
  [btnUp, btnDown].forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.dispatchEvent(new Event('mousedown'));
    });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      btn.dispatchEvent(new Event('mouseup'));
    });
  });
  
  [btnLeft, btnRight, btnStop].forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.dispatchEvent(new Event('mousedown'));
    });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (btn === btnStop) {
        btn.dispatchEvent(new Event('click'));
      } else {
        btn.dispatchEvent(new Event('mouseup'));
      }
    });
  });
}

// ========== CONTROL DE EMOCIONES ==========
function connectFaceControl() {
  const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${globalThis.location.host}/face-control`;
  
  try {
    faceWs = new WebSocket(wsUrl);
    
    faceWs.onopen = () => {
      console.log('✅ Control de rostro conectado');
      log('Control de rostro listo', 'success');
    };
    
    faceWs.onerror = (error) => {
      console.error('Error en control de rostro:', error);
    };
    
    faceWs.onclose = () => {
      console.log('Control de rostro desconectado');
      setTimeout(connectFaceControl, 2000);
    };
    
  } catch (error) {
    console.error('Error al conectar control de rostro:', error);
  }
}

function sendEmotion(emotion) {
  if (!faceWs || faceWs.readyState !== WebSocket.OPEN) {
    log('Control de rostro no conectado, intentando...', 'warning');
    connectFaceControl();
    return;
  }
  
  try {
    faceWs.send(JSON.stringify({ emotion }));
    log(`Emoción enviada: ${emotion}`, 'success');
  } catch (error) {
    log(`Error enviando emoción: ${error.message}`, 'error');
  }
}

// Iniciar conexión de control de rostro
connectFaceControl();
