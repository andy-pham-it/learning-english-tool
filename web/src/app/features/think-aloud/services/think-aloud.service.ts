import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ThinkAloudData } from '../models/think-aloud.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThinkAloudService {
  private http = inject(HttpClient);
  
  private allPhrases = signal<ThinkAloudData[]>([]);
  categories = signal<string[]>([]);

  async loadData(): Promise<void> {
    if (this.allPhrases().length > 0) return;
    
    const data = await firstValueFrom(this.http.get<ThinkAloudData[]>('/assets/data/think-aloud.json'));
    this.allPhrases.set(data);
    
    // Extract unique categories
    const cats = Array.from(new Set(data.map(p => p.category)));
    this.categories.set(cats);
  }

  getPhrasesByCategory(category: string): ThinkAloudData[] {
    return this.allPhrases().filter(p => p.category === category);
  }

  getAllPhrases(): ThinkAloudData[] {
    return this.allPhrases();
  }
}
