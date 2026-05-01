import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface DictionaryEntry {
  partOfSpeech: string;
  definitions: {
    en: string;
    vi: string;
    example: string;
    exampleVi: string;
  }[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryResult {
  word: string;
  phonetic: string;
  audioUrl?: string;
  entries: DictionaryEntry[];
  collocations?: {
    phrase: string;
    meaning: string;
    exampleEn: string;
    exampleVi: string;
  }[];
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DictionaryService {
  private http = inject(HttpClient);
  private readonly apiUrl = '/api/dictionary';

  lookup(word: string): Observable<DictionaryResult> {
    return this.http.post<DictionaryResult>(this.apiUrl, { word }).pipe(
      catchError(err => {
        console.error('Dictionary lookup failed:', err);
        return of({ word, phonetic: '', entries: [], error: 'Could not fetch definition. Please try again.' } as DictionaryResult);
      })
    );
  }
}
