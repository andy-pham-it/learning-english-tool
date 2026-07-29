import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from '@angular/fire/firestore/lite';
import { Auth } from '@angular/fire/auth';
import { VocabItem } from './models';

const LS_VOCAB_KEY = 'dictionary_vocabulary';

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private userId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    // 1. Per-user Firestore collection (users/{uid}/vocabulary/{word})
    const uid = this.userId();
    if (uid) {
      try {
        const col = collection(this.firestore, `users/${uid}/vocabulary`);
        const snap = await getDocs(col);
        const result: Record<string, VocabItem> = {};
        snap.forEach(d => {
          const data = d.data();
          result[d.id] = {
            note: data['note'] ?? '',
            savedAt: data['savedAt']?.toMillis?.() ?? data['savedAt'] ?? Date.now(),
          };
        });
        return result;
      } catch { /* fall through */ }
    }

    // 2. localStorage fallback
    try {
      return JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}');
    } catch {
      return {};
    }
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const normalized = word.trim().toLowerCase();
    const uid = this.userId();

    // Always save to localStorage
    try {
      const vocab = JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}');
      vocab[normalized] = { note, savedAt: Date.now() };
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab));
    } catch { /* localStorage unavailable */ }

    // Sync to Firestore per-user collection when logged in
    if (uid) {
      try {
        const ref = doc(this.firestore, `users/${uid}/vocabulary`, normalized);
        await setDoc(ref, { word: normalized, note, savedAt: Date.now() });
      } catch { /* Firestore write failed */ }
    }
  }

  async removeWord(word: string): Promise<void> {
    const normalized = word.trim().toLowerCase();
    const uid = this.userId();

    // Remove from localStorage
    try {
      const vocab = JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}');
      delete vocab[normalized];
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab));
    } catch { /* ignore */ }

    // Remove from Firestore when logged in
    if (uid) {
      try {
        const ref = doc(this.firestore, `users/${uid}/vocabulary`, normalized);
        await deleteDoc(ref);
      } catch { /* ignore */ }
    }
  }
}
