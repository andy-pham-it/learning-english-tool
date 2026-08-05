import { Injectable, Signal, signal } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore/lite';
import { HubAuthService } from '../../auth/hub-auth.service';
import { PhraseProgress } from '../models/phrase.model';

const LOCAL_KEY = 'phrase_lab_progress';

@Injectable({ providedIn: 'root' })
export class PhraseProgressService {
  readonly authed = signal(false);
  readonly uid = signal<string | null>(null);
  readonly progress = signal<PhraseProgress | null>(null);

  /**
   * Instance-level indirection over `@angular/fire/firestore/lite`.
   *
   * The lite module re-exports `doc`, `getDoc`, and `setDoc` as
   * non-configurable getters, so `spyOn(lite, ...)` fails in the
   * Karma/webpack build (verified by PhraseContentService). Storing the
   * functions on the instance lets unit tests substitute them with
   * jasmine spies.
   */
  docFn: typeof doc;
  getDocFn: typeof getDoc;
  setDocFn: typeof setDoc;

  private hubUserId: string | null = null;

  constructor(private firestore: Firestore, private hubAuth: HubAuthService) {
    this.docFn = doc;
    this.getDocFn = getDoc;
    this.setDocFn = setDoc;
  }

  async init(): Promise<void> {
    const user = await this.hubAuth.requestUserInfo();
    this.hubUserId = user?.id ?? null;
    if (this.hubUserId) {
      this.authed.set(true);
      this.uid.set(this.hubUserId);
    }
    this.progress.set(await this.read());
  }

  private emptyProgress(): PhraseProgress {
    return {
      uid: this.hubUserId ?? 'local',
      masteredChunks: {},
      masteredTemplates: {},
      streak: { current: 0, lastDay: '' },
      totalPoints: 0,
    };
  }

  private async read(): Promise<PhraseProgress> {
    if (this.hubUserId) {
      const snap = await this.getDocFn(this.docFn(this.firestore, 'phrase_progress', this.hubUserId));
      if (snap.exists()) return snap.data() as PhraseProgress;
      const fresh = this.emptyProgress();
      await this.write(fresh);
      return fresh;
    }
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as PhraseProgress;
      } catch {
        /* corrupted → fresh */
      }
    }
    return this.emptyProgress();
  }

  private async write(p: PhraseProgress): Promise<void> {
    if (this.hubUserId) {
      await this.setDocFn(this.docFn(this.firestore, 'phrase_progress', this.hubUserId), p);
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
    }
  }

  async markChunkLearned(chunkId: string, speakScore = 0): Promise<void> {
    const p = this.progress() ?? this.emptyProgress();
    const existing = p.masteredChunks[chunkId];
    p.masteredChunks[chunkId] = {
      status: 'learning',
      speakScore: Math.max(existing?.speakScore ?? 0, speakScore),
      lastPracticed: Date.now(),
    };
    this.progress.set({ ...p });
    await this.write(p);
  }

  async recordSpeakResult(templateId: string, chunkIds: string[], score: number): Promise<void> {
    const p = this.progress() ?? this.emptyProgress();
    const t = p.masteredTemplates[templateId] ?? { bestSpeakScore: 0, attempts: 0 };
    t.attempts++;
    t.bestSpeakScore = Math.max(t.bestSpeakScore, score);
    p.masteredTemplates[templateId] = t;
    for (const cid of chunkIds) {
      const existing = p.masteredChunks[cid];
      p.masteredChunks[cid] = {
        status: score >= 80 ? 'mastered' : (existing?.status ?? 'learning'),
        speakScore: Math.max(existing?.speakScore ?? 0, score),
        lastPracticed: Date.now(),
      };
    }
    if (score >= 80) {
      p.totalPoints += 10;
      const today = new Date().toISOString().slice(0, 10);
      if (p.streak.lastDay !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        p.streak.current = p.streak.lastDay === yesterday.toISOString().slice(0, 10) ? p.streak.current + 1 : 1;
        p.streak.lastDay = today;
      }
    }
    this.progress.set({ ...p });
    await this.write(p);
  }
}
