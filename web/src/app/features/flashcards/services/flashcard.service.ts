import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StorageService } from '../../../core/services/storage.service';
import { FlashcardData, FlashcardProgress } from '../models/flashcard.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FlashcardService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);

  private readonly DECK_KEY = 'flashcard_deck_it_b2';
  private readonly PROGRESS_KEY = 'flashcard_progress';

  async initializeDeck(): Promise<void> {
    let deck = await this.storage.getItem<FlashcardData[]>(this.DECK_KEY);
    if (!deck) {
      deck = await firstValueFrom(this.http.get<FlashcardData[]>('/assets/data/it_b2.json'));
      await this.storage.setItem(this.DECK_KEY, deck);
    }
  }

  async getCardsToReview(): Promise<{ data: FlashcardData, progress: FlashcardProgress | null }[]> {
    const deck = await this.storage.getItem<FlashcardData[]>(this.DECK_KEY) || [];
    const allProgress = await this.storage.getItem<Record<string, FlashcardProgress>>(this.PROGRESS_KEY) || {};
    
    const now = Date.now();
    const cardsToReview = deck.map(card => {
      const progress = allProgress[card.id] || null;
      return { data: card, progress };
    }).filter(card => {
      if (!card.progress) return true; // New card
      return card.progress.nextReviewDate <= now;
    });

    return cardsToReview;
  }

  async updateProgress(cardId: string, grade: number): Promise<void> {
    // grade: 0-5
    const allProgress = await this.storage.getItem<Record<string, FlashcardProgress>>(this.PROGRESS_KEY) || {};
    let progress = allProgress[cardId];
    
    if (!progress) {
      progress = { id: cardId, repetition: 0, interval: 1, efactor: 2.5, nextReviewDate: Date.now() };
    }

    if (grade >= 3) {
      if (progress.repetition === 0) {
        progress.interval = 1;
      } else if (progress.repetition === 1) {
        progress.interval = 6;
      } else {
        progress.interval = Math.round(progress.interval * progress.efactor);
      }
      progress.repetition++;
    } else {
      progress.repetition = 0;
      progress.interval = 1;
    }

    progress.efactor += (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (progress.efactor < 1.3) progress.efactor = 1.3;

    // Convert interval (in days) to timestamp
    const nextReview = Date.now() + progress.interval * 24 * 60 * 60 * 1000;
    progress.nextReviewDate = nextReview;

    allProgress[cardId] = progress;
    await this.storage.setItem(this.PROGRESS_KEY, allProgress);
  }
}
