import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import { PhraseProgressService } from './phrase-progress.service';
import { HubAuthService } from '../../auth/hub-auth.service';

describe('PhraseProgressService', () => {
  let service: PhraseProgressService;
  const hubAuth = jasmine.createSpyObj('HubAuthService', ['requestUserInfo']);
  let setDocSpy: jasmine.Spy;
  let getDocSpy: jasmine.Spy;
  let docSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve(null));
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: HubAuthService, useValue: hubAuth },
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

  it('recordSpeakResult: score >= 80 marks template, adds 10 points, increments streak once per day', async () => {
    await service.init();
    await service.recordSpeakResult('t1', ['c1'], 85);
    const p = service.progress()!;
    expect(p.masteredTemplates['t1'].bestSpeakScore).toBe(85);
    expect(p.totalPoints).toBe(10);
    expect(p.streak.current).toBe(1);
    expect(p.streak.lastDay).toBe(new Date().toISOString().slice(0, 10));
    await service.recordSpeakResult('t1', ['c1'], 90);
    expect(service.progress()!.streak.current).toBe(1); // same day, no double count
    expect(service.progress()!.masteredTemplates['t1'].bestSpeakScore).toBe(90);
  });
});
