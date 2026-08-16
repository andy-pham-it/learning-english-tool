import { Injectable } from '@angular/core';

export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private synth: SpeechSynthesis;
  // Use any to bypass strict typing for experimental browser APIs
  private recognition: any; 

  constructor() {
    this.synth = window.speechSynthesis;
    
    // Initialize Speech Recognition if supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      // We will set lang when startListening is called
    } else {
      console.warn('SpeechRecognition API is not supported in this browser.');
    }
  }

  isRecognitionSupported(): boolean {
    return !!this.recognition;
  }

  speak(text: string, lang: string = 'en-US', rate?: number): void {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate ?? 0.9; // Slightly slower for better learning by default
    this.synth.speak(utterance);
  }

  startListening(lang: string = 'en-US'): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        return reject(new Error('SpeechRecognition is not supported.'));
      }

      this.recognition.lang = lang;

      const finishListening = (event: any) => {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      const catchError = (event: any) => {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        reject(event.error);
      };

      this.recognition.onresult = finishListening;
      this.recognition.onerror = catchError;

      try {
        this.recognition.start();
      } catch (e) {
        reject(e);
      }
    });
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}
