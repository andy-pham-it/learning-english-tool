import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import { PhraseProgressService } from './phrase-progress.service';
import { HubAuthService } from '../../auth/hub-auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { PhraseChunk } from '../models/phrase.model';
import { startOfDay } from './sm2.util';

describe('PhraseProgressService', () => {
  let service: PhraseProgressService;
  const hubAuth = jasmine.createSpyObj('HubAuthService', ['requestUserInfo']);
  const userProfile = jasmine.createSpyObj('UserProfileService', ['addXP', 'recordActivity']);
  let setDocSpy: jasmine.Spy;
  let getDocSpy: jasmine.Spy;
  let docSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve(null));
    userProfile.addXP.and.returnValue(Promise.resolve());
    userProfile.addXP.calls.reset();
    userProfile.recordActivity.and.returnValue(Promise.resolve());
    userProfile.recordActivity.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: HubAuthService, useValue: hubAuth },
        { provide: UserProfileService, useValue: userProfile },
      ],
    });
    service = TestBed.inject(PhraseProgressService);
    // spyOn(lite, 'setDoc') is not viable here: @angular/fire/firestore/lite
    // re-exports the helpers as non-configurable getters, so jasmine throws
    // "setDoc is not declared writable or has no setter". Use the
    // instance-level indirection that PhraseContentService established.
    // `doc` is also stubbed because the real one throws outside AngularFire.
    docSpy = jasmine
      .createSpy('doc')
      .and.callFake((_fs: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id }));
    setDocSpy = jasmine.createSpy('setDoc').and.returnValue(Promise.resolve());
    getDocSpy = jasmine
      .createSpy('getDoc')
      .and.returnValue(Promise.resolve({ exists: () => false } as any));
    service.docFn = docSpy as any;
    service.setDocFn = setDocSpy as any;
    service.getDocFn = getDocSpy as any;
  });

  it('falls back to localStorage when Hub auth times out (null user)', async () => {
    await service.init();
    expect(service.authed()).toBeFalse();
    await service.markChunkLearned('c1');
    expect(JSON.parse(localStorage.getItem('phrase_lab_progress')!).masteredChunks.c1.status).toBe('learning');
    expect(setDocSpy).not.toHaveBeenCalled();
  });

  it('writes to Firestore doc phrase_progress/{uid} when authenticated', async () => {
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve({ id: 'u1', email: null, name: null, image: null }));
    await service.init();
    expect(service.authed()).toBeTrue();
    await service.markChunkLearned('c1', 90);
    expect(setDocSpy).toHaveBeenCalled();
    const args = setDocSpy.calls.mostRecent().args;
    expect(args[1].uid).toBe('u1');
    expect(args[1].masteredChunks.c1.speakScore).toBe(90);
  });

  it('recordSpeakResult: score >= 80 marks template and adds 10 points', async () => {
    await service.init();
    await service.recordSpeakResult('t1', ['c1'], 85);
    const p = service.progress()!;
    expect(p.masteredTemplates['t1'].bestSpeakScore).toBe(85);
    expect(p.totalPoints).toBe(10);
    await service.recordSpeakResult('t1', ['c1'], 90);
    expect(service.progress()!.masteredTemplates['t1'].bestSpeakScore).toBe(90);
  });

  it('recordSpeakResult: score >= 80 calls UserProfileService.recordActivity(speaking) when authed', async () => {
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve({ id: 'u1', email: null, name: null, image: null }));
    await service.init();
    await service.recordSpeakResult('t1', ['c1'], 90);
    expect(userProfile.recordActivity).toHaveBeenCalledWith('speaking');
  });

  it('recordSpeakResult: score >= 80 calls UserProfileService.addXP(10) when authed', async () => {
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve({ id: 'u1', email: null, name: null, image: null }));
    await service.init();
    await service.recordSpeakResult('t1', ['c1'], 90);
    expect(userProfile.addXP).toHaveBeenCalledWith(10);
  });

  it('recordSpeakResult: low score does not award XP nor points', async () => {
    await service.init();
    await service.recordSpeakResult('t1', ['c1'], 50);
    expect(service.progress()!.totalPoints).toBe(0);
    expect(userProfile.addXP).not.toHaveBeenCalled();
    expect(userProfile.recordActivity).not.toHaveBeenCalled();
    expect(service.progress()!.masteredChunks['c1'].status).toBe('learning');
  });

  it('getDueChunks returns only chunk ids with due <= today', async () => {
    await service.init();
    const today = startOfDay(Date.now());
    service.progress.set({
      ...service.progress()!,
      reviews: {
        a: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: today },
        b: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: today + 86_400_000 },
      },
    });
    expect(service.getDueChunks(['a', 'b', 'c'])).toEqual(['a']);
  });

  it('reviewChunk: good schedules interval 1 and awards +5 points', async () => {
    await service.init();
    await service.reviewChunk('c1', 'good');
    const p = service.progress()!;
    expect(p.reviews['c1'].interval).toBe(1);
    expect(p.reviews['c1'].reps).toBe(1);
    expect(p.reviews['c1'].lapses).toBe(0);
    expect(p.totalPoints).toBe(5);
    expect(p.masteredChunks['c1'].status).toBe('mastered');
  });

  it('reviewChunk: again resets interval, increments lapses, un-masters, awards 0 points', async () => {
    await service.init();
    await service.reviewChunk('c1', 'good');
    await service.reviewChunk('c1', 'again');
    const p = service.progress()!;
    expect(p.reviews['c1'].interval).toBe(0);
    expect(p.reviews['c1'].reps).toBe(0);
    expect(p.reviews['c1'].lapses).toBe(1);
    expect(p.reviews['c1'].ease).toBe(2.3);
    expect(p.totalPoints).toBe(5); // points from the good review only
    expect(p.masteredChunks['c1'].status).toBe('learning');
  });

  it('reviewChunk: hard awards +2 points, easy +5, and calls addXP when authed', async () => {
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve({ id: 'u1', email: null, name: null, image: null }));
    await service.init();
    await service.reviewChunk('c1', 'hard');
    await service.reviewChunk('c2', 'easy');
    expect(service.progress()!.totalPoints).toBe(7);
    expect(userProfile.addXP).toHaveBeenCalledWith(2);
    expect(userProfile.addXP).toHaveBeenCalledWith(5);
  });

  it('getCoverage counts learned per context (reviewed or mastered)', async () => {
    await service.init();
    service.progress.set({
      ...service.progress()!,
      reviews: { a1: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: Date.now() } },
      masteredChunks: { b1: { status: 'mastered', speakScore: 90, lastPracticed: Date.now() } },
    });
    const chunks = [
      { id: 'a1', context: 'meeting' } as PhraseChunk,
      { id: 'a2', context: 'meeting' } as PhraseChunk,
      { id: 'b1', context: 'email' } as PhraseChunk,
      { id: 'b2', context: 'email' } as PhraseChunk,
      { id: 'c1', context: 'meeting' } as PhraseChunk,
    ];
    const cov = service.getCoverage(chunks);
    expect(cov['meeting']).toEqual({ learned: 1, total: 3 });
    expect(cov['email']).toEqual({ learned: 1, total: 2 });
  });

  it('mergeLocal: local later lastPracticed wins, totalPoints MAX, localStorage cleared, cloud doc written', async () => {
    const cloud = {
      uid: 'u1',
      masteredChunks: { c1: { status: 'learning', speakScore: 0, lastPracticed: 1000 } },
      masteredTemplates: { t1: { bestSpeakScore: 50, attempts: 1 } },
      reviews: {},
      streak: { current: 0, lastDay: '' },
      totalPoints: 50,
    };
    const local = {
      uid: 'local',
      masteredChunks: { c1: { status: 'mastered', speakScore: 95, lastPracticed: 5000 } },
      masteredTemplates: { t1: { bestSpeakScore: 80, attempts: 2 } },
      reviews: { c1: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: 9999 } },
      streak: { current: 3, lastDay: '2026-08-07' },
      totalPoints: 100,
    };
    localStorage.setItem('phrase_lab_progress', JSON.stringify(local));
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve({ id: 'u1', email: null, name: null, image: null }));
    getDocSpy.and.returnValue(Promise.resolve({ exists: () => true, data: () => cloud } as any));
    await service.init();
    const p = service.progress()!;
    expect(p.masteredChunks['c1'].lastPracticed).toBe(5000);
    expect(p.masteredChunks['c1'].status).toBe('mastered');
    expect(p.masteredTemplates['t1'].bestSpeakScore).toBe(80);
    expect(p.masteredTemplates['t1'].attempts).toBe(2);
    expect(p.reviews['c1'].due).toBe(9999);
    expect(p.streak.current).toBe(3);
    expect(p.totalPoints).toBe(100); // MAX, not sum
    expect(localStorage.getItem('phrase_lab_progress')).toBeNull();
    expect(setDocSpy).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({ totalPoints: 100 }));
  });
});
