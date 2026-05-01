import { Injectable } from '@angular/core';

export interface SrsProgress {
  id: string; // matches chunk_id
  repetition: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: number; // timestamp
}

@Injectable({ providedIn: 'root' })
export class SrsService {
  
  // Grade: 
  // 0: Khó nhớ hoàn toàn
  // 3: Nhớ khó khăn (Cần lặp lại sớm)
  // 4: Nhớ bình thường (Do dự)
  // 5: Rất dễ nhớ
  calculateNextReview(progress: SrsProgress | null, chunkId: string, grade: number): SrsProgress {
    let rep = progress ? progress.repetition : 0;
    let ease = progress ? progress.easeFactor : 2.5;
    let interval = progress ? progress.interval : 0;

    if (grade >= 3) {
      if (rep === 0) {
        interval = 1;
      } else if (rep === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ease);
      }
      rep++;
    } else {
      rep = 0;
      interval = 1;
    }

    ease = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (ease < 1.3) ease = 1.3;

    // Calculate next review in MS (Day to MS)
    const nextReviewDate = Date.now() + (interval * 24 * 60 * 60 * 1000);

    return {
      id: chunkId,
      repetition: rep,
      interval,
      easeFactor: ease,
      nextReviewDate
    };
  }
}
