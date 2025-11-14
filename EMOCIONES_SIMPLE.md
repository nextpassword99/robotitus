# 😊 Sistema de Emociones Sincronizadas - Versión Simple

## 🎯 ¿Cómo Funciona?

**Conexión Directa**: `index.html` se conecta directamente al WebSocket `/face-control` y envía emociones cuando detecta eventos de OpenAI.

```
index.html (realtime.js)
         |
         | Detecta evento de OpenAI
         | (speech_started, audio.delta, etc.)
         ↓
 WebSocket /face-control
         |
         | Broadcasting
         ↓
  face.html (todos)
         |
         | Actualiza emoción
         ↓
   Rostro Animado
```

## 🔄 Mapeo de Eventos → Emociones

| Evento OpenAI | Emoción | Cuándo Ocurre | Duración |
|---------------|---------|---------------|----------|
| `session.created` | **idle** 😐 | Conexión establecida | Permanente hasta hablar |
| `input_audio_buffer.speech_started` | **listening** 👂 | Usuario empieza a hablar | Mientras habla |
| `input_audio_buffer.speech_stopped` | **thinking** 🤔 | Usuario termina, IA procesa | Hasta que IA responde |
| `response.audio.delta` | **talking** 💬 | IA generando audio | **Detecta duración automáticamente** |
| `response.audio_transcript.delta` | **talking** 💬 | IA generando texto | **Detecta duración automáticamente** |
| `response.done` | **idle** 😐 | Respuesta completa | Vuelve a espera |
| `error` | **error** 😟 | Error en sesión | Hasta reconectar |

### 🎯 **Detección Inteligente de Duración del Habla**

El sistema detecta automáticamente **cuánto tiempo habla la IA**:

```javascript
function startTalking() {
  // Primera vez que llega audio → cambiar a talking
  if (!isTalking) {
    isTalking = true;
    sendEmotionToFace('talking');
  }
  
  // Reiniciar timeout cada vez que llega más audio
  clearTimeout(talkingTimeout);
  talkingTimeout = setTimeout(() => {
    // Si pasan 800ms sin audio nuevo → IA terminó de hablar
    isTalking = false;
    sendEmotionToFace('idle');
  }, 800);
}
```

**¿Cómo funciona?**
1. Llega primer `response.audio.delta` → Rostro cambia a **talking** 💬
2. Llegan más deltas (cada ~50-100ms) → Rostro sigue en **talking**
3. Pasan 800ms sin deltas → Rostro vuelve a **idle** 😐

**Resultado:** El rostro habla exactamente el mismo tiempo que la IA, sin importar si la respuesta dura 2 segundos o 20 segundos.

## 🚀 Cómo Usar

### 1. Inicia el servidor
```bash
npm run build
npm run dev
```

### 2. Abre las páginas

**En tu PC/Laptop:**
```
http://localhost:8000/index.html
```

**En tu móvil (horizontal):**
```
http://[IP-DE-TU-PC]:8000/face.html
```

### 3. Habla con la IA
- Presiona el micrófono en `index.html`
- Habla → El rostro cambia a **listening** 👂
- Dejas de hablar → Cambia a **thinking** 🤔
- IA responde → Cambia a **talking** 💬
- Termina → Vuelve a **idle** 😐

## 📝 Código Modificado

### `public/realtime.js`

```javascript
// WebSocket para controlar el rostro
let faceWs = null;

// Conectar al inicio
function connectFaceControl() {
  const host = globalThis.location.host;
  const wsUrl = `ws://${host}/face-control`;
  
  faceWs = new WebSocket(wsUrl);
  
  faceWs.onopen = () => {
    console.log('😊 Conectado al control de rostro');
  };
  
  faceWs.onclose = () => {
    // Reintentar conexión automática
    setTimeout(connectFaceControl, 3000);
  };
}

// Enviar emoción
function sendEmotionToFace(emotion) {
  if (faceWs && faceWs.readyState === WebSocket.OPEN) {
    faceWs.send(JSON.stringify({ emotion }));
    console.log(`😊 Emoción enviada: ${emotion}`);
  }
}

// En handleServerEvent(), agregar:
case "input_audio_buffer.speech_started":
  sendEmotionToFace('listening');
  break;

case "response.audio.delta":
  sendEmotionToFace('talking');
  break;
```

### `src/server.ts`

No se modificó nada del servidor. El WebSocket `/face-control` ya existente hace todo el trabajo:
- Recibe emociones de `index.html`
- Hace broadcasting a todos los `face.html` conectados

## ✅ Ventajas de Esta Solución

1. **Simple**: Solo modificamos `realtime.js`, el servidor queda igual
2. **Directo**: `index.html` habla directamente con `face.html`
3. **Sin Intermediarios**: No requiere lógica adicional en el servidor
4. **Funciona Ya**: Solo recargar `index.html` y `face.html`
5. **Múltiples Rostros**: Todos los `face.html` se sincronizan

## 🔧 Personalización

### Cambiar Emociones
Edita `public/realtime.js` línea 169-219:

```javascript
case "input_audio_buffer.speech_started":
  sendEmotionToFace('happy'); // En vez de 'listening'
  break;
```

### Ajustar Tiempo de Detección de Fin de Habla
```javascript
// En la función startTalking(), línea ~55
talkingTimeout = setTimeout(() => {
  isTalking = false;
  sendEmotionToFace('idle');
}, 800); // Cambia 800ms por el valor que quieras
```

**Valores recomendados:**
- `500ms` - Respuestas muy rápidas (puede cortar palabras finales)
- `800ms` - **Valor por defecto** (equilibrado)
- `1200ms` - Pausas más largas (más natural, pero tarda en volver a idle)
- `2000ms` - Muy conservador (asegura que no corte nada)

### Agregar Delay de Transición
```javascript
function sendEmotionToFace(emotion) {
  setTimeout(() => {
    if (faceWs && faceWs.readyState === WebSocket.OPEN) {
      faceWs.send(JSON.stringify({ emotion }));
    }
  }, 500); // 500ms de delay
}
```

### Debug en Consola
Abre DevTools en `index.html`:
```javascript
// Ver conexión
faceWs.readyState // 1 = OPEN (conectado)

// Ver si está hablando
isTalking // true = hablando, false = idle

// Enviar emoción manual
sendEmotionToFace('happy')
```

## 🐛 Troubleshooting

### El rostro no cambia
1. Verifica que `face.html` esté abierto
2. Abre consola en `index.html`, deberías ver:
   ```
   😊 Conectado al control de rostro
   😊 Emoción enviada: listening
   ```
3. Abre consola en `face.html`, deberías ver:
   ```
   ✅ Conectado al panel de control
   😊 Emoción cambiada: listening
   ```

### WebSocket desconectado
- Se reconecta automáticamente cada 3 segundos
- Verifica que el servidor esté corriendo
- Revisa que el puerto sea correcto (8000)

### Emociones no sincronizadas
- Asegúrate de recargar `index.html` con Ctrl+Shift+R (hard reload)
- Verifica que `faceWs.readyState === 1` en consola

## 💡 Casos de Uso

### Robot Conversacional
```
Tablet horizontal (face.html) → Muestra el rostro
Laptop (index.html) → Conversa con la IA
```

### Demo Interactiva
```
Proyector → face.html (rostro gigante)
Operador → index.html (conversación)
Público → Ve las emociones en tiempo real
```

### Robot Físico
```
Móvil en robot → face.html
Control remoto → index.html + control.html
ESP32 → Movimientos sincronizados
```

## 📊 Flujo Completo

```
1. Usuario abre index.html
   ↓
2. realtime.js conecta a /face-control
   ↓
3. Usuario presiona micrófono
   ↓
4. Conexión WebRTC con OpenAI
   ↓
5. Usuario habla
   ↓
6. OpenAI envía: speech_started
   ↓
7. realtime.js detecta evento
   ↓
8. sendEmotionToFace('listening')
   ↓
9. WebSocket envía: {emotion: 'listening'}
   ↓
10. Servidor broadcasting a todos face.html
   ↓
11. face.js recibe y actualiza: currentEmotion = 'listening'
   ↓
12. drawFace() renderiza ojos grandes + boca abierta
```

---

**Resultado**: Sistema de emociones sincronizadas con **cero cambios en el servidor**. Solo agregamos lógica en el cliente para enviar emociones cuando detecta eventos de OpenAI.

**Siguiente paso**: Probar en el navegador 🚀
