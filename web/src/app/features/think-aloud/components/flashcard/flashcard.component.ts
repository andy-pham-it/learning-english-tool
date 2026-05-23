import { Component, Input, Output, EventEmitter, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThinkAloudData } from '../../models/think-aloud.model';
import { SpeechService } from '../../services/speech.service';
import { HighlightModule } from 'ngx-highlightjs';

@Component({
  selector: 'app-think-aloud-card',
  standalone: true,
  imports: [CommonModule, HighlightModule],
  template: `
    <div class="card-container h-[650px] w-full max-w-3xl perspective-1000 mx-auto">
      <div class="card-inner relative w-full h-full transition-transform duration-500 preserve-3d cursor-pointer"
           [class.is-flipped]="isFlipped()">
        
        <!-- FRONT SIDE -->
        <div class="card-front absolute w-full h-full backface-hidden bg-white rounded-3xl p-8 shadow-lg border border-slate-100 flex flex-col"
             (click)="toggleFlip()">
          
          <div class="flex justify-between items-start mb-6">
            <span class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {{ _card()?.category }}
            </span>
            <div class="flex gap-2">
              <button (click)="onSpeak($event)" 
                      [disabled]="speechService.isGenerating()"
                      class="p-2 hover:bg-indigo-50 rounded-full transition-colors text-indigo-600 relative">
                <svg *ngIf="!speechService.isGenerating()" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <div *ngIf="speechService.isGenerating()" class="flex items-center justify-center">
                  <span class="absolute h-full w-full rounded-full bg-indigo-400 animate-ping opacity-25"></span>
                  <svg class="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </button>
            </div>
          </div>

          <div class="flex-1 flex flex-col justify-center items-center text-center">
            <h2 class="text-2xl md:text-3xl font-bold text-slate-800 leading-tight mb-8">
              "<span *ngFor="let word of words(); let last = last" 
                      (click)="onWordClick(word, $event)"
                      class="hover:text-indigo-600 hover:underline cursor-help transition-colors inline-block">{{ word }}{{ last ? '' : '&nbsp;' }}</span>"
            </h2>
            
            <div *ngIf="_card()?.code" class="w-full mt-6 rounded-2xl overflow-x-auto shadow-sm border border-slate-100 text-left bg-[#f6f8fa] p-4 md:p-6">
              <pre><code [highlightAuto]="_card()?.code || ''" class="text-xs md:text-sm leading-relaxed font-mono"></code></pre>
            </div>

            <div *ngIf="_card()?.template" class="w-full mt-4 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50 border-dashed text-left">
              <p class="text-[9px] text-indigo-400 uppercase font-black tracking-widest mb-1">Reusable Template</p>
              <p class="text-[11px] md:text-xs text-indigo-600 font-mono italic">
                {{ _card()?.template }}
              </p>
            </div>
          </div>

          <div class="mt-8 flex justify-center gap-4">
             <button (click)="onListen($event)" 
                     [class.bg-rose-50]="speechService.isListening()"
                     [class.text-rose-600]="speechService.isListening()"
                     class="flex items-center gap-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all border border-slate-100">
               <span *ngIf="!speechService.isListening()">🎤 Practice Speaking</span>
               <span *ngIf="speechService.isListening()" class="flex items-center gap-2">
                 <span class="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                 Listening...
               </span>
             </button>
          </div>

          <div *ngIf="lastTranscript()" class="mt-4 text-center">
            <p class="text-xs text-slate-400 mb-1">You said:</p>
            <p class="text-sm font-medium" [class.text-emerald-500]="isCorrect()" [class.text-rose-400]="!isCorrect()">
              {{ lastTranscript() }}
            </p>
          </div>

          <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
            Tap to see translation
          </div>
        </div>

        <!-- BACK SIDE -->
        <div class="card-back absolute w-full h-full backface-hidden bg-white rounded-3xl p-8 shadow-lg border border-slate-100 rotate-y-180 flex flex-col overflow-y-auto no-scrollbar"
             (click)="toggleFlip()">
          
          <div class="mb-4">
            <span class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Translation & Context
            </span>
          </div>

          <div class="flex-1 flex flex-col justify-center gap-8">
            <div class="text-center">
              <p class="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">Meaning</p>
              <h3 class="text-2xl font-bold text-slate-700 leading-snug">
                {{ _card()?.vietnamese }}
              </h3>
            </div>

            <div *ngIf="_card()?.context" class="bg-amber-50/50 p-6 rounded-2xl border border-amber-100/50">
              <p class="text-xs text-amber-600 uppercase font-bold tracking-widest mb-2">Context</p>
              <p class="text-slate-600 leading-relaxed italic text-sm">
                {{ _card()?.context }}
              </p>
            </div>

            <div *ngIf="_card()?.usage" class="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50">
              <p class="text-xs text-indigo-600 uppercase font-bold tracking-widest mb-2">When to use</p>
              <p class="text-slate-600 leading-relaxed text-sm">
                {{ _card()?.usage }}
              </p>
            </div>

            <div *ngIf="_card()?.template" class="bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed">
              <p class="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">Template Pattern</p>
              <p class="text-indigo-600 font-mono text-sm leading-relaxed">
                {{ _card()?.template }}
              </p>
            </div>
          </div>

          <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
            Tap to see phrase
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .perspective-1000 { perspective: 1000px; }
    .preserve-3d { transform-style: preserve-3d; }
    .backface-hidden { backface-visibility: hidden; }
    .rotate-y-180 { transform: rotateY(180deg); }
    .is-flipped { transform: rotateY(180deg); }
    pre { margin: 0; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class FlashcardComponent {
  protected _card = signal<ThinkAloudData | null>(null);
  
  @Input({ required: true }) set card(value: ThinkAloudData) {
    this._card.set(value);
    this.isFlipped.set(false);
    this.lastTranscript.set('');
    this.isCorrect.set(false);
  }
  
  get cardValue() { return this._card(); }

  @Output() lookup = new EventEmitter<string>();
  
  protected speechService = inject(SpeechService);
  
  isFlipped = signal(false);
  lastTranscript = signal('');
  isCorrect = signal(false);

  words = computed(() => {
    const text = this._card()?.english || '';
    return text.split(' ');
  });

  onWordClick(word: string, event: Event) {
    event.stopPropagation();
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    if (cleanWord) {
      this.lookup.emit(cleanWord);
    }
  }

  toggleFlip() {
    this.isFlipped.update(v => !v);
  }

  async onSpeak(event: Event) {
    event.stopPropagation();
    await this.speechService.speak(this._card()?.english || '');
  }

  async onListen(event: Event) {
    event.stopPropagation();
    try {
      const result = await this.speechService.listen();
      this.lastTranscript.set(result);
      
      // Simple accuracy check
      const cleanTarget = (this._card()?.english || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      const cleanResult = result.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      
      this.isCorrect.set(cleanResult.includes(cleanTarget) || cleanTarget.includes(cleanResult));
    } catch (e) {
      console.error('Speech recognition error', e);
    }
  }
}
