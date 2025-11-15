let ws = null;
let isConnected = false;
let espIp = 'esp.trodi.dev';
let useSSL = true; // Forzar SSL (wss/https)
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
  useSSL = document.getElementById('useSSL').checked;
  
  const protocol = useSSL ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${espIp}/ws`;
  
  log(`🔌 Intentando conectar a ${wsUrl}...`, 'info');
  log(`📋 Protocolo: ${protocol.toUpperCase()}, Host: ${espIp}`, 'info');
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = (event) => {
      log(`✅ WebSocket ABIERTO exitosamente`, 'success');
      log(`📡 URL: ${event.target.url}`, 'success');
      log(`🔒 Protocolo usado: ${event.target.protocol || 'default'}`, 'info');
      updateConnectionStatus(true);
      startStatusPolling();
    };
    
    ws.onmessage = (event) => {
      log(`📨 Mensaje: ${event.data}`, 'info');
    };
    
    ws.onerror = (event) => {
      log(`❌ ERROR WebSocket detectado`, 'error');
      log(`🔍 Target URL: ${event.target?.url || 'N/A'}`, 'error');
      log(`🔍 ReadyState: ${event.target?.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`, 'error');
      
      if (useSSL) {
        log(`⚠️ Error con SSL. Posibles causas:`, 'warning');
        log(`   • Certificado SSL inválido o autofirmado`, 'warning');
        log(`   • Túnel no configurado para WebSocket`, 'warning');
        log(`   • Mixed content (HTTPS → WS)`, 'warning');
        log(`💡 Intenta desactivar SSL si es red local`, 'warning');
      } else {
        log(`⚠️ Error sin SSL. Posibles causas:`, 'warning');
        log(`   • ESP32 no accesible en ${espIp}`, 'warning');
        log(`   • Firewall bloqueando puerto 80`, 'warning');
        log(`   • IP incorrecta`, 'warning');
      }
      
      updateConnectionStatus(false);
    };
    
    ws.onclose = (event) => {
      const reasons = {
        1000: 'Cierre normal',
        1001: 'Endpoint desaparecido',
        1002: 'Error de protocolo',
        1003: 'Datos no aceptados',
        1006: 'Conexión perdida (sin handshake)',
        1007: 'Datos inválidos',
        1008: 'Política violada',
        1009: 'Mensaje muy grande',
        1011: 'Error del servidor',
        1015: 'Fallo TLS/SSL'
      };
      
      const reason = reasons[event.code] || 'Desconocido';
      log(`🔌 Conexión CERRADA`, 'warning');
      log(`📋 Código: ${event.code} - ${reason}`, 'warning');
      log(`📋 Razón: ${event.reason || 'Sin detalles'}`, 'warning');
      log(`📋 Clean: ${event.wasClean ? 'Sí' : 'No (abrupto)'}`, 'warning');
      
      if (event.code === 1006) {
        log(`⚠️ Código 1006 indica problema de red o SSL`, 'error');
      }
      if (event.code === 1015) {
        log(`⚠️ Código 1015: Fallo SSL/TLS - Verifica certificado`, 'error');
      }
      
      updateConnectionStatus(false);
      stopStatusPolling();
    };
    
  } catch (error) {
    log(`💥 EXCEPCIÓN al crear WebSocket: ${error.name}`, 'error');
    log(`📋 Mensaje: ${error.message}`, 'error');
    log(`📋 Stack: ${error.stack?.split('\n')[0] || 'N/A'}`, 'error');
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
    
    const protocol = useSSL ? 'https' : 'http';
    
    fetch(`${protocol}://${espIp}/status`)
      .then(r => r.text())
      .then(text => {
        if (Math.random() < 0.1) {
          log(`📊 Estado: ${text}`, 'info');
        }
      })
      .catch(err => {
        if (Math.random() < 0.05) {
          log(`⚠️ Polling falló: ${err.message}`, 'warning');
        }
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
  
  // Guardar IP y SSL cuando cambian
  document.getElementById('espIp').addEventListener('change', (e) => {
    localStorage.setItem('espIp', e.target.value);
  });
  
  const savedSSL = localStorage.getItem('useSSL');
  if (savedSSL !== null) {
    document.getElementById('useSSL').checked = savedSSL === 'true';
    useSSL = savedSSL === 'true';
  }
  
  document.getElementById('useSSL').addEventListener('change', (e) => {
    localStorage.setItem('useSSL', e.target.checked);
    useSSL = e.target.checked;
    log(`🔒 SSL ${e.target.checked ? 'activado' : 'desactivado'}`, 'info');
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/face-control`;
  
  try {
    faceWs = new WebSocket(wsUrl);
    
    faceWs.onopen = () => {
      console.log('✅ Control de rostro conectado');
      log('😊 Control de rostro listo', 'success');
    };
    
    faceWs.onerror = (error) => {
      console.error('❌ Error en control de rostro:', error);
      log(`⚠️ Control de rostro: Error de conexión (${wsUrl})`, 'warning');
    };
    
    faceWs.onclose = (event) => {
      console.log('🔌 Control de rostro desconectado');
      if (event.code !== 1000) {
        log(`⚠️ Control de rostro desconectado (código ${event.code})`, 'warning');
      }
      setTimeout(connectFaceControl, 5000);
    };
    
  } catch (error) {
    console.error('💥 Excepción al conectar control de rostro:', error);
    log(`❌ Error al conectar control de rostro: ${error.message}`, 'error');
  }
}

function sendEmotion(emotion) {
  if (!faceWs || faceWs.readyState !== WebSocket.OPEN) {
    log('😕 Control de rostro no conectado, intentando...', 'warning');
    connectFaceControl();
    return;
  }
  
  try {
    faceWs.send(JSON.stringify({ emotion }));
    log(`😊 Emoción enviada: ${emotion}`, 'success');
  } catch (error) {
    log(`❌ Error enviando emoción: ${error.message}`, 'error');
  }
}

// Iniciar conexión de control de rostro solo si estamos en la misma página
// (evita errores cuando el túnel no soporta WebSocket)
if (window.location.pathname === '/control.html' || window.location.pathname === '/control') {
  // Intentar conectar solo si el servidor es local o el túnel soporta WebSocket
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocal) {
    setTimeout(() => {
      connectFaceControl();
    }, 1000);
  } else {
    console.log('⚠️ Control de rostro deshabilitado en túnel (requiere configuración WebSocket)');
    log('ℹ️ Control de rostro: Requiere túnel con soporte WebSocket', 'info');
  }
}
