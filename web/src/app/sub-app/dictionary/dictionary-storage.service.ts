import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, deleteDoc, doc } from '@angular/fire/firestore/lite';
import { VocabItem } from './models';

const LS_VOCAB_KEY = 'dictionary_vocabulary';

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private firestore = inject(Firestore);

  private _isAuthenticated = false;

  setAuthState(authed: boolean): void {
    this._isAuthenticated = authed;
  }

  /**
   * Vocabulary = all words in the shared `dictionary` collection
   * (each doc is a cached definition, saved by DictionaryAiService on lookup).
   * Falls back to localStorage when not authenticated via The Hub.
   */
  async getVocabulary(): Promise<Record<string, VocabItem>> {
    if (this._isAuthenticated) {
      try {
        const snap = await getDocs(collection(this.firestore, 'dictionary'));
        const vocab: Record<string, VocabItem> = {};
        snap.forEach((d) => {
          const data = d.data();
          const ts = data['timestamp'];
          vocab[d.id] = {
            note: '',
            savedAt: ts ? Number(ts.toMillis()) : Date.now(),
          };
        });
        return vocab;
      } catch { /* Firestore read failed */ }
    }
    return this.loadLocal();
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const normalized = word.trim().toLowerCase();

    if (this._isAuthenticated) {
      // Definition is already written to dictionary/{word} by DictionaryAiService.
      // Nothing extra to persist — just mirror into localStorage for offline fallback.
      const vocab = await this.getVocabulary();
      vocab[normalized] = { note, savedAt: Date.now() };
      this.saveLocal(vocab);
      return;
    }

    const local = this.loadLocal();
    local[normalized] = { note, savedAt: Date.now() };
    this.saveLocal(local);
  }

  async removeWord(word: string): Promise<void> {
    const normalized = word.trim().toLowerCase();

    if (this._isAuthenticated) {
      try {
        await deleteDoc(doc(this.firestore, 'dictionary', normalized));
      } catch { /* Firestore delete failed */ }
    }

    const local = this.loadLocal();
    delete local[normalized];
    this.saveLocal(local);
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
