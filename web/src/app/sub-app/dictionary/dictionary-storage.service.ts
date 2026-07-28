import { Injectable } from '@angular/core';
import type { HubClient } from './lib/hub-client';
import { VocabItem } from './models';

const HISTORY_KEY = 'dictionary_history';
const VOCABULARY_KEY = 'dictionary_vocabulary';
const MAX_HISTORY = 100;

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private hubClient: HubClient | null = null;

  setHubClient(client: HubClient): void {
    this.hubClient = client;
  }

  private requireClient(): HubClient {
    if (!this.hubClient) throw new Error('HubClient not set');
    return this.hubClient;
  }

  // --- History ---

  async getHistory(): Promise<string[]> {
    try {
      const res = await this.requireClient().storage.get(HISTORY_KEY);
      return (res?.value as string[]) || [];
    } catch {
      return [];
    }
  }

  async addToHistory(word: string): Promise<void> {
    const history = await this.getHistory();
    const filtered = history.filter(w => w.toLowerCase() !== word.toLowerCase());
    filtered.unshift(word);
    await this.requireClient().storage.set(HISTORY_KEY, filtered.slice(0, MAX_HISTORY));
  }

  async clearHistory(): Promise<void> {
    await this.requireClient().storage.set(HISTORY_KEY, []);
  }

  // --- Vocabulary ---

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    try {
      const res = await this.requireClient().storage.get(VOCABULARY_KEY);
      return (res?.value as Record<string, VocabItem>) || {};
    } catch {
      return {};
    }
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const vocab = await this.getVocabulary();
    vocab[word.toLowerCase()] = { note, savedAt: Date.now() };
    await this.requireClient().storage.set(VOCABULARY_KEY, vocab);
  }

  async removeWord(word: string): Promise<void> {
    const vocab = await this.getVocabulary();
    delete vocab[word.toLowerCase()];
    await this.requireClient().storage.set(VOCABULARY_KEY, vocab);
  }
}
