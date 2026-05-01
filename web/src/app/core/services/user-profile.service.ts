import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, increment } from '@angular/fire/firestore/lite';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  xp: number;
  rank: string;
  flashcardsStudied: number;
  gamesPlayed: number;
  bossWins: number;
  streak: number;
  lastActiveDate: string; // ISO date string 'YYYY-MM-DD'
}

const RANKS = [
  { name: 'Intern',         minXP: 0    },
  { name: 'Junior Dev',     minXP: 100  },
  { name: 'Mid-Level Dev',  minXP: 300  },
  { name: 'Senior Dev',     minXP: 700  },
  { name: 'Tech Lead',      minXP: 1500 },
  { name: 'CTO',            minXP: 3000 },
];

function getRankFromXP(xp: number): string {
  let rank = RANKS[0].name;
  for (const r of RANKS) {
    if (xp >= r.minXP) rank = r.name;
  }
  return rank;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  async loadOrCreateProfile(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const ref = doc(this.firestore, 'users', user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        xp: 0,
        rank: 'Intern',
        flashcardsStudied: 0,
        gamesPlayed: 0,
        bossWins: 0,
        streak: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
      };
      await setDoc(ref, newProfile);
      this.profileSubject.next(newProfile);
    } else {
      this.profileSubject.next(snap.data() as UserProfile);
    }
  }

  async addXP(amount: number): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const ref = doc(this.firestore, 'users', user.uid);
    await updateDoc(ref, { xp: increment(amount) });

    // Update local state
    const current = this.profileSubject.value;
    if (current) {
      const newXP = current.xp + amount;
      const newRank = getRankFromXP(newXP);
      const updated = { ...current, xp: newXP, rank: newRank };
      // Persist rank if it changed
      if (newRank !== current.rank) {
        await updateDoc(ref, { rank: newRank });
      }
      this.profileSubject.next(updated);
    }
  }

  async recordActivity(type: 'flashcard' | 'game' | 'boss'): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const ref = doc(this.firestore, 'users', user.uid);
    const fieldMap: Record<string, string> = {
      flashcard: 'flashcardsStudied',
      game: 'gamesPlayed',
      boss: 'bossWins',
    };

    const today = new Date().toISOString().split('T')[0];
    const current = this.profileSubject.value;

    // Check and update streak
    let streakUpdate = {};
    if (current) {
      const lastActive = current.lastActiveDate;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastActive === yesterday) {
        streakUpdate = { streak: increment(1), lastActiveDate: today };
      } else if (lastActive !== today) {
        streakUpdate = { streak: 1, lastActiveDate: today };
      }
    }

    await updateDoc(ref, {
      [fieldMap[type]]: increment(1),
      ...streakUpdate
    });

    // Refresh local state
    await this.loadOrCreateProfile();
  }

  getProfile(): UserProfile | null {
    return this.profileSubject.value;
  }
}
