import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlashcardService } from '../services/flashcard.service';
import { FlashcardComponent } from '../components/flashcard/flashcard.component';
import { FlashcardData, FlashcardProgress } from '../models/flashcard.model';
import { UserProfileService } from '../../../core/services/user-profile.service';

@Component({
  selector: 'app-flashcards-page',
  standalone: true,
  imports: [CommonModule, FlashcardComponent],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      <!-- HEADER / STATUS -->
      <div class="w-full max-w-md mx-auto mb-8 text-center" *ngIf="!isLoading">
        <h1 class="text-3xl font-black text-slate-900 mb-2 tracking-tight">IT Vocabulary</h1>
        <p class="text-indigo-600 font-bold uppercase text-[10px] tracking-[0.2em]">
          <span *ngIf="cardsToReview.length > 0">{{ cardsToReview.length }} cards to review</span>
          <span *ngIf="cardsToReview.length === 0" class="text-emerald-500">All done for today! 🎉</span>
        </p>
      </div>

      <!-- MAIN CARD AREA -->
      <div class="w-full max-w-md" *ngIf="!isLoading">
        
        <ng-container *ngIf="currentCard">
          <app-flashcard 
            [card]="currentCard.data" 
            (graded)="onCardGraded($event)">
          </app-flashcard>
        </ng-container>

        <!-- EMPTY STATE -->
        <div *ngIf="!currentCard" class="w-full max-w-sm mx-auto h-[480px] rounded-3xl p-8 flex flex-col justify-center items-center text-center border border-slate-100 bg-white shadow-sm">
           <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100">
             <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
               <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
             </svg>
           </div>
           <h2 class="text-2xl font-bold text-slate-800 mb-3">You're all caught up!</h2>
           <p class="text-slate-400 mb-8 font-medium">Excellent work. Come back tomorrow for more vocabulary review.</p>
           
           <button (click)="refresh()" class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all font-bold shadow-md shadow-indigo-100">
             Check Again
           </button>
        </div>

      </div>

      <!-- LOADING STATE -->
      <div *ngIf="isLoading" class="flex flex-col items-center justify-center h-[480px]">
        <div class="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Loading your deck...</p>
      </div>
      
    </div>

  `
})
export class FlashcardsPageComponent implements OnInit {
  private flashcardService = inject(FlashcardService);
  private profileService = inject(UserProfileService);

  cardsToReview: { data: FlashcardData, progress: FlashcardProgress | null }[] = [];
  currentCard: { data: FlashcardData, progress: FlashcardProgress | null } | null = null;
  isLoading = true;

  async ngOnInit() {
    await this.loadDeck();
  }

  async loadDeck() {
    this.isLoading = true;
    try {
      await this.flashcardService.initializeDeck();
      this.cardsToReview = await this.flashcardService.getCardsToReview();
      this.currentCard = this.cardsToReview.length > 0 ? this.cardsToReview[0] : null;
    } catch (e) {
      console.error('Failed to load deck', e);
    } finally {
      this.isLoading = false;
    }
  }

  async onCardGraded(score: number) {
    if (!this.currentCard) return;

    // Process the grade
    await this.flashcardService.updateProgress(this.currentCard.data.id, score);
    
    // Grant XP based on performance: score 0=Again,1=Hard,2=Good,3=Easy
    const xpRewards = [0, 2, 5, 10];
    const xp = xpRewards[score] ?? 0;
    if (xp > 0) {
      await this.profileService.addXP(xp);
      await this.profileService.recordActivity('flashcard');
    }

    // Remove the current card from the array
    this.cardsToReview.shift();
    
    // Set the new current card
    if (this.cardsToReview.length > 0) {
      this.currentCard = this.cardsToReview[0];
    } else {
      this.currentCard = null;
    }
  }

  refresh() {
    this.loadDeck();
  }
}
