import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StorageService } from '../../../../core/services/storage.service';
import { SpeechService } from '../../../../core/services/speech.service';
import { FlashcardData } from '../../../flashcards/models/flashcard.model';
import { UserProfileService } from '../../../../core/services/user-profile.service';

@Component({
  selector: 'app-speaking-drill',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full min-h-screen bg-[#0B1121] flex flex-col items-center justify-center p-4">
      
      <!-- Top HUD -->
      <div class="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10">
        <button (click)="goBack()" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div class="text-white font-bold text-xl drop-shadow-md">Streak: <span class="text-emerald-400">{{streak}}</span></div>
      </div>

      <!-- Game Area -->
      <div class="w-full max-w-md flex flex-col items-center" *ngIf="targetCard && !isGameOver">
        
        <div class="w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center mb-12 relative overflow-hidden backdrop-blur-md">
           <!-- Subtle pulse animation if listening -->
           <div class="absolute inset-0 bg-emerald-500/10 animate-pulse" *ngIf="isListening"></div>
           
           <h2 class="text-sm font-semibold tracking-widest text-indigo-300 uppercase mb-4 relative z-10">Say this phrase</h2>
           <h1 class="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2 relative z-10">{{ targetCard.word }}</h1>
           <p class="text-xl text-gray-400 italic relative z-10">/{{ targetCard.phonetic }}/</p>
           
           <div class="mt-8 pt-6 border-t border-white/10 relative z-10">
             <p class="text-sm text-gray-300">{{ targetCard.meaning }}</p>
           </div>
        </div>

        <!-- Recorded Result -->
        <div class="h-20 w-full mb-8 text-center flex flex-col items-center justify-center">
            <h3 *ngIf="recordedText && !isShowingFeedback" class="text-2xl font-medium text-white tracking-wide">"{{ recordedText }}"</h3>
            
            <div *ngIf="isShowingFeedback" class="text-3xl font-black tracking-widest uppercase bounce-animation" [ngClass]="isFeedbackSuccess ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]'">
               {{ isFeedbackSuccess ? 'PERFECT!' : 'NOT QUITE' }}
            </div>
            
            <p *ngIf="!recordedText && !isShowingFeedback && !isListening" class="text-gray-500 font-medium">Tap the microphone and start speaking</p>
            <p *ngIf="isListening" class="text-emerald-400 font-medium animate-pulse">Listening...</p>
        </div>

        <!-- Mic Button -->
        <button 
           (pointerdown)="startRecording()" 
           (contextmenu)="$event.preventDefault()"
           [class.bg-emerald-500]="!isListening"
           [class.bg-rose-500]="isListening"
           [class.scale-110]="isListening"
           [disabled]="isShowingFeedback"
           class="w-24 h-24 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center transition-all duration-300 ease-out z-10 select-none cursor-pointer">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
           </svg>
        </button>
        <p class="mt-4 text-xs font-medium tracking-widest text-gray-500 uppercase">Tap once to speak</p>

      </div>

      <!-- Game Over -->
      <div *ngIf="isGameOver" class="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 backdrop-blur-sm p-6 text-center">
         <div class="w-24 h-24 mb-6 text-6xl shadow-[0_0_50px_rgba(16,185,129,0.5)] bg-emerald-500/20 rounded-3xl flex items-center justify-center border border-emerald-500/30">🔥</div>
         <h2 class="text-4xl font-black text-white mb-2 uppercase tracking-wide">Drill Complete</h2>
         <p class="text-xl text-emerald-300 font-medium tracking-widest uppercase mb-10">Longest Streak: {{maxStreak}}</p>
         
         <div class="w-full max-w-xs space-y-4">
           <button (click)="startGame()" class="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition-all active:scale-95">Play Again</button>
           <button (click)="goBack()" class="w-full py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all active:scale-95">Main Menu</button>
         </div>
      </div>
      
    </div>
  `,
  styles: [`
    .bounce-animation { animation: text-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
    @keyframes text-pop {
      0% { transform: translateY(20px) scale(0.8); opacity: 0; }
      50% { transform: translateY(0) scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
  `]
})
export class SpeakingDrillComponent implements OnInit {
  private router = inject(Router);
  private storage = inject(StorageService);
  private speech = inject(SpeechService);
  private profileService = inject(UserProfileService);

  deck: FlashcardData[] = [];
  queue: FlashcardData[] = [];
  targetCard: FlashcardData | null = null;
  
  streak = 0;
  maxStreak = 0;
  isGameOver = false;
  
  isListening = false;
  recordedText = '';
  isShowingFeedback = false;
  isFeedbackSuccess = false;

  private isSupported = false;

  async ngOnInit() {
    this.isSupported = this.speech.isRecognitionSupported();
    if (!this.isSupported) {
      alert("Oops! Your browser does not support the Web Speech API. Please use Google Chrome or Microsoft Edge to play this game.");
      this.goBack();
      return;
    }

    this.deck = await this.storage.getItem<FlashcardData[]>('flashcard_deck_it_b2') || [];
    if (this.deck.length > 0) {
      this.startGame();
    } else {
       alert("No vocabulary found. Review some flashcards first.");
       this.goBack();
    }
  }

  goBack() {
    this.router.navigate(['/minigames']);
  }

  startGame() {
    this.streak = 0;
    this.maxStreak = 0;
    this.isGameOver = false;
    this.queue = [...this.deck].sort(() => 0.5 - Math.random());
    this.nextRound();
  }

  nextRound() {
    if (this.queue.length === 0) {
      this.isGameOver = true;
      return;
    }
    this.targetCard = this.queue.shift() || null;
    this.recordedText = '';
    this.isShowingFeedback = false;
  }

  async startRecording() {
    if (this.isListening || this.isShowingFeedback) return;
    
    this.isListening = true;
    this.recordedText = '';
    
    try {
      const transcript = await this.speech.startListening('en-US');
      this.isListening = false;
      this.processResult(transcript);
    } catch (e) {
      this.isListening = false;
      console.warn("Speech Recognition stopped or errored", e);
    }
  }

  processResult(transcript: string) {
    this.recordedText = transcript;
    
    if (!this.targetCard) return;

    // VERY aggressive normalization: remove punctuation, lowercase, extract only alphanumeric
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const userNorm = normalize(transcript);
    const targetNorm = normalize(this.targetCard.word);

    // Give some leeway
    const isSuccess = userNorm.includes(targetNorm) || targetNorm.includes(userNorm);
    
    if (isSuccess) {
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      this.profileService.addXP(8);
      this.profileService.recordActivity('game');
    } else {
      this.streak = 0;
    }

    this.isShowingFeedback = true;
    this.isFeedbackSuccess = isSuccess;

    setTimeout(() => {
      this.nextRound();
    }, 1500);
  }
}
