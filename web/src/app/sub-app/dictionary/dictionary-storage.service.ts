import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore/lite';
import { VocabItem } from './models';

const FIRESTORE_DOC = 'sub_app_dictionary/data';
const MAX_HISTORY = 100;
const LS_HISTORY_KEY = 'dictionary_history';
const LS_VOCAB_KEY = 'dictionary_vocabulary';

interface SubAppData {
  history: string[];
  vocabulary: Record<string, VocabItem>;
}

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private firestore = inject(Firestore);

  private async getData(): Promise<SubAppData> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as SubAppData;
    } catch { /* fallback to localStorage */ }
    return this.loadLocal();
  }

  private async saveData(data: SubAppData): Promise<void> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, data);
    } catch { /* Firestore write failed — save locally */ }
    this.saveLocal(data);
  }

  private loadLocal(): SubAppData {
    return {
      history: JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]'),
      vocabulary: JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}'),
    };
  }

  private saveLocal(data: SubAppData): void {
    try {
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(data.history));
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(data.vocabulary));
    } catch { /* localStorage full or unavailable */ }
  }

  async getHistory(): Promise<string[]> {
    const data = await this.getData();
    return data.history;
  }

  async addToHistory(word: string): Promise<void> {
    const data = await this.getData();
    const filtered = data.history.filter(w => w.toLowerCase() !== word.toLowerCase());
    filtered.unshift(word);
    data.history = filtered.slice(0, MAX_HISTORY);
    await this.saveData(data);
  }

  async clearHistory(): Promise<void> {
    const data = await this.getData();
    data.history = [];
    await this.saveData(data);
  }

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    const data = await this.getData();
    return data.vocabulary;
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const data = await this.getData();
    data.vocabulary[word.toLowerCase()] = { note, savedAt: Date.now() };
    await this.saveData(data);
  }

  async removeWord(word: string): Promise<void> {
    const data = await this.getData();
    delete data.vocabulary[word.toLowerCase()];
    await this.saveData(data);
  }
}
