import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import { Auth } from '@angular/fire/auth';
import { UserProfileService, UserProfile } from './user-profile.service';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let updateDocSpy: jasmine.Spy;
  let getDocSpy: jasmine.Spy;
  let setDocSpy: jasmine.Spy;
  let docSpy: jasmine.Spy;
  let incrementSpy: jasmine.Spy;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const baseProfile: UserProfile = {
    uid: 'u1',
    displayName: null,
    photoURL: null,
    xp: 0,
    rank: 'Intern',
    flashcardsStudied: 0,
    gamesPlayed: 0,
    bossWins: 0,
    speakingSessions: 0,
    streak: 0,
    lastActiveDate: yesterday,
    lastSpeakDate: '',
  };

  beforeEach(() => {
    const auth = { currentUser: { uid: 'u1' } } as any;
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: auth },
      ],
    });
    service = TestBed.inject(UserProfileService);
    docSpy = jasmine
      .createSpy('doc')
      .and.callFake((_fs: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id }));
    getDocSpy = jasmine
      .createSpy('getDoc')
      .and.returnValue(Promise.resolve({ exists: () => true, data: () => baseProfile } as any));
    setDocSpy = jasmine.createSpy('setDoc').and.returnValue(Promise.resolve());
    updateDocSpy = jasmine.createSpy('updateDoc').and.returnValue(Promise.resolve());
    incrementSpy = jasmine
      .createSpy('increment')
      .and.callFake((n: number) => ({ __type__: 'increment', value: n }));
    service.docFn = docSpy as any;
    service.getDocFn = getDocSpy as any;
    service.setDocFn = setDocSpy as any;
    service.updateDocFn = updateDocSpy as any;
    service.incrementFn = incrementSpy as any;
  });

  it('loads an existing profile into the subject', async () => {
    await service.loadOrCreateProfile();
    expect(service.getProfile()).toEqual(baseProfile);
  });

  it('creates a new profile with speaking fields when none exists', async () => {
    getDocSpy.and.returnValue(Promise.resolve({ exists: () => false } as any));
    await service.loadOrCreateProfile();
    expect(setDocSpy).toHaveBeenCalledWith(
      jasmine.anything(),
      jasmine.objectContaining({ speakingSessions: 0, lastSpeakDate: '' })
    );
  });

  it('recordActivity(speaking) increments speakingSessions and sets lastSpeakDate', async () => {
    await service.loadOrCreateProfile();
    await service.recordActivity('speaking');
    expect(updateDocSpy).toHaveBeenCalledWith(
      jasmine.anything(),
      jasmine.objectContaining({ speakingSessions: jasmine.anything(), lastSpeakDate: today })
    );
  });

  it('recordActivity(speaking) increments the common streak when active yesterday', async () => {
    await service.loadOrCreateProfile();
    await service.recordActivity('speaking');
    expect(updateDocSpy).toHaveBeenCalledWith(
      jasmine.anything(),
      jasmine.objectContaining({ streak: jasmine.anything(), lastActiveDate: today })
    );
  });

  it('recordActivity(speaking) resets the streak when not active today or yesterday', async () => {
    getDocSpy.and.returnValue(
      Promise.resolve({
        exists: () => true,
        data: () => ({ ...baseProfile, lastActiveDate: '2020-01-01' }),
      } as any)
    );
    await service.loadOrCreateProfile();
    await service.recordActivity('speaking');
    expect(updateDocSpy).toHaveBeenCalledWith(
      jasmine.anything(),
      jasmine.objectContaining({ streak: 1, lastActiveDate: today })
    );
  });

  it('recordActivity(speaking) does not set lastSpeakDate for non-speaking types', async () => {
    await service.loadOrCreateProfile();
    await service.recordActivity('flashcard');
    const call = updateDocSpy.calls.mostRecent().args[1];
    expect(call.lastSpeakDate).toBeUndefined();
  });
});
