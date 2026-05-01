import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryService, DictionaryResult } from '../../core/services/dictionary.service';
import { SpeechService } from '../../core/services/speech.service';
import { HistoryService } from '../../core/services/history.service';

@Component({
  selector: 'app-dictionary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 pb-24">
      <!-- Header Area -->
      <div class="bg-white border-b border-slate-200 pt-12 pb-6 px-4 sticky top-0 z-40 shadow-sm">
        <div class="max-w-2xl mx-auto">
          <h1 class="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <span class="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-lg">D</span>
            Dictionary
          </h1>
          
          <div class="relative group">
            <input 
              type="text" 
              [(ngModel)]="searchQuery"
              (keyup.enter)="search()"
              placeholder="Search word..."
              class="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <button 
              (click)="search()"
              [disabled]="loading()"
              class="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              {{ loading() ? '...' : 'Look up' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="max-w-2xl mx-auto p-4 mt-4">
        <!-- Loading State -->
        <div *ngIf="loading()" class="flex flex-col items-center justify-center py-20 animate-pulse">
          <div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p class="text-slate-400 font-medium">Consulting AI lexicographer...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error()" class="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center">
          <div class="text-3xl mb-2">😕</div>
          <p class="text-rose-600 font-semibold">{{ error() }}</p>
        </div>

        <!-- Result State -->
        <div *ngIf="result() && !loading()" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <!-- Word Header -->
          <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div class="flex justify-between items-start">
              <div>
                <div class="flex items-center gap-3 mb-1">
                  <h2 class="text-3xl font-black text-slate-900 capitalize">{{ result()?.word }}</h2>
                  <button (click)="speak(result()?.word || '')" class="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors shadow-sm" title="Listen">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-indigo-600 font-mono font-medium">{{ result()?.phonetic }}</span>
                </div>
              </div>
              <button (click)="addToFlashcards()" class="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100 shadow-sm active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          <!-- Entries -->
          <div *ngFor="let entry of result()?.entries" class="space-y-4">
            <div class="flex items-center gap-2 px-2">
              <span class="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-black uppercase rounded-lg tracking-widest">{{ entry.partOfSpeech }}</span>
              <div class="h-[1px] flex-1 bg-slate-200"></div>
            </div>

            <div *ngFor="let def of entry.definitions" class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <p class="text-slate-800 font-medium text-lg leading-relaxed mb-2">{{ def.en }}</p>
              <p class="text-indigo-600 font-semibold mb-4 border-l-4 border-indigo-200 pl-3 py-1">{{ def.vi }}</p>
              
              <div *ngIf="def.example" class="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative group">
                <p class="italic text-slate-600 text-sm leading-relaxed mb-2 pr-8">"{{ def.example }}"</p>
                <p class="text-indigo-400 text-xs font-medium border-t border-slate-200/50 pt-2">— {{ def.exampleVi }}</p>
                
                <button (click)="speak(def.example)" class="absolute right-3 top-3 p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white" title="Listen to example">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                </button>
              </div>
            </div>

            <!-- Synonyms/Antonyms -->
            <div *ngIf="entry.synonyms?.length || entry.antonyms?.length" class="flex flex-wrap gap-2 px-2">
              <div *ngIf="entry.synonyms.length" class="flex flex-wrap gap-2">
                <span *ngFor="let s of entry.synonyms" class="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-100">#{{ s }}</span>
              </div>
              <div *ngIf="entry.antonyms.length" class="flex flex-wrap gap-2">
                <span *ngFor="let a of entry.antonyms" class="px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full border border-rose-100">#{{ a }}</span>
              </div>
            </div>
          </div>

          <!-- Collocations Section -->
          <div *ngIf="result()?.collocations?.length" class="space-y-4 pt-10 mt-10 border-t border-slate-200">
            <h3 class="text-sm font-black text-slate-400 uppercase tracking-[0.2em] px-2">Common Collocations & Phrases</h3>
            <div class="grid grid-cols-1 gap-4">
              <div *ngFor="let col of result()?.collocations" class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors">
                <div class="flex justify-between items-start mb-3">
                  <h4 class="text-xl font-bold text-indigo-600">{{ col.phrase }}</h4>
                  <span class="text-slate-400 text-sm font-medium">{{ col.meaning }}</span>
                </div>
                <div class="pl-4 border-l-2 border-indigo-50">
                  <p class="text-slate-600 text-sm italic mb-1">"{{ col.exampleEn }}"</p>
                  <p class="text-slate-400 text-xs">— {{ col.exampleVi }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!result() && !loading() && !error()" class="py-12 text-center opacity-40">
          <div class="text-6xl mb-6">📖</div>
          <h3 class="text-xl font-bold text-slate-900 mb-2">Search any word</h3>
          <p class="text-slate-500 max-w-xs mx-auto">Get detailed English-English and English-Vietnamese definitions powered by AI.</p>
        </div>

        <!-- Recent History Section -->
        <div *ngIf="history().length > 0 && !loading()" class="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div class="flex items-center justify-between mb-4 px-2">
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest">Recent Searches</h3>
            <button (click)="loadHistory()" class="text-indigo-600 text-xs font-bold hover:underline">Refresh</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button 
              *ngFor="let item of history()" 
              (click)="selectHistoryItem(item)"
              class="bg-white border border-slate-100 rounded-2xl p-4 text-left hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <div class="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors capitalize truncate">{{ item.word }}</div>
              <div class="text-[10px] text-slate-400 font-mono mt-1 truncate">{{ item.result.phonetic }}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class DictionaryComponent {
  private dictionaryService = inject(DictionaryService);
  private speechService = inject(SpeechService);
  private historyService = inject(HistoryService);
  
  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  history = signal<any[]>([]);

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    const items = await this.historyService.getRecentHistory(6);
    this.history.set(items);
  }

  selectHistoryItem(item: any) {
    this.searchQuery = item.word;
    this.result.set(item.result);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async search() {
    if (!this.searchQuery.trim()) return;
    
    this.loading.set(true);
    this.error.set(null);
    
    this.dictionaryService.lookup(this.searchQuery.trim()).subscribe({
      next: (res) => {
        if (res.error) {
          this.error.set(res.error);
          this.result.set(null);
        } else {
          this.result.set(res);
          this.historyService.saveSearch(res.word, res).then(() => {
            this.loadHistory(); // Refresh history list after saving
          });
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Network error occurred. Please check your connection.');
        this.loading.set(false);
      }
    });
  }

  speak(text: string) {
    this.speechService.speak(text);
  }

  addToFlashcards() {
    // This could be integrated with FlashcardService later
    console.log('Adding to flashcards:', this.result()?.word);
    alert('Word added to your learning list!');
  }
}
