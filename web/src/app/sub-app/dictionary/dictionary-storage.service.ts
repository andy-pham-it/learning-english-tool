import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore/lite';
import { VocabItem } from './models';

const LS_VOCAB_KEY = 'dictionary_vocabulary';

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private firestore = inject(Firestore);

  private _isAuthenticated = false;

  setAuthState(authed: boolean): void {
    this._isAuthenticated = authed;
    console.log('[dictionary-sub-app] storage.setAuthState(', authed, ')');
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
        console.log('[dictionary-sub-app] Firestore read OK —', snap.size, 'words from dictionary collection');
        return vocab;
      } catch (err) {
        console.error('[dictionary-sub-app] Firestore read FAILED:', err);
      }
    } else {
      console.log('[dictionary-sub-app] not authenticated — skipping Firestore, using localStorage');
    }
    const local = this.loadLocal();
    console.log('[dictionary-sub-app] loaded', Object.keys(local).length, 'words from localStorage');
    return local;
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
