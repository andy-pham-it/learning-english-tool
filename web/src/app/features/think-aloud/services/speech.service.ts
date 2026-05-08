import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private synthesis = window.speechSynthesis;
  private recognition: any;

  private http = inject(HttpClient);
  isListening = signal(false);
  isGenerating = signal(false);

  constructor() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    }
  }

  async speak(text: string): Promise<void> {
    // Try Gemini TTS first for premium quality
    try {
      this.isGenerating.set(true);
      const response = await firstValueFrom(
        this.http.post<{audio: string}>('/api/tts', { text })
      );
      
      if (response && response.audio) {
        const audio = new Audio(`data:audio/wav;base64,${response.audio}`);
        await audio.play();
        this.isGenerating.set(false);
        return;
      }
    } catch (e) {
      console.error('Gemini TTS failed, falling back to browser synthesis', e);
    } finally {
      this.isGenerating.set(false);
    }

    // Fallback to browser synthesis
    return new Promise((resolve) => {
      this.synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      this.synthesis.speak(utterance);
    });
  }

  listen(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject('Speech recognition not supported');
        return;
      }

      this.isListening.set(true);
      this.recognition.start();

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.isListening.set(false);
        resolve(transcript);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening.set(false);
        reject(event.error);
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
      };
    });
  }
}
