import { Porcupine } from '@picovoice/porcupine-node';
import { PvRecorder } from '@picovoice/pvrecorder-node';
import { env } from '../config/env.js';
import { porcupineKeywords } from '../config/porcupine.config.js';
import { SpeechService } from './openai.service.js';
import { LLMService } from './llm.service.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

export class PorcupineService {
  private porcupine?: Porcupine;
  private recorder?: PvRecorder;
  private isListening = false;
  private isRecordingCommand = false;
  private speechService: SpeechService;
  private llmService: LLMService;

  constructor(private accessKey: string, speechService: SpeechService, llmService: LLMService) {
    this.speechService = speechService;
    this.llmService = llmService;
    console.log('✅ Porcupine Service inicializado');
  }

  async start(keywordIndex: number, onResponse: (transcription: string, response: string) => void) {
    if (this.isListening) await this.stop();

    const keyword = porcupineKeywords[keywordIndex];
    if (!keyword) throw new Error(`Keyword index ${keywordIndex} no encontrado`);

    console.log(`🎤 Iniciando detección de palabra clave: ${keyword.label}`);

    this.porcupine = new Porcupine(this.accessKey, [keyword.publicPath], [keyword.sensitivity]);
    this.recorder = new PvRecorder(this.porcupine.frameLength);
    this.recorder.start();
    this.isListening = true;

    this.listenForWakeWord(keyword.label, onResponse);
  }

  private async listenForWakeWord(keywordLabel: string, onResponse: (transcription: string, response: string) => void) {
    while (this.isListening && this.recorder && this.porcupine) {
      const pcm = await this.recorder.read();
      const keywordIndex = this.porcupine.process(pcm);

      if (keywordIndex >= 0) {
        console.log(`🔔 Palabra clave detectada: ${keywordLabel}`);
        await this.recordCommand(onResponse);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async recordCommand(onResponse: (transcription: string, response: string) => void) {
    if (this.isRecordingCommand || !this.recorder || !this.porcupine) return;

    this.isRecordingCommand = true;
    console.log('🎙️ Grabando comando...');

    const frames: Int16Array[] = [];
    const maxFrames = Math.floor((env.RECORDING_DURATION_SEC * 16000) / this.porcupine.frameLength);
    let frameCount = 0;

    while (frameCount < maxFrames && this.isRecordingCommand) {
      const pcm = await this.recorder.read();
      frames.push(pcm);
      frameCount++;
    }

    console.log('✅ Grabación completada');
    this.isRecordingCommand = false;

    const audioBuffer = this.framesToWav(frames);
    await this.processAudio(audioBuffer, onResponse);
  }

  private framesToWav(frames: Int16Array[]): Buffer {
    const totalSamples = frames.reduce((acc, frame) => acc + frame.length, 0);
    const buffer = Buffer.alloc(44 + totalSamples * 2);

    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + totalSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(16000, 24);
    buffer.writeUInt32LE(32000, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(totalSamples * 2, 40);

    let offset = 44;
    for (const frame of frames) {
      for (let i = 0; i < frame.length; i++) {
        buffer.writeInt16LE(frame[i], offset);
        offset += 2;
      }
    }

    return buffer;
  }

  private async processAudio(audioBuffer: Buffer, onResponse: (transcription: string, response: string) => void) {
    try {
      console.log('🔄 Transcribiendo audio...');
      const transcription = await this.speechService.transcribe(audioBuffer);
      
      console.log('🤖 Generando respuesta...');
      const response = await this.llmService.getResponse(transcription);
      
      onResponse(transcription, response);
    } catch (error) {
      console.error('❌ Error procesando audio:', error);
    }
  }

  async stop() {
    this.isListening = false;
    this.isRecordingCommand = false;

    if (this.recorder) {
      this.recorder.stop();
      this.recorder.release();
      this.recorder = undefined;
    }

    if (this.porcupine) {
      this.porcupine.release();
      this.porcupine = undefined;
    }

    console.log('🛑 Porcupine detenido');
  }

  getKeywords() {
    return porcupineKeywords.map((k, i) => ({ index: i, label: k.label }));
  }

  isActive() {
    return this.isListening;
  }
}
