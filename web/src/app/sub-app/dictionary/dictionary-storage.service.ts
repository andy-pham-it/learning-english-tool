import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from '@angular/fire/firestore/lite';
import { Auth } from '@angular/fire/auth';
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
  private auth = inject(Auth);

  // ── Private helpers ──

  private userId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  private vocabCollectionPath(uid: string): string {
    return `users/${uid}/vocabulary`;
  }

  /** Read vocabulary from the old per-user Firestore collection (users/{uid}/vocabulary/{word}) */
  private async readPerUserVocab(): Promise<Record<string, VocabItem>> {
    const uid = this.userId();
    if (!uid) return {};
    try {
      const col = collection(this.firestore, this.vocabCollectionPath(uid));
      const snap = await getDocs(col);
      const result: Record<string, VocabItem> = {};
      snap.forEach(d => {
        const data = d.data();
        result[d.id] = { note: '', savedAt: data['timestamp']?.toMillis?.() ?? Date.now() };
      });
      return result;
    } catch {
      return {}; // fall through to shared doc
    }
  }

  /** Read vocabulary from the shared document fallback */
  private async readSharedVocab(): Promise<Record<string, VocabItem>> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as SubAppData;
        return data.vocabulary ?? {};
      }
    } catch { /* ignore */ }
    return {};
  }

  // ── History (always shared doc) ──

  private async readHistory(): Promise<string[]> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as SubAppData;
        return data.history ?? [];
      }
    } catch { /* ignore */ }
    return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
  }

  private async writeHistory(history: string[]): Promise<void> {
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, { history, vocabulary: {} }, { merge: true });
    } catch { /* Firestore write failed */ }
    try {
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
    } catch { /* localStorage unavailable */ }
  }

  // ── Public API ──

  async getHistory(): Promise<string[]> {
    return this.readHistory();
  }

  async addToHistory(word: string): Promise<void> {
    const history = await this.readHistory();
    const filtered = history.filter(w => w.toLowerCase() !== word.toLowerCase());
    filtered.unshift(word);
    await this.writeHistory(filtered.slice(0, MAX_HISTORY));
  }

  async clearHistory(): Promise<void> {
    await this.writeHistory([]);
  }

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    // 1. Try per-user collection (old format)
    const perUser = await this.readPerUserVocab();
    if (Object.keys(perUser).length > 0) return perUser;

    // 2. Fallback to shared doc
    const shared = await this.readSharedVocab();
    if (Object.keys(shared).length > 0) return shared;

    // 3. LocalStorage fallback
    try {
      return JSON.parse(localStorage.getItem(LS_VOCAB_KEY) || '{}');
    } catch {
      return {};
    }
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const uid = this.userId();
    const normalized = word.trim().toLowerCase();

    if (uid) {
      // Use old per-user collection
      try {
        const ref = doc(this.firestore, this.vocabCollectionPath(uid), normalized);
        await setDoc(ref, { word: normalized, timestamp: serverTimestamp() });
        return;
      } catch { /* fall through to shared doc */ }
    }

    // Fallback to shared doc
    const vocab = await this.readSharedVocab();
    vocab[normalized] = { note, savedAt: Date.now() };
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, { vocabulary: vocab }, { merge: true });
    } catch { /* Firestore write failed */ }
    try {
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab));
    } catch { /* localStorage unavailable */ }
  }

  async removeWord(word: string): Promise<void> {
    const uid = this.userId();
    const normalized = word.trim().toLowerCase();

    if (uid) {
      try {
        const ref = doc(this.firestore, this.vocabCollectionPath(uid), normalized);
        await setDoc(ref, { word: normalized, timestamp: serverTimestamp(), _deleted: true });
        return;
      } catch { /* fall through */ }
    }

    const vocab = await this.readSharedVocab();
    delete vocab[normalized];
    try {
      const ref = doc(this.firestore, FIRESTORE_DOC);
      await setDoc(ref, { vocabulary: vocab }, { merge: true });
    } catch { /* ignore */ }
    try {
      localStorage.setItem(LS_VOCAB_KEY, JSON.stringify(vocab));
    } catch { /* ignore */ }
  }
}
