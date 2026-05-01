import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private synthesis = window.speechSynthesis;
  private recognition: any;

  isListening = signal(false);

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

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for better clarity
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
