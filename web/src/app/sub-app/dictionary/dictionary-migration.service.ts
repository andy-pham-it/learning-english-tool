import { Injectable } from '@angular/core';
import { getApps } from 'firebase/app';
import { getFirestore, collectionGroup, getDocs, doc, setDoc, query, Timestamp } from 'firebase/firestore';
import { VocabItem } from './models';

@Injectable({ providedIn: 'root' })
export class DictionaryMigrationService {
  async migrateToShared(): Promise<{ migrated: number; skipped: number }> {
    const firebaseApp = getApps()[0];
    if (!firebaseApp) throw new Error('Firebase not initialized');
    const db = getFirestore(firebaseApp);

    const q = query(collectionGroup(db, 'vocabulary'));
    const snap = await getDocs(q);

    const merged: Record<string, VocabItem> = {};
    let skipped = 0;

    snap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const word: string = (data['word'] as string) ?? d.id;
      const lowerWord = word.toLowerCase();

      if (!merged[lowerWord]) {
        const savedAtVal = data['savedAt'];
        let savedAt: number;
        if (savedAtVal instanceof Timestamp) {
          savedAt = savedAtVal.toMillis();
        } else {
          savedAt = (savedAtVal as number) ?? Date.now();
        }

        merged[lowerWord] = {
          note: (data['note'] as string) ?? '',
          savedAt,
        };
      } else {
        skipped++;
      }
    });

    const ref = doc(db, 'sub_app_dictionary', 'data');
    await setDoc(ref, { vocabulary: merged });

    return { migrated: Object.keys(merged).length, skipped };
  }
}
