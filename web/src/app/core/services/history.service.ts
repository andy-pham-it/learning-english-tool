import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from '@angular/fire/firestore/lite';
import { Auth } from '@angular/fire/auth';
import { DictionaryResult } from './dictionary.service';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  async saveSearch(word: string, result: DictionaryResult): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    // Save to /users/{uid}/history/{word}
    // We use the word as the document ID to easily update if searched again
    const historyRef = doc(this.firestore, `users/${user.uid}/history`, word.toLowerCase());
    
    await setDoc(historyRef, {
      word: word,
      result: result,
      timestamp: serverTimestamp(),
      searchCount: 1 // We could use increment(1) if we want to track frequency
    }, { merge: true });
  }

  async getRecentHistory(count: number = 10): Promise<any[]> {
    const user = this.auth.currentUser;
    if (!user) return [];

    const historyCol = collection(this.firestore, `users/${user.uid}/history`);
    const q = query(historyCol, orderBy('timestamp', 'desc'), limit(count));
    const snap = await getDocs(q);
    
    return snap.docs.map(d => d.data());
  }
}
