function playAudio(base64Audio) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  const audioBlob = base64ToBlob(base64Audio, 'audio/mpeg');
  const audioUrl = URL.createObjectURL(audioBlob);
  
  currentAudio = new Audio(audioUrl);
  currentAudio.play().catch(error => {
    console.error('Error reproduciendo audio:', error);
  });
  
  currentAudio.onended = () => {
    URL.revokeObjectURL(audioUrl);
    currentAudio = null;
  };
}

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
