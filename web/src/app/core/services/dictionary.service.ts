import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from '@angular/fire/firestore/lite';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

export interface DictionaryEntry {
  partOfSpeech: string;
  definitions: {
    en: string;
    vi: string;
    example: string;
    exampleVi: string;
  }[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryResult {
  word: string;
  phonetic: string;
  audioUrl?: string;
  entries: DictionaryEntry[];
  collocations?: {
    phrase: string;
    meaning: string;
    exampleEn: string;
    exampleVi: string;
  }[];
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DictionaryService {
  private http = inject(HttpClient);
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private readonly apiUrl = '/api/dictionary';

  async lookup(word: string): Promise<DictionaryResult> {
    const normalizedWord = word.trim().toLowerCase();
    
    // 1. Check Firestore 'dictionary' collection
    const docRef = doc(this.firestore, 'dictionary', normalizedWord);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log(`[DictionaryService] Cache hit for "${normalizedWord}"`);
        return docSnap.data() as DictionaryResult;
      }
    } catch (err) {
      console.error('[DictionaryService] Error fetching from Firestore:', err);
    }

    console.log(`[DictionaryService] Cache miss for "${normalizedWord}", calling API...`);
    // 2. Not found or error, call API
    try {
      const result = await firstValueFrom(
        this.http.post<DictionaryResult>(this.apiUrl, { word: normalizedWord })
      );

      // 3. Save to DB
      if (!result.error) {
        try {
          await setDoc(docRef, {
            ...result,
            timestamp: serverTimestamp()
          });
          console.log(`[DictionaryService] Saved "${normalizedWord}" to Firestore`);
        } catch (dbErr) {
          console.error('[DictionaryService] Error saving to Firestore:', dbErr);
        }
      }
      return result;
    } catch (apiErr) {
      console.error('[DictionaryService] Dictionary API call failed:', apiErr);
      return { word: normalizedWord, phonetic: '', entries: [], error: 'Could not fetch definition. Please try again.' } as DictionaryResult;
    }
  }

  async getSavedWords(limitCount: number = 20): Promise<any[]> {
    try {
      const dictCol = collection(this.firestore, 'dictionary');
      const q = query(dictCol, orderBy('timestamp', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (err) {
      console.error('[DictionaryService] Error fetching saved words:', err);
      return [];
    }
  }

  async migrateOldHistory(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      console.error('You must be logged in to migrate data.');
      return;
    }

    console.log(`[Migration] Starting migration for user: ${user.uid}`);
    try {
      const historyCol = collection(this.firestore, `users/${user.uid}/history`);
      const snap = await getDocs(historyCol);
      console.log(`[Migration] Found ${snap.size} old words to migrate.`);
      
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const word = d.id;
        const docRef = doc(this.firestore, 'dictionary', word);
        
        if (data['result']) {
          await setDoc(docRef, {
            ...data['result'],
            timestamp: data['timestamp'] || serverTimestamp()
          }, { merge: true });
          count++;
          console.log(`[Migration] Migrated: ${word}`);
        }
      }
      console.log(`[Migration] Successfully migrated ${count} words.`);
      alert(`Đã chuyển đổi thành công ${count} từ cũ sang từ điển chung!`);
    } catch (err) {
      console.error('[Migration] Error during migration:', err);
      alert('Có lỗi xảy ra khi chuyển đổi. Vui lòng xem console.');
    }
  }
}
