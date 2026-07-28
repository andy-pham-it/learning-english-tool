import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore/lite';
import { DictionaryResult } from './models';
import type { HubClient } from './lib/hub-client';

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
  private hubClient: HubClient | null = null;
  private cache = new Map<string, { data: DictionaryResult; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  setHubClient(client: HubClient): void {
    this.hubClient = client;
  }

  async lookupWord(word: string): Promise<DictionaryResult> {
    // Check in-memory cache first
    const cached = this.cache.get(word);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // Check hub-client storage cache
    if (this.hubClient) {
      const stored = await this.hubClient.storage.get(`dictionary_cache_${word}`);
      if (stored?.value) {
        const parsed = stored.value as { data: DictionaryResult; cachedAt: number };
        if (Date.now() - parsed.cachedAt < this.CACHE_TTL_MS) {
          this.cache.set(word, parsed);
          return parsed.data;
        }
      }
    }

    // Check Firestore cache (shared with main app's dictionary/{word} collection)
    try {
      const normalizedWord = word.trim().toLowerCase();
      const docRef = doc(this.firestore, 'dictionary', normalizedWord);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const firestoreData = docSnap.data() as DictionaryResult;
        const cacheEntry = { data: firestoreData, cachedAt: Date.now() };
        this.cache.set(word, cacheEntry);
        if (this.hubClient) {
          await this.hubClient.storage.set(`dictionary_cache_${word}`, cacheEntry);
        }
        return firestoreData;
      }
    } catch (err) {
      console.error('[DictionaryAiService] Firestore read error:', err);
    }

    // Call AI
    const result = await this.callAi(word);

    // Cache result (in-memory + hub-client)
    const cacheEntry = { data: result, cachedAt: Date.now() };
    this.cache.set(word, cacheEntry);
    if (this.hubClient) {
      await this.hubClient.storage.set(`dictionary_cache_${word}`, cacheEntry);
    }

    // Save to Firestore (shared cache for main app)
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

  private async callAi(word: string): Promise<DictionaryResult> {
    if (!this.hubClient) {
      return { word, entries: [], collocations: [], error: 'Not connected to The Hub' };
    }

    try {
      const response = await this.hubClient.ai.chat({
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: word },
        ],
        temperature: 0.2,
        maxTokens: 1024,
      });

      const cleaned = response.content
        .replace(/```json?\s*/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (parsed.error) {
        return { word: parsed.word || word, entries: [], collocations: [], error: parsed.error };
      }

      return {
        word: parsed.word || word,
        phonetic: parsed.phonetic,
        entries: parsed.entries || [],
        collocations: parsed.collocations || [],
      };
    } catch (err) {
      return { word, entries: [], collocations: [], error: 'Failed to look up word. Please try again.' };
    }
  }
}
