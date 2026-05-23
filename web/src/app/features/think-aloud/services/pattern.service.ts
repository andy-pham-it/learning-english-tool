import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PatternData } from '../models/pattern.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PatternService {
  private http = inject(HttpClient);

  private allPatterns = signal<PatternData[]>([]);
  categories = signal<string[]>([]);

  async loadData(): Promise<void> {
    if (this.allPatterns().length > 0) return;

    const data = await firstValueFrom(this.http.get<PatternData[]>('/assets/data/patterns.json'));
    this.allPatterns.set(data);

    const cats = Array.from(new Set(data.map(p => p.category)));
    this.categories.set(cats);
  }

  getPatternsByCategory(category: string): PatternData[] {
    return this.allPatterns().filter(p => p.category === category);
  }

  getAllPatterns(): PatternData[] {
    return this.allPatterns();
  }

  buildSentence(pattern: PatternData, fillResults: { slotName: string; value: string }[]): string {
    let sentence = pattern.structure;
    for (const fill of fillResults) {
      sentence = sentence.replace(`{${fill.slotName}}`, fill.value);
    }
    sentence = sentence.replace(/\{[^}]+\}/g, '___');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (!sentence.endsWith('?') && !sentence.endsWith('.')) {
      sentence += '.';
    }
    return sentence;
  }
}
