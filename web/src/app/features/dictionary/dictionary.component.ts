import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryService, DictionaryResult } from '../../core/services/dictionary.service';
import { SpeechService } from '../../core/services/speech.service';

@Component({
  selector: 'app-dictionary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex h-screen bg-slate-50 overflow-hidden">
      <!-- Sidebar -->
      <aside class="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-40">
        <!-- Sidebar Header -->
        <div class="p-6 border-b border-slate-100 space-y-4">
          <h1 class="text-xl font-black text-slate-900 flex items-center gap-2">
            <span class="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm">D</span>
            Dictionary
          </h1>
          
          <div class="relative group">
            <input 
              type="text" 
              [(ngModel)]="searchQuery"
              (keyup.enter)="search()"
              placeholder="Quick search..."
              class="w-full bg-slate-100 border-none rounded-xl py-3 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <!-- Word List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
          <div class="px-3 mb-2 flex items-center justify-between">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Community</span>
            <button (click)="loadHistory()" class="p-1 hover:bg-slate-100 rounded-md transition-colors text-indigo-500">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          <button 
            *ngFor="let item of history()" 
            (click)="selectHistoryItem(item)"
            [class.bg-indigo-50]="result()?.word?.toLowerCase() === item.word?.toLowerCase()"
            [class.border-indigo-100]="result()?.word?.toLowerCase() === item.word?.toLowerCase()"
            class="w-full text-left px-4 py-3 rounded-xl border border-transparent hover:bg-slate-50 transition-all group flex flex-col gap-0.5"
          >
            <span class="font-bold text-sm text-slate-900 capitalize" [class.text-indigo-600]="result()?.word?.toLowerCase() === item.word?.toLowerCase()">{{ item.word }}</span>
            <span class="text-[10px] text-slate-400 font-mono truncate">{{ item.phonetic }}</span>
          </button>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-4 border-t border-slate-100 bg-slate-50/50">
          <button (click)="migrateData()" class="w-full text-[10px] bg-white border border-slate-200 text-slate-400 py-2 rounded-lg font-bold uppercase hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all">Migrate Old Data</button>
        </div>
      </aside>

      <!-- Main Panel -->
      <main class="flex-1 overflow-y-auto relative bg-white lg:rounded-tl-[3rem] lg:shadow-2xl lg:shadow-slate-200/50 lg:-ml-12 no-scrollbar z-50">
        
        <!-- Search Loading Overlay -->
        <div *ngIf="loading()" class="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div class="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p class="text-slate-400 font-medium">Consulting AI...</p>
        </div>

        <div class="max-w-3xl mx-auto p-8 lg:p-12 min-h-full flex flex-col">
          <!-- Empty State -->
          <div *ngIf="!result() && !error()" class="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-30">
            <div class="text-8xl mb-8">📖</div>
            <h3 class="text-2xl font-black text-slate-900 mb-3">Community Dictionary</h3>
            <p class="text-slate-500 max-w-sm">Select a word from the sidebar or search for a new one to see detailed definitions.</p>
          </div>

          <!-- Error State -->
          <div *ngIf="error()" class="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center animate-in zoom-in-95">
            <div class="text-4xl mb-4">😕</div>
            <p class="text-rose-600 font-bold">{{ error() }}</p>
            <button (click)="search()" class="mt-4 text-indigo-600 text-sm font-bold underline">Try again</button>
          </div>

          <!-- Result Content -->
          <div *ngIf="result() && !loading()" class="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            <!-- Word Header Card -->
            <div class="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
               <!-- Decorative elements -->
               <div class="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500 rounded-full opacity-20 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
               <div class="absolute -left-10 -bottom-10 w-40 h-40 bg-white rounded-full opacity-10 blur-2xl"></div>

               <div class="relative z-10">
                 <div class="flex justify-between items-start">
                   <div class="space-y-2">
                     <h2 class="text-5xl font-black capitalize tracking-tight">{{ result()?.word }}</h2>
                     <div class="flex items-center gap-4">
                       <span class="text-indigo-100 font-mono text-lg opacity-80">{{ result()?.phonetic }}</span>
                       <button (click)="speak(result()?.word || '')" class="p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all backdrop-blur-md active:scale-90">
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                       </button>
                     </div>
                   </div>
                   <button *ngIf="!isInHistory()" (click)="addToFlashcards()" class="p-5 bg-white text-indigo-600 rounded-3xl hover:shadow-lg transition-all active:scale-95 shadow-xl shadow-indigo-900/10">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                   </button>
                 </div>
               </div>
            </div>

            <!-- Definitions Section -->
            <div class="space-y-10">
              <div *ngFor="let entry of result()?.entries" class="space-y-6">
                <div class="flex items-center gap-4 px-2">
                  <span class="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full tracking-[0.2em]">{{ entry.partOfSpeech }}</span>
                  <div class="h-[1px] flex-1 bg-slate-100"></div>
                </div>

                <div class="grid grid-cols-1 gap-6">
                  <div *ngFor="let def of entry.definitions" class="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                    <p class="text-slate-900 font-bold text-xl leading-relaxed mb-4">{{ def.en }}</p>
                    <div class="inline-block px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-2xl mb-6 text-sm">
                      {{ def.vi }}
                    </div>
                    
                    <div *ngIf="def.example" class="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50 relative group/ex">
                      <p class="italic text-slate-600 text-sm leading-relaxed mb-3 pr-10">"{{ def.example }}"</p>
                      <p class="text-slate-400 text-xs font-medium border-t border-slate-200/50 pt-3 flex items-center gap-2">
                        <span class="w-1 h-1 bg-indigo-300 rounded-full"></span>
                        {{ def.exampleVi }}
                      </p>
                      <button (click)="speak(def.example)" class="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white text-indigo-400 rounded-xl shadow-sm opacity-0 group-hover/ex:opacity-100 transition-all hover:bg-indigo-600 hover:text-white" title="Listen">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Collocations Section -->
            <div *ngIf="result()?.collocations?.length" class="space-y-6 pt-12">
              <div class="flex items-center gap-4 px-2">
                <span class="px-4 py-1.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-[0.2em]">Phrases & Collocations</span>
                <div class="h-[1px] flex-1 bg-indigo-50"></div>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div *ngFor="let col of result()?.collocations" class="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all group">
                  <div class="flex justify-between items-start mb-4">
                    <h4 class="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{{ col.phrase }}</h4>
                  </div>
                  <p class="text-indigo-500 text-xs font-bold mb-4 uppercase tracking-wider">{{ col.meaning }}</p>
                  <div class="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p class="text-slate-600 text-[11px] italic leading-relaxed">"{{ col.exampleEn }}"</p>
                    <p class="text-slate-400 text-[10px]">— {{ col.exampleVi }}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class DictionaryComponent {
  private dictionaryService = inject(DictionaryService);
  private speechService = inject(SpeechService);
  
  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  history = signal<any[]>([]);

  isInHistory = computed(() => {
    const currentWord = this.result()?.word?.toLowerCase();
    if (!currentWord) return false;
    return this.history().some(item => item.word?.toLowerCase() === currentWord);
  });

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    // Increased limit for sidebar list
    const items = await this.dictionaryService.getSavedWords(50);
    this.history.set(items);
  }

  selectHistoryItem(item: any) {
    this.searchQuery = item.word;
    this.result.set(item);
    this.error.set(null);
  }

  async search() {
    if (!this.searchQuery.trim()) return;
    
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const res = await this.dictionaryService.lookup(this.searchQuery.trim());
      if (res.error) {
        this.error.set(res.error);
        this.result.set(null);
      } else {
        this.result.set(res);
        this.loadHistory(); // Refresh history list after saving
      }
    } catch (err) {
      this.error.set('Network error occurred. Please check your connection.');
    } finally {
      this.loading.set(false);
    }
  }

  speak(text: string) {
    this.speechService.speak(text);
  }

  async migrateData() {
    if (confirm('Bạn có chắc muốn chuyển đổi dữ liệu cũ sang từ điển chung không?')) {
      await this.dictionaryService.migrateOldHistory();
      this.loadHistory();
    }
  }

  addToFlashcards() {
    console.log('Adding to flashcards:', this.result()?.word);
    alert('Word added to your learning list!');
  }
}
