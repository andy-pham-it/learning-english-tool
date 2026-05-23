import { Component, Input, Output, EventEmitter, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PatternData, PatternFillResult } from '../../models/pattern.model';
import { SpeechService } from '../../services/speech.service';
import { PatternService } from '../../services/pattern.service';

@Component({
  selector: 'app-pattern-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full max-w-3xl mx-auto">
      <!-- Mode Toggle -->
      <div class="flex justify-center mb-6">
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-1 border border-slate-100 shadow-sm inline-flex">
          <button (click)="mode.set('view')"
                  [class.bg-indigo-600]="mode() === 'view'"
                  [class.text-white]="mode() === 'view'"
                  [class.text-slate-500]="mode() !== 'view'"
                  class="px-5 py-2 rounded-xl text-xs font-bold transition-all">
            View Pattern
          </button>
          <button (click)="mode.set('practice')"
                  [class.bg-indigo-600]="mode() === 'practice'"
                  [class.text-white]="mode() === 'practice'"
                  [class.text-slate-500]="mode() !== 'practice'"
                  class="px-5 py-2 rounded-xl text-xs font-bold transition-all">
            Practice
          </button>
        </div>
      </div>

      <!-- VIEW MODE -->
      <div *ngIf="mode() === 'view'">
        <div class="card-container h-[650px] w-full perspective-1000 mx-auto">
          <div class="card-inner relative w-full h-full transition-transform duration-500 preserve-3d cursor-pointer"
               [class.is-flipped]="isFlipped()">

            <!-- FRONT -->
            <div class="card-front absolute w-full h-full backface-hidden bg-white rounded-3xl p-8 shadow-lg border border-slate-100 flex flex-col"
                 (click)="toggleFlip()">
              <div class="flex justify-between items-start mb-6">
                <span class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {{ _card()?.category }}
                </span>
                <div class="flex gap-2">
                  <button (click)="onSpeak($event, _card()?.example || '')"
                          [disabled]="speech.isGenerating()"
                          class="p-2 hover:bg-indigo-50 rounded-full transition-colors text-indigo-600 relative">
                    <svg *ngIf="!speech.isGenerating()" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <div *ngIf="speech.isGenerating()" class="flex items-center justify-center">
                      <span class="absolute h-full w-full rounded-full bg-indigo-400 animate-ping opacity-25"></span>
                      <svg class="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  </button>
                </div>
              </div>

              <div class="flex-1 flex flex-col justify-center text-center">
                <span class="text-[10px] text-indigo-400 uppercase font-black tracking-widest mb-2">Pattern</span>
                <p class="text-sm font-mono text-indigo-600 bg-indigo-50/50 py-1.5 px-3 rounded-xl inline-block mx-auto mb-6">
                  {{ _card()?.pattern }}
                </p>

                <h2 class="text-2xl md:text-3xl font-bold text-slate-800 leading-tight mb-8">
                  "<span *ngFor="let word of exampleWords(); let last = last"
                        (click)="onWordClick(word, $event)"
                        class="hover:text-indigo-600 hover:underline cursor-help transition-colors inline-block">{{ word }}{{ last ? '' : '&nbsp;' }}</span>"
                </h2>

                <div class="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-left">
                  <p class="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">Structure</p>
                  <div class="flex flex-wrap gap-2">
                    <span *ngFor="let part of structureParts()"
                          class="text-xs px-2.5 py-1 rounded-lg font-bold"
                          [class.bg-amber-100]="part.isVariable"
                          [class.text-amber-700]="part.isVariable"
                          [class.bg-slate-100]="!part.isVariable"
                          [class.text-slate-600]="!part.isVariable">
                      {{ part.text }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
                Tap for details & examples
              </div>
            </div>

            <!-- BACK -->
            <div class="card-back absolute w-full h-full backface-hidden bg-white rounded-3xl p-8 shadow-lg border border-slate-100 rotate-y-180 flex flex-col overflow-y-auto"
                 (click)="toggleFlip()">
              <div class="mb-4">
                <span class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Details & Examples
                </span>
              </div>

              <div class="flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar">
                <div class="text-center">
                  <p class="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">Meaning</p>
                  <h3 class="text-2xl font-bold text-slate-700 leading-snug">{{ _card()?.vietnamese }}</h3>
                </div>

                <div *ngIf="_card()?.context" class="bg-amber-50/50 p-5 rounded-2xl border border-amber-100/50">
                  <p class="text-xs text-amber-600 uppercase font-bold tracking-widest mb-2">Context</p>
                  <p class="text-slate-600 leading-relaxed italic text-sm">{{ _card()?.context }}</p>
                </div>

                <div class="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                  <p class="text-xs text-indigo-600 uppercase font-bold tracking-widest mb-2">Usage</p>
                  <p class="text-slate-600 leading-relaxed text-sm">{{ _card()?.usage }}</p>
                </div>

                <div *ngIf="_card()?.examples?.length" class="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <p class="text-xs text-slate-500 uppercase font-bold tracking-widest mb-3">More Examples</p>
                  <div class="space-y-4">
                    <div *ngFor="let ex of _card()?.examples" class="pl-3 border-l-2 border-indigo-200">
                      <p class="text-slate-700 font-bold text-sm">{{ ex.en }}</p>
                      <p class="text-slate-400 text-xs mt-1">{{ ex.vi }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-center text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] pt-4">
                Tap to see pattern
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PRACTICE MODE -->
      <div *ngIf="mode() === 'practice'" class="bg-white rounded-3xl p-8 shadow-lg border border-slate-100">
        <div class="mb-6 text-center">
          <span class="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Fill in the Blanks</span>
          <p class="text-xs text-slate-400 mt-2">Select values for each slot to complete the sentence</p>
        </div>

        <!-- Pattern Indicator -->
        <div class="text-center mb-6">
          <span class="text-xs font-mono text-indigo-500 bg-indigo-50/50 py-1 px-3 rounded-lg">
            {{ _card()?.pattern }}
          </span>
        </div>

        <!-- Fill Slots -->
        <div class="space-y-5 mb-8">
          <div *ngFor="let slot of variableSlots()" class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2">
              <span class="text-indigo-500 font-mono">{{ '{' + slot.name + '}' }}</span>
            </p>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let option of slot.options"
                      (click)="selectOption(slot.name, option)"
                      [class.bg-indigo-600]="getFill(slot.name) === option"
                      [class.text-white]="getFill(slot.name) === option"
                      [class.bg-white]="getFill(slot.name) !== option"
                      [class.text-slate-700]="getFill(slot.name) !== option"
                      [class.border-indigo-300]="getFill(slot.name) === option"
                      [class.border-slate-200]="getFill(slot.name) !== option"
                      class="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:border-indigo-300 hover:bg-indigo-50">
                {{ option }}
              </button>
            </div>
          </div>
        </div>

        <!-- Built Sentence -->
        <div *ngIf="builtSentence()" class="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100/50 mb-6 text-center">
          <p class="text-[10px] text-emerald-600 uppercase font-black tracking-widest mb-2">Your Sentence</p>
          <p class="text-xl font-bold text-slate-800 leading-snug">"{{ builtSentence() }}"</p>
          <div class="flex justify-center gap-3 mt-4">
            <button (click)="onSpeak($event, builtSentence())"
                    [disabled]="speech.isGenerating()"
                    class="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
            <button (click)="onPracticeSpeak()"
                    [class.bg-rose-500]="speech.isListening()"
                    [class.text-white]="speech.isListening()"
                    class="p-3 bg-rose-100 text-rose-700 rounded-xl hover:bg-rose-200 transition-colors">
              <svg *ngIf="!speech.isListening()" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span *ngIf="speech.isListening()" class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 bg-white rounded-full animate-ping"></span>
                Listening...
              </span>
            </button>
          </div>
          <div *ngIf="speechResult()" class="mt-3">
            <p class="text-xs text-slate-400">You said:</p>
            <p class="text-sm font-bold" [class.text-emerald-500]="isSpeechCorrect()" [class.text-rose-400]="!isSpeechCorrect()">
              {{ speechResult() }}
            </p>
          </div>
        </div>

        <!-- AI Check -->
        <div class="text-center">
          <button (click)="checkWithAI()"
                  [disabled]="!allFilled() || aiChecking()"
                  class="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-40 shadow-lg shadow-indigo-200">
            <span *ngIf="!aiChecking()">Check with AI</span>
            <span *ngIf="aiChecking()" class="flex items-center gap-2 justify-center">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Checking...
            </span>
          </button>
          <div *ngIf="aiFeedback()" class="mt-4 p-4 rounded-2xl text-sm font-bold text-left"
               [class.bg-emerald-50]="aiFeedback()?.correct"
               [class.text-emerald-700]="aiFeedback()?.correct"
               [class.border-emerald-200]="aiFeedback()?.correct"
               [class.bg-rose-50]="!aiFeedback()?.correct"
               [class.text-rose-700]="!aiFeedback()?.correct"
               [class.border-rose-200]="!aiFeedback()?.correct"
               [class.border]="true">
            <p>{{ aiFeedback()?.message }}</p>
            <p *ngIf="aiFeedback()?.suggestion" class="text-xs mt-2 opacity-75">{{ aiFeedback()?.suggestion }}</p>
          </div>
        </div>

        <!-- Reset -->
        <div class="text-center mt-6">
          <button (click)="resetPractice()" class="text-xs text-slate-400 hover:text-slate-600 underline">
            Reset
          </button>
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
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class PatternCardComponent {
  private patternService = inject(PatternService);
  protected speech = inject(SpeechService);

  protected _card = signal<PatternData | null>(null);
  protected mode = signal<'view' | 'practice'>('view');
  protected isFlipped = signal(false);

  @Input({ required: true }) set card(value: PatternData) {
    this._card.set(value);
    this.resetPractice();
  }

  @Output() lookup = new EventEmitter<string>();

  // Practice state
  protected fillResults = signal<PatternFillResult[]>([]);
  protected speechResult = signal('');
  protected isSpeechCorrect = signal(false);
  protected aiChecking = signal(false);
  protected aiFeedback = signal<{ correct: boolean; message: string; suggestion?: string } | null>(null);

  // Parse variables from structure
  protected variableSlots = computed(() => {
    const card = this._card();
    if (!card?.variables) return [];

    const varNames = this.extractVarNames(card.structure);
    return varNames.map(name => ({
      name,
      options: card.variables![name] || []
    }));
  });

  // Parse structure into display parts
  protected structureParts = computed(() => {
    const card = this._card();
    if (!card) return [];
    const parts: { text: string; isVariable: boolean }[] = [];
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(card.structure)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: card.structure.slice(lastIndex, match.index), isVariable: false });
      }
      parts.push({ text: `{${match[1]}}`, isVariable: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < card.structure.length) {
      parts.push({ text: card.structure.slice(lastIndex), isVariable: false });
    }
    return parts;
  });

  // Example sentence split into words
  protected exampleWords = computed(() => {
    return this._card()?.example.split(' ') || [];
  });

  // Built sentence
  protected builtSentence = computed(() => {
    const card = this._card();
    if (!card) return '';
    return this.patternService.buildSentence(card, this.fillResults());
  });

  // Check if all slots filled
  protected allFilled = computed(() => {
    const slots = this.variableSlots();
    if (slots.length === 0) return true;
    const fills = this.fillResults();
    return slots.every(s => fills.find(f => f.slotName === s.name && f.value));
  });

  private extractVarNames(structure: string): string[] {
    const names: string[] = [];
    const regex = /\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(structure)) !== null) {
      const name = match[1].trim();
      if (!names.includes(name)) names.push(name);
    }
    return names;
  }

  getFill(slotName: string): string | undefined {
    return this.fillResults().find(f => f.slotName === slotName)?.value;
  }

  selectOption(slotName: string, value: string) {
    this.aiFeedback.set(null);
    this.fillResults.update(results => {
      const filtered = results.filter(r => r.slotName !== slotName);
      return [...filtered, { slotName, value }];
    });
  }

  toggleFlip() {
    this.isFlipped.update(v => !v);
  }

  onWordClick(word: string, event: Event) {
    event.stopPropagation();
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
    if (cleanWord) this.lookup.emit(cleanWord);
  }

  async onSpeak(event: Event, text: string) {
    event.stopPropagation();
    await this.speech.speak(text);
  }

  async onPracticeSpeak() {
    try {
      const result = await this.speech.listen();
      this.speechResult.set(result);

      const cleanTarget = this.builtSentence().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      const cleanResult = result.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      this.isSpeechCorrect.set(cleanResult.includes(cleanTarget) || cleanTarget.includes(cleanResult));
    } catch (e) {
      console.error('Speech recognition error', e);
    }
  }

  async checkWithAI() {
    const card = this._card();
    const sentence = this.builtSentence();
    if (!card || !sentence) return;

    this.aiChecking.set(true);
    this.aiFeedback.set(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Check if the following sentence correctly follows the pattern "${card.pattern}". Pattern structure: "${card.structure}". Sentence: "${sentence}". Reply in JSON format: {"correct": boolean, "message": "short explanation in Vietnamese", "suggestion": "correction if any"}. Only return JSON.`
          }]
        })
      });
      const data = await response.json();
      const text = data.reply || data.text || '';
      const parsed = JSON.parse(text);
      this.aiFeedback.set(parsed);
    } catch {
      this.aiFeedback.set({
        correct: true,
        message: '✅ Câu của bạn có vẻ ổn! Hãy luyện đọc to để nhớ pattern này.',
      });
    } finally {
      this.aiChecking.set(false);
    }
  }

  resetPractice() {
    this.fillResults.set([]);
    this.speechResult.set('');
    this.isSpeechCorrect.set(false);
    this.aiFeedback.set(null);
    this.isFlipped.set(false);
    this.mode.set('view');
  }
}
