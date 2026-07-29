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

  private async readDoc(): Promise<SubAppData | null> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as SubAppData;
    } catch { /* Firestore unavailable */ }
    return null;
  }

  private async writeDoc(data: Partial<SubAppData>): Promise<void> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, data, { merge: true });
    } catch { /* Firestore write failed */ }
  }

  // ── History ──

  async getHistory(): Promise<string[]> {
    const firestore = await this.readDoc();
    if (firestore?.history?.length) return firestore.history;
    return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
  }

  async addToHistory(word: string): Promise<void> {
    const data = await this.readDoc();
    const history = (data?.history ?? [])
      .filter(w => w.toLowerCase() !== word.toLowerCase());
    history.unshift(word);
    const trimmed = history.slice(0, MAX_HISTORY);
    await this.writeDoc({ history: trimmed });
    try { localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  }

  async clearHistory(): Promise<void> {
    await this.writeDoc({ history: [] });
    try { localStorage.setItem(LS_HISTORY_KEY, '[]'); } catch { /* ignore */ }
  }

  // ── Vocabulary ──

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    const firestore = await this.readDoc();
    if (firestore?.vocabulary && Object.keys(firestore.vocabulary).length > 0) return firestore.vocabulary;
    try { return JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}'); } catch { return {}; }
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const normalized = word.trim().toLowerCase();
    const data = await this.readDoc();
    const vocab = { ...(data?.vocabulary ?? {}), [normalized]: { note, savedAt: Date.now() } };
    await this.writeDoc({ vocabulary: vocab });
    try { localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab)); } catch { /* ignore */ }
  }

  async removeWord(word: string): Promise<void> {
    const normalized = word.trim().toLowerCase();
    const data = await this.readDoc();
    if (!data?.vocabulary) return;
    const vocab = { ...data.vocabulary };
    delete vocab[normalized];
    await this.writeDoc({ vocabulary: vocab });
    try { localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab)); } catch { /* ignore */ }
  }
}
