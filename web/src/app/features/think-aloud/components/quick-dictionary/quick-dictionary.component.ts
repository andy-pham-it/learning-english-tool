import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DictionaryService, DictionaryResult } from '../../../../core/services/dictionary.service';
import { SpeechService } from '../../../../core/services/speech.service';

@Component({
  selector: 'app-quick-dictionary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" (click)="close.emit()">
      <div class="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Lookup</span>
          <button (click)="close.emit()" class="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          <div *ngIf="loading()" class="py-12 flex flex-col items-center justify-center">
            <div class="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p class="text-xs text-slate-400 font-bold">AI is thinking...</p>
          </div>

          <div *ngIf="result() && !loading()" class="animate-in fade-in slide-in-from-bottom-2">
            <div class="flex justify-between items-start mb-6">
              <div>
                <h2 class="text-4xl font-black text-slate-900 capitalize tracking-tight">{{ result()?.word }}</h2>
                <div class="flex items-center gap-3 mt-2">
                   <span class="text-indigo-600 font-mono text-base font-bold">{{ result()?.phonetic }}</span>
                   <button (click)="speech.speak(result()?.word || '')" class="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                   </button>
                </div>
              </div>
              <button (click)="addToFlashcards()" class="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>

            <div class="space-y-6 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              <div *ngFor="let entry of result()?.entries" class="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider mb-3 inline-block">
                  {{ entry.partOfSpeech }}
                </span>
                <div *ngFor="let def of entry.definitions" class="space-y-2 mb-4 last:mb-0">
                  <p class="text-slate-800 text-lg font-bold leading-snug">{{ def.en }}</p>
                  <p class="text-indigo-600 text-sm font-medium">{{ def.vi }}</p>
                  <div *ngIf="def.example" class="mt-2 pl-3 border-l-2 border-slate-200 py-1">
                    <p class="text-slate-500 text-xs italic">"{{ def.example }}"</p>
                    <p class="text-slate-400 text-[11px] mt-0.5">{{ def.exampleVi }}</p>
                  </div>
                </div>
              </div>

              <!-- COLLOCATIONS SECTION -->
              <div *ngIf="result()?.collocations?.length" class="mt-4 pt-4 border-t border-slate-100">
                <h3 class="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-4">Common Phrases & Collocations</h3>
                <div class="grid grid-cols-1 gap-3">
                  <div *ngFor="let col of result()?.collocations" class="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/30">
                    <div class="flex justify-between items-start">
                      <span class="text-indigo-700 font-bold text-base">{{ col.phrase }}</span>
                      <span class="text-indigo-400 text-xs font-medium">{{ col.meaning }}</span>
                    </div>
                    <div class="mt-2 pt-2 border-t border-indigo-100/20">
                      <p class="text-slate-600 text-xs italic">{{ col.exampleEn }}</p>
                      <p class="text-slate-400 text-[10px] mt-0.5">{{ col.exampleVi }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="error()" class="py-8 text-center">
            <p class="text-rose-500 font-bold text-sm">{{ error() }}</p>
            <button (click)="lookup(word)" class="mt-4 text-indigo-600 text-xs font-bold underline">Try again</button>
          </div>
        </div>

        <div class="p-4 bg-slate-50 text-center">
          <button (click)="viewFull()" class="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors">View full definition →</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class QuickDictionaryComponent {
  @Input() set word(value: string) {
    if (value) this.lookup(value);
  }
  @Output() close = new EventEmitter<void>();

  private dictionaryService = inject(DictionaryService);
  private router = inject(Router);
  protected speech = inject(SpeechService);

  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  currentWord = '';

  async lookup(word: string) {
    this.currentWord = word;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const res = await this.dictionaryService.lookup(word);
      if (res.error) {
        this.error.set(res.error);
      } else {
        this.result.set(res);
      }
    } catch (err) {
      this.error.set('Network error');
    } finally {
      this.loading.set(false);
    }
  }

  addToFlashcards() {
    alert(`Added "${this.currentWord}" to your cards!`);
    this.close.emit();
  }

  viewFull() {
    this.close.emit();
    this.router.navigate(['/dictionary'], { queryParams: { q: this.currentWord } });
  }
}
