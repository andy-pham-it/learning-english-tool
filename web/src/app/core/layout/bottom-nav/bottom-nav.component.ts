import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { UserProfileService, UserProfile } from '../../services/user-profile.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="fixed bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-slate-200 pb-safe z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
      
      <!-- XP / Rank Bar -->
      <div *ngIf="profile" class="flex items-center gap-3 px-4 pt-2 pb-1 border-b border-slate-100">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-[10px] font-bold text-indigo-600 shrink-0 tracking-wide uppercase">{{ profile.rank }}</span>
          <div class="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full transition-all duration-700"
                 [style.width.%]="xpProgress"></div>
          </div>
          <span class="text-[10px] text-slate-400 shrink-0 font-medium">{{ profile.xp }} XP</span>
        </div>
        <div class="flex items-center gap-1 text-orange-500 text-xs font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
          <span>🔥</span>
          <span>{{ profile.streak }}</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex justify-around items-center max-w-md mx-auto h-14 px-2">
        
        <a routerLink="/flashcards" routerLinkActive="text-indigo-600" 
           class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-indigo-500 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span class="text-[9px] font-bold tracking-wider uppercase">Vocabulary</span>
        </a>

        <a routerLink="/think-aloud" routerLinkActive="text-indigo-600" 
           class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-indigo-500 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span class="text-[9px] font-bold tracking-wider uppercase">Think</span>
        </a>

        <a routerLink="/dictionary" routerLinkActive="text-indigo-600" 
           class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-indigo-500 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          <span class="text-[9px] font-bold tracking-wider uppercase">Dict</span>
        </a>

        <a routerLink="/minigames" routerLinkActive="text-indigo-600" 
           class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-indigo-500 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span class="text-[9px] font-bold tracking-wider uppercase">Drills</span>
        </a>

        <button (click)="logout()"
           class="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-rose-500 transition-all cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span class="text-[9px] font-bold tracking-wider uppercase">Exit</span>
        </button>

      </div>
    </nav>
  `,
  styles: [`.pb-safe { padding-bottom: env(safe-area-inset-bottom); }`]
})
export class BottomNavComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  public profileService = inject(UserProfileService);

  profile: UserProfile | null = null;
  xpProgress = 0;

  readonly RANK_THRESHOLDS = [0, 100, 300, 700, 1500, 3000];

  ngOnInit() {
    this.profileService.loadOrCreateProfile();
    this.profileService.profile$.subscribe(p => {
      this.profile = p;
      if (p) {
        this.xpProgress = this.computeXpProgress(p.xp);
      }
    });
  }

  computeXpProgress(xp: number): number {
    const thresholds = this.RANK_THRESHOLDS;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) {
        const min = thresholds[i];
        const max = thresholds[i + 1] ?? min + 1000;
        return Math.min(100, Math.round(((xp - min) / (max - min)) * 100));
      }
    }
    return 0;
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
