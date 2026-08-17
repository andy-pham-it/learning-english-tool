import { Injectable, Optional, Signal, signal } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore/lite';
import { HubAuthService } from '../../auth/hub-auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { PhraseChunk, PhraseProgress, ReviewRating } from '../models/phrase.model';
import { initialReview, nextState, startOfDay } from './sm2.util';

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

  constructor(
    private firestore: Firestore,
    private hubAuth: HubAuthService,
    @Optional() private userProfile: UserProfileService | null,
  ) {
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
      reviews: {},
      streak: { current: 0, lastDay: '' },
      totalPoints: 0,
    };
  }

  private normalize(p: PhraseProgress): PhraseProgress {
    if (!p.reviews) p.reviews = {};
    return p;
  }

  private async read(): Promise<PhraseProgress> {
    if (this.hubUserId) {
      const snap = await this.getDocFn(this.docFn(this.firestore, 'phrase_progress', this.hubUserId));
      let p: PhraseProgress;
      if (snap.exists()) {
        p = this.normalize(snap.data() as PhraseProgress);
      } else {
        p = this.emptyProgress();
        await this.write(p);
      }
      return this.mergeLocal(p);
    }
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        return this.normalize(JSON.parse(raw) as PhraseProgress);
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

  private async mergeLocal(cloud: PhraseProgress): Promise<PhraseProgress> {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return cloud;
    let local: PhraseProgress;
    try {
      local = this.normalize(JSON.parse(raw) as PhraseProgress);
    } catch {
      localStorage.removeItem(LOCAL_KEY);
      return cloud;
    }
    const merged: PhraseProgress = {
      uid: cloud.uid,
      masteredChunks: { ...cloud.masteredChunks },
      masteredTemplates: { ...cloud.masteredTemplates },
      reviews: { ...cloud.reviews },
      streak: { ...cloud.streak },
      totalPoints: Math.max(cloud.totalPoints, local.totalPoints),
    };
    for (const [id, lc] of Object.entries(local.masteredChunks)) {
      const cc = merged.masteredChunks[id];
      if (!cc || lc.lastPracticed > cc.lastPracticed) merged.masteredChunks[id] = lc;
    }
    for (const [id, lr] of Object.entries(local.reviews)) {
      const cr = merged.reviews[id];
      if (!cr || lr.due < cr.due) merged.reviews[id] = lr;
    }
    for (const [id, lt] of Object.entries(local.masteredTemplates)) {
      const ct = merged.masteredTemplates[id];
      merged.masteredTemplates[id] = {
        bestSpeakScore: Math.max(ct?.bestSpeakScore ?? 0, lt.bestSpeakScore),
        attempts: Math.max(ct?.attempts ?? 0, lt.attempts),
      };
    }
    if (local.streak.current > merged.streak.current) {
      merged.streak = { ...local.streak };
    }
    localStorage.removeItem(LOCAL_KEY);
    await this.write(merged);
    return merged;
  }

  async markChunkLearned(chunkId: string): Promise<void> {
    const p = this.progress() ?? this.emptyProgress();
    const existing = p.masteredChunks[chunkId];
    p.masteredChunks[chunkId] = {
      status: 'learning',
      speakScore: existing?.speakScore ?? 0,
      lastPracticed: Date.now(),
    };
    if (!p.reviews[chunkId]) {
      p.reviews[chunkId] = initialReview();
    }
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
      this.awardXp(10);
      this.userProfile?.recordActivity('speaking');
      for (const cid of chunkIds) {
        p.reviews[cid] = nextState(p.reviews[cid] ?? initialReview(), 'good');
      }
    }
    this.progress.set({ ...p });
    await this.write(p);
  }

  getDueChunks(allChunkIds: string[]): string[] {
    const p = this.progress();
    if (!p) return [];
    const today = startOfDay(Date.now());
    return allChunkIds.filter((id) => {
      const r = p.reviews[id];
      return !!r && r.due <= today;
    });
  }

  async reviewChunk(chunkId: string, rating: ReviewRating): Promise<void> {
    const p = this.progress() ?? this.emptyProgress();
    const prev = p.reviews[chunkId] ?? initialReview();
    p.reviews[chunkId] = nextState(prev, rating);
    const chunk = p.masteredChunks[chunkId];
    const pts = rating === 'good' || rating === 'easy' ? 5 : rating === 'hard' ? 2 : 0;
    if (pts > 0) {
      p.totalPoints += pts;
      this.awardXp(pts);
    }
    p.masteredChunks[chunkId] = {
      status: rating === 'again' ? 'learning' : (chunk?.status ?? 'learning'),
      speakScore: chunk?.speakScore ?? 0,
      lastPracticed: Date.now(),
    };
    this.progress.set({ ...p });
    await this.write(p);
  }

  getCoverage(chunks: PhraseChunk[]): Record<string, { learned: number; total: number }> {
    const p = this.progress();
    const out: Record<string, { learned: number; total: number }> = {};
    for (const c of chunks) {
      const entry = out[c.context] ?? { learned: 0, total: 0 };
      entry.total++;
      if (p && (p.reviews[c.id] || p.masteredChunks[c.id]?.status === 'mastered')) entry.learned++;
      out[c.context] = entry;
    }
    return out;
  }

  private awardXp(amount: number): void {
    if (!this.hubUserId || !this.userProfile) return;
    this.userProfile.addXP(amount).catch(() => undefined);
  }
}
