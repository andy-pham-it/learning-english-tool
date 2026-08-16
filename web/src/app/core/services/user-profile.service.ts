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
  speakingSessions: number;
  streak: number;
  lastActiveDate: string; // ISO date string 'YYYY-MM-DD'
  lastSpeakDate: string; // ISO date string 'YYYY-MM-DD' of last speaking session with score >= 80
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

  /**
   * Instance-level indirection over `@angular/fire/firestore/lite`.
   * The lite module re-exports helpers as non-configurable getters, so
   * `spyOn(lite, ...)` fails in Karma/webpack. Storing them on the instance
   * lets unit tests substitute jasmine spies.
   */
  docFn: typeof doc;
  getDocFn: typeof getDoc;
  setDocFn: typeof setDoc;
  updateDocFn: typeof updateDoc;
  incrementFn: typeof increment;

  constructor() {
    this.docFn = doc;
    this.getDocFn = getDoc;
    this.setDocFn = setDoc;
    this.updateDocFn = updateDoc;
    this.incrementFn = increment;
  }

  async loadOrCreateProfile(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const ref = this.docFn(this.firestore, 'users', user.uid);
    const snap = await this.getDocFn(ref);

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
        speakingSessions: 0,
        streak: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        lastSpeakDate: '',
      };
      await this.setDocFn(ref, newProfile);
      this.profileSubject.next(newProfile);
    } else {
      this.profileSubject.next(snap.data() as UserProfile);
    }
  }

  async addXP(amount: number): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const ref = this.docFn(this.firestore, 'users', user.uid);
    await this.updateDocFn(ref, { xp: this.incrementFn(amount) });

    // Update local state
    const current = this.profileSubject.value;
    if (current) {
      const newXP = current.xp + amount;
      const newRank = getRankFromXP(newXP);
      const updated = { ...current, xp: newXP, rank: newRank };
      // Persist rank if it changed
      if (newRank !== current.rank) {
        await this.updateDocFn(ref, { rank: newRank });
      }
      this.profileSubject.next(updated);
    }
  }

  async recordActivity(type: 'flashcard' | 'game' | 'boss' | 'speaking'): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const ref = this.docFn(this.firestore, 'users', user.uid);
    const fieldMap: Record<string, string> = {
      flashcard: 'flashcardsStudied',
      game: 'gamesPlayed',
      boss: 'bossWins',
      speaking: 'speakingSessions',
    };

    const today = new Date().toISOString().split('T')[0];
    const current = this.profileSubject.value;

    // Check and update streak
    let streakUpdate = {};
    if (current) {
      const lastActive = current.lastActiveDate;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastActive === yesterday) {
        streakUpdate = { streak: this.incrementFn(1), lastActiveDate: today };
      } else if (lastActive !== today) {
        streakUpdate = { streak: 1, lastActiveDate: today };
      }
    }

    const speakingUpdate = type === 'speaking' ? { lastSpeakDate: today } : {};

    await this.updateDocFn(ref, {
      [fieldMap[type]]: this.incrementFn(1),
      ...streakUpdate,
      ...speakingUpdate,
    });

    // Refresh local state
    await this.loadOrCreateProfile();
  }

  getProfile(): UserProfile | null {
    return this.profileSubject.value;
  }
}
