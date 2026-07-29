import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore/lite';
import { VocabItem } from './models';

const FIRESTORE_DOC = 'sub_app_dictionary/data';
const LS_VOCAB_KEY = 'dictionary_vocabulary';

interface SubAppData {
  vocabulary: Record<string, VocabItem>;
}

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private firestore = inject(Firestore);

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) return (snap.data() as SubAppData).vocabulary || {};
    } catch { /* fallback */ }
    return this.loadLocal();
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const normalized = word.trim().toLowerCase();
    const vocab = await this.getVocabulary();
    vocab[normalized] = { note, savedAt: Date.now() };

    // Save to Firestore (shared across all users)
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, { vocabulary: vocab });
    } catch { /* Firestore write failed */ }

    // Fallback: save to localStorage
    this.saveLocal(vocab);
  }

  async removeWord(word: string): Promise<void> {
    const normalized = word.trim().toLowerCase();
    const vocab = await this.getVocabulary();
    delete vocab[normalized];

    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, { vocabulary: vocab });
    } catch { /* ignore */ }

    this.saveLocal(vocab);
  }

  private loadLocal(): Record<string, VocabItem> {
    try {
      return JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}');
    } catch {
      return {};
    }
  }

  private saveLocal(vocab: Record<string, VocabItem>): void {
    try {
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab));
    } catch { /* localStorage full */ }
  }
}
