import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThinkAloudService } from '../services/think-aloud.service';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { FlashcardComponent } from '../components/flashcard/flashcard.component';
import { QuickDictionaryComponent } from '../components/quick-dictionary/quick-dictionary.component';
import { ThinkAloudData } from '../models/think-aloud.model';

@Component({
  selector: 'app-think-aloud-page',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FlashcardComponent, QuickDictionaryComponent],
  template: `
    <div class="flex h-full bg-slate-50">
      <!-- SIDEBAR (Desktop) -->
      <aside class="hidden md:block h-full">
        <app-think-aloud-sidebar 
          [categories]="service.categories()"
          [selected]="selectedCategory()"
          (select)="selectCategory($event)">
        </app-think-aloud-sidebar>
      </aside>

      <!-- MOBILE CATEGORY SELECTOR -->
      <div class="md:hidden fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 z-40 overflow-x-auto whitespace-nowrap flex gap-2 no-scrollbar">
        <button *ngFor="let cat of service.categories()"
                (click)="selectCategory(cat)"
                [class.bg-indigo-600]="selectedCategory() === cat"
                [class.text-white]="selectedCategory() === cat"
                [class.bg-white]="selectedCategory() !== cat"
                [class.text-slate-600]="selectedCategory() !== cat"
                class="px-4 py-2 rounded-full text-xs font-bold border border-slate-100 shadow-sm transition-all">
          {{ cat }}
        </button>
      </div>

      <!-- MAIN CONTENT -->
      <div class="flex-1 flex flex-col items-center justify-center p-6 md:p-12 mt-16 md:mt-0">
        
        <div class="w-full max-w-3xl mb-8 flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight mb-2">Practice Session</h1>
            <p class="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">
              {{ selectedCategory() }} &bull; {{ currentIndex() + 1 }} of {{ currentPhrases().length }}
            </p>
          </div>
          
          <div class="flex gap-2">
            <button (click)="prev()" [disabled]="currentIndex() === 0"
                    class="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm disabled:opacity-30 transition-all hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button (click)="next()" [disabled]="currentIndex() === currentPhrases().length - 1"
                    class="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm disabled:opacity-30 transition-all hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div *ngIf="currentCard()" class="w-full max-w-3xl animate-fade-in">
          <app-think-aloud-card [card]="currentCard()!" (lookup)="onQuickLookup($event)"></app-think-aloud-card>
        </div>

        <!-- QUICK DICTIONARY OVERLAY -->
        <app-quick-dictionary 
          *ngIf="lookupWord()" 
          [word]="lookupWord()!" 
          (close)="lookupWord.set(null)">
        </app-quick-dictionary>

        <!-- PROGRESS DOTS -->
        <div class="mt-8 flex gap-1.5 flex-wrap justify-center max-w-md">
          <div *ngFor="let p of currentPhrases(); let i = index"
               [class.bg-indigo-500]="currentIndex() === i"
               [class.bg-slate-200]="currentIndex() !== i"
               class="h-1 rounded-full transition-all duration-300"
               [style.width.px]="currentIndex() === i ? 24 : 8">
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
  `]
})
export class ThinkAloudPageComponent implements OnInit {
  protected service = inject(ThinkAloudService);
  
  selectedCategory = signal<string>('');
  currentIndex = signal(0);
  lookupWord = signal<string | null>(null);
  
  currentPhrases = computed(() => {
    return this.service.getPhrasesByCategory(this.selectedCategory());
  });
  
  currentCard = computed(() => {
    return this.currentPhrases()[this.currentIndex()];
  });

  async ngOnInit() {
    await this.service.loadData();
    if (this.service.categories().length > 0) {
      this.selectedCategory.set(this.service.categories()[0]);
    }
  }

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
    this.currentIndex.set(0);
  }

  onQuickLookup(word: string) {
    this.lookupWord.set(word);
  }

  next() {
    if (this.currentIndex() < this.currentPhrases().length - 1) {
      this.currentIndex.update(i => i + 1);
    }
  }

  prev() {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
    }
  }
}
