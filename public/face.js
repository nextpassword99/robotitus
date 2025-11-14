const canvas = document.getElementById('faceCanvas');
const ctx = canvas.getContext('2d');
const particlesCanvas = document.getElementById('particlesCanvas');
const pCtx = particlesCanvas.getContext('2d');

// Estado del robot
let currentEmotion = 'idle';
let blinkTimer = 0;
let isBlinking = false;
let mouthAnimation = 0;
let particles = [];
let ws = null;
let reconnectTimeout = null;

// Colores tema
const colors = {
  primary: '#06b6d4',    // cyan-500
  secondary: '#8b5cf6',  // violet-500
  accent: '#ec4899',     // pink-500
  glow: 'rgba(6, 182, 212, 0.3)'
};

// Configuración de emociones
const emotions = {
  idle: {
    eyeHeight: 0.4,
    eyeWidth: 0.35,
    mouthCurve: 0,
    eyeGlow: 0.5,
    color: colors.primary,
    mouthWidth: 0.25
  },
  happy: {
    eyeHeight: 0.25,
    eyeWidth: 0.35,
    mouthCurve: 80,
    eyeGlow: 1,
    color: '#10b981', // green-500
    mouthWidth: 0.35
  },
  thinking: {
    eyeHeight: 0.35,
    eyeWidth: 0.3,
    mouthCurve: -30,
    eyeGlow: 0.7,
    color: '#f59e0b', // amber-500
    mouthWidth: 0.2
  },
  talking: {
    eyeHeight: 0.4,
    eyeWidth: 0.35,
    mouthCurve: 0,
    eyeGlow: 0.8,
    color: colors.secondary,
    mouthMovement: true,
    mouthWidth: 0.3
  },
  listening: {
    eyeHeight: 0.5,
    eyeWidth: 0.4,
    mouthCurve: 20,
    eyeGlow: 1,
    color: colors.primary,
    pulse: true,
    mouthWidth: 0.28
  },
  error: {
    eyeHeight: 0.2,
    eyeWidth: 0.25,
    mouthCurve: -60,
    eyeGlow: 0.3,
    color: '#ef4444', // red-500
    mouthWidth: 0.25
  }
};

// Inicializar partículas
function initParticles() {
  particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * particlesCanvas.width,
      y: Math.random() * particlesCanvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5
    });
  }
}

// Ajustar canvas al tamaño de la ventana
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  particlesCanvas.width = window.innerWidth;
  particlesCanvas.height = window.innerHeight;
  initParticles();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Animar partículas de fondo
function animateParticles() {
  pCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
  
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    
    if (p.x < 0 || p.x > particlesCanvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > particlesCanvas.height) p.vy *= -1;
    
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    pCtx.fillStyle = `rgba(6, 182, 212, ${p.opacity})`;
    pCtx.fill();
  });
}

// Dibujar ojo con pestañas
function drawEye(x, y, size, heightFactor, widthFactor, color, glow) {
  const eyeWidth = size * widthFactor;
  const eyeHeight = size * heightFactor;
  
  // Pestañas superiores (línea continua encima del ojo)
  if (!isBlinking) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    
    // Línea de pestaña continua (curva suave)
    ctx.beginPath();
    ctx.moveTo(x - eyeWidth * 1.1, y - eyeHeight * 1.1);
    ctx.quadraticCurveTo(x, y - eyeHeight * 1.3, x + eyeWidth * 1.1, y - eyeHeight * 1.1);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }
  
  // Brillo exterior
  if (glow > 0) {
    ctx.shadowBlur = 50 * glow;
    ctx.shadowColor = color;
  }
  
  // Ojo principal
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Reflejo principal
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x - eyeWidth * 0.25, y - eyeHeight * 0.25, eyeWidth * 0.35, eyeHeight * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Reflejo secundario
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x + eyeWidth * 0.3, y + eyeHeight * 0.2, eyeWidth * 0.15, eyeHeight * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Dibujar boca
function drawMouth(x, y, width, curve, color, movement = 0) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 30;
  ctx.shadowColor = color;
  
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  
  const controlY = y + curve + movement;
  ctx.quadraticCurveTo(x, controlY, x + width / 2, y);
  ctx.stroke();
  
  // Agregar brillo a la boca
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.globalAlpha = 1;
  
  ctx.shadowBlur = 0;
}

// Dibujar rostro
function drawFace() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const emotion = emotions[currentEmotion];
  
  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Fondo degradado de toda la pantalla
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(canvas.width, canvas.height));
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#020617');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Borde de toda la pantalla
  ctx.strokeStyle = emotion.color;
  ctx.lineWidth = 8;
  ctx.shadowBlur = 30;
  ctx.shadowColor = emotion.color;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.shadowBlur = 0;
  
  // Efecto de pulso en el borde (para listening)
  if (emotion.pulse) {
    const pulseAlpha = (Math.sin(Date.now() / 500) + 1) / 2;
    ctx.strokeStyle = emotion.color;
    ctx.lineWidth = 12;
    ctx.globalAlpha = pulseAlpha * 0.5;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.globalAlpha = 1;
  }
  
  // Calcular tamaño de elementos basado en el tamaño de la pantalla
  const scale = Math.min(canvas.width, canvas.height) / 600;
  const eyeSize = 100 * scale;
  const eyeSpacing = 180 * scale;
  const eyeY = centerY - 80 * scale;
  
  // Ojos
  if (!isBlinking) {
    drawEye(centerX - eyeSpacing, eyeY, eyeSize, emotion.eyeHeight, emotion.eyeWidth, emotion.color, emotion.eyeGlow);
    drawEye(centerX + eyeSpacing, eyeY, eyeSize, emotion.eyeHeight, emotion.eyeWidth, emotion.color, emotion.eyeGlow);
  } else {
    // Ojos cerrados (parpadeo)
    ctx.strokeStyle = emotion.color;
    ctx.lineWidth = 8 * scale;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 20;
    ctx.shadowColor = emotion.color;
    
    // Línea izquierda
    const blinkWidth = eyeSize * emotion.eyeWidth * 1.2;
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing - blinkWidth, eyeY);
    ctx.lineTo(centerX - eyeSpacing + blinkWidth, eyeY);
    ctx.stroke();
    
    // Línea derecha
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing - blinkWidth, eyeY);
    ctx.lineTo(centerX + eyeSpacing + blinkWidth, eyeY);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }
  
  // Boca
  const mouthY = centerY + 120 * scale;
  const mouthWidth = canvas.width * emotion.mouthWidth;
  let mouthMovement = 0;
  
  if (emotion.mouthMovement) {
    mouthMovement = Math.sin(mouthAnimation) * 30 * scale;
  }
  
  drawMouth(centerX, mouthY, mouthWidth, emotion.mouthCurve * scale, emotion.color, mouthMovement);
  
  // Detalles decorativos en las esquinas
  ctx.strokeStyle = emotion.color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  
  // Esquina superior izquierda
  ctx.beginPath();
  ctx.moveTo(30, 80);
  ctx.lineTo(30, 30);
  ctx.lineTo(80, 30);
  ctx.stroke();
  
  // Esquina superior derecha
  ctx.beginPath();
  ctx.moveTo(canvas.width - 30, 80);
  ctx.lineTo(canvas.width - 30, 30);
  ctx.lineTo(canvas.width - 80, 30);
  ctx.stroke();
  
  // Esquina inferior izquierda
  ctx.beginPath();
  ctx.moveTo(30, canvas.height - 80);
  ctx.lineTo(30, canvas.height - 30);
  ctx.lineTo(80, canvas.height - 30);
  ctx.stroke();
  
  // Esquina inferior derecha
  ctx.beginPath();
  ctx.moveTo(canvas.width - 30, canvas.height - 80);
  ctx.lineTo(canvas.width - 30, canvas.height - 30);
  ctx.lineTo(canvas.width - 80, canvas.height - 30);
  ctx.stroke();
  
  ctx.globalAlpha = 1;
}

// Loop de animación
function animate() {
  // Parpadeo aleatorio
  blinkTimer++;
  if (blinkTimer > 180 && Math.random() < 0.02) {
    isBlinking = true;
    setTimeout(() => isBlinking = false, 150);
    blinkTimer = 0;
  }
  
  // Animación de boca (talking)
  mouthAnimation += 0.2;
  
  // Dibujar todo
  animateParticles();
  drawFace();
  
  requestAnimationFrame(animate);
}

// Cambiar emoción
function setEmotion(emotion) {
  if (emotions[emotion]) {
    currentEmotion = emotion;
    console.log(`😊 Emoción cambiada: ${emotion}`);
  }
}

// Conectar con WebSocket para recibir comandos de control
function connectToControlPanel() {
  const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${globalThis.location.host}/face-control`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('✅ Conectado al panel de control');
      updateConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Cambiar emoción si viene el comando
        if (data.emotion && emotions[data.emotion]) {
          setEmotion(data.emotion);
        }
        
        console.log('Comando recibido:', data);
      } catch (error) {
        console.error('Error procesando mensaje:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ Error WebSocket:', error);
      updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
      console.log('⚠️ Desconectado del panel de control');
      updateConnectionStatus(false);
      
      // Intentar reconectar después de 3 segundos
      reconnectTimeout = setTimeout(() => {
        console.log('🔄 Intentando reconectar...');
        connectToControlPanel();
      }, 3000);
    };
    
  } catch (error) {
    console.error('Error al conectar WebSocket:', error);
    updateConnectionStatus(false);
  }
}

// Actualizar indicador de conexión
function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    if (connected) {
      statusEl.classList.remove('disconnected');
    } else {
      statusEl.classList.add('disconnected');
    }
  }
}

// Exponer función global para control manual
window.setEmotion = setEmotion;

// Inicializar
initParticles();
animate();
connectToControlPanel();

// Limpiar al cerrar
window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
});
