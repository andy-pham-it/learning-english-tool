import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BottomNavComponent } from './bottom-nav.component';
import { AuthService } from '../../auth/auth.service';
import { UserProfileService, UserProfile } from '../../services/user-profile.service';
import { BehaviorSubject } from 'rxjs';

describe('BottomNavComponent', () => {
  let fixture: ComponentFixture<BottomNavComponent>;
  let profileSubject: BehaviorSubject<UserProfile | null>;

  const today = new Date().toISOString().split('T')[0];

  const baseProfile: UserProfile = {
    uid: 'u1',
    displayName: null,
    photoURL: null,
    xp: 120,
    rank: 'Junior Dev',
    flashcardsStudied: 0,
    gamesPlayed: 0,
    bossWins: 0,
    speakingSessions: 0,
    streak: 3,
    lastActiveDate: today,
    lastSpeakDate: '',
  };

  beforeEach(async () => {
    profileSubject = new BehaviorSubject<UserProfile | null>(null);
    const profileService = jasmine.createSpyObj('UserProfileService', ['loadOrCreateProfile']);
    Object.defineProperty(profileService, 'profile$', { get: () => profileSubject.asObservable() });

    await TestBed.configureTestingModule({
      imports: [BottomNavComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: { logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()) } },
        { provide: UserProfileService, useValue: profileService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
  });

  it('shows speaking goal as met when lastSpeakDate is today', () => {
    profileSubject.next({ ...baseProfile, lastSpeakDate: today });
    fixture.detectChanges();
    expect(fixture.componentInstance.speakingGoalMet).toBeTrue();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nói: Đã đạt ✓');
  });

  it('shows speaking goal as not met when lastSpeakDate is empty', () => {
    profileSubject.next(baseProfile);
    fixture.detectChanges();
    expect(fixture.componentInstance.speakingGoalMet).toBeFalse();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nói: Chưa đạt');
  });
});
