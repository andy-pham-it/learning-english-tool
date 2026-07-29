import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore/lite';
import { DictionaryResult } from './models';

const SYSTEM_PROMPT = `You are a professional English-Vietnamese dictionary AI.
Given a word or phrase, return a strict JSON object with this exact structure:
{
  "word": "the requested word",
  "phonetic": "/ipa_pronunciation/",
  "entries": [
    {
      "partOfSpeech": "noun | verb | adjective | adverb | etc.",
      "definitions": [
        {
          "en": "English definition",
          "vi": "Vietnamese translation/definition",
          "example": "English example sentence",
          "exampleVi": "Vietnamese translation of example"
        }
      ]
    }
  ],
  "collocations": [
    {
      "phrase": "common phrase with this word",
      "meaning": "meaning of the phrase",
      "exampleEn": "example in English",
      "exampleVi": "example in Vietnamese"
    }
  ]
}
Rules:
1. Group multiple meanings by part of speech entries.
2. 1-3 definitions per entry, most common first.
3. 2-4 collocations if applicable.
4. Phonetic in IPA format.
5. Return ONLY the JSON object -- no markdown, no other text.
6. If the word doesn't exist, return { "error": "Word not found", "word": "the word" }`;

@Injectable({ providedIn: 'root' })
export class DictionaryAiService {
  private firestore = inject(Firestore);
  private cache = new Map<string, { data: DictionaryResult; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  async lookupWord(word: string): Promise<DictionaryResult> {
    const cached = this.cache.get(word);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // Check Firestore cache (shared with main app's dictionary/{word} collection)
    try {
      const normalizedWord = word.trim().toLowerCase();
      const docRef = doc(this.firestore, 'dictionary', normalizedWord);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const firestoreData = docSnap.data() as DictionaryResult;
        this.cache.set(word, { data: firestoreData, cachedAt: Date.now() });
        return firestoreData;
      }
    } catch (err) {
      console.error('[DictionaryAiService] Firestore read error:', err);
    }

    // Call Vercel API
    const result = await this.callApi(word);

    // Cache result
    this.cache.set(word, { data: result, cachedAt: Date.now() });

    // Save to Firestore
    if (!result.error) {
      try {
        const normalizedWord = word.trim().toLowerCase();
        const docRef = doc(this.firestore, 'dictionary', normalizedWord);
        await setDoc(docRef, { ...result, timestamp: serverTimestamp() });
      } catch (err) {
        console.error('[DictionaryAiService] Firestore write error:', err);
      }
    }

    return result;
  }

  private async callApi(word: string): Promise<DictionaryResult> {
    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { word, entries: [], collocations: [], error: `API error: ${res.status} - ${errText}` };
      }

      return await res.json();
    } catch (err) {
      return { word, entries: [], collocations: [], error: 'Failed to look up word. Please try again.' };
    }
  }
}
