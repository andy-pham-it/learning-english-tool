import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StorageService } from '../../../../core/services/storage.service';
import { SpeechService } from '../../../../core/services/speech.service';
import { FlashcardData } from '../../../flashcards/models/flashcard.model';
import { UserProfileService } from '../../../../core/services/user-profile.service';

interface FallingBlock {
  id: string;
  wordId: string;
  text: string;
  top: number;
  left: number;
  speed: number;
}

@Component({
  selector: 'app-falling-words',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-screen bg-[#0B1121] overflow-hidden">
      <!-- Top HUD -->
      <div class="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button (click)="goBack()" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div class="text-white font-bold text-xl drop-shadow-md">Score: <span class="text-indigo-400">{{score}}</span></div>
        <button (click)="replayAudio()" class="w-10 h-10 rounded-full border border-indigo-500/50 hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]">
          🎤
        </button>
      </div>

      <!-- Game Area -->
      <div class="relative w-full h-full max-w-md mx-auto" *ngIf="isPlaying">
        
        <!-- Feedback Overlay -->
        <div *ngIf="isShowingFeedback" class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
           <div class="text-6xl font-black bounce-animation tracking-widest" 
                [ngClass]="isFeedbackSuccess ? 'text-emerald-400 drop-shadow-[0_0_30px_rgba(16,185,129,0.9)]' : 'text-rose-500 drop-shadow-[0_0_30px_rgba(244,63,94,0.9)]'">
             {{ isFeedbackSuccess ? 'GREAT!' : 'MISS!' }}
           </div>
        </div>

        <!-- Render Blocks directly mapped to top/left values computed in the loop -->
        <div *ngFor="let block of activeBlocks; trackBy: trackByBlockId" 
             class="absolute px-5 py-4 rounded-xl cursor-pointer select-none border shadow-2xl backdrop-blur-md font-medium transition-transform active:scale-95"
             [ngStyle]="{
               'top.px': block.top, 
               'left.%': block.left, 
               'transform': 'translateX(-50%)',
               'background': getBlockColor(block.id),
               'border-color': 'rgba(255,255,255,0.2)',
               'color': 'white',
               'width': '65%',
               'text-align': 'center'
             }"
             (click)="onBlockClick(block)">
          {{block.text}}
        </div>
      </div>

      <!-- Game Over -->
      <div *ngIf="!isPlaying && isGameOver" class="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 backdrop-blur-sm p-6 text-center">
         <div class="w-24 h-24 mb-6 text-6xl shadow-[0_0_50px_rgba(79,70,229,0.5)] bg-indigo-500/20 rounded-3xl flex items-center justify-center border border-indigo-500/30">🏆</div>
         <h2 class="text-4xl font-black text-white mb-2 uppercase tracking-wide">Game Over</h2>
         <p class="text-xl text-indigo-300 font-medium tracking-widest uppercase mb-10">Score: {{score}}</p>
         
         <div class="w-full max-w-xs space-y-4">
           <button (click)="startGame()" class="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold shadow-[0_4px_20px_rgba(79,70,229,0.4)] transition-all active:scale-95">Play Again</button>
           <button (click)="goBack()" class="w-full py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all active:scale-95">Main Menu</button>
         </div>
      </div>
      
    </div>
  `,
  styles: [`
    .bounce-animation {
      animation: feedback-bounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }
    @keyframes feedback-bounce {
      0% { transform: scale(0); opacity: 0; }
      20% { transform: scale(1.1); opacity: 1; }
      80% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0.5); opacity: 0; }
    }
  `]
})
export class FallingWordsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private storage = inject(StorageService);
  private speech = inject(SpeechService);
  private profileService = inject(UserProfileService);

  deck: FlashcardData[] = [];
  targetCard: FlashcardData | null = null;
  activeBlocks: FallingBlock[] = [];
  
  score = 0;
  isPlaying = false;
  isGameOver = false;
  isShowingFeedback = false;
  isFeedbackSuccess = false;

  private gameLoopId: any;
  private lastTime = 0;
  private currentSpeedMultiplier = 0.15; // pixels per ms. Increases naturally

  async ngOnInit() {
    this.deck = await this.storage.getItem<FlashcardData[]>('flashcard_deck_it_b2') || [];
    if (this.deck.length >= 4) {
      this.startGame();
    } else {
      alert("Not enough vocabulary words to play. Please review some Flashcards first.");
      this.goBack();
    }
  }

  ngOnDestroy() {
    this.stopGameLoop();
  }

  goBack() {
    this.router.navigate(['/minigames']);
  }

  startGame() {
    this.score = 0;
    this.isGameOver = false;
    this.currentSpeedMultiplier = 0.15;
    this.startRound();
  }

  startRound() {
    if (this.isGameOver) return;

    this.activeBlocks = [];
    // Increase speed dynamically as score goes up
    this.currentSpeedMultiplier = 0.15 + (this.score * 0.001);

    const shuffled = [...this.deck].sort(() => 0.5 - Math.random());
    this.targetCard = shuffled[0];
    
    // Total 4 blocks
    const roundOptions = shuffled.slice(0, 4).sort(() => 0.5 - Math.random());
    const leftPositions = [50, 50, 50, 50]; 
    
    roundOptions.forEach((card, i) => {
      this.activeBlocks.push({
        id: Math.random().toString(),
        wordId: card.id,
        text: card.meaning,
        top: -100 - (i * 200) - (Math.random() * 100), // Drop them one by one staggered
        left: leftPositions[i] + (Math.random() * 20 - 10), // jitter left/right
        speed: this.currentSpeedMultiplier,
      });
    });

    this.isPlaying = true;
    
    // Slight delay before speaking so they notice the new round
    setTimeout(() => {
      if (this.isPlaying && !this.isShowingFeedback) {
        this.replayAudio();
      }
    }, 500);
    
    this.startGameLoop();
  }

  replayAudio() {
    if (this.targetCard) {
      this.speech.speak(this.targetCard.word);
    }
  }

  startGameLoop() {
    this.stopGameLoop();
    this.lastTime = performance.now();
    const update = (timestamp: number) => {
      const dt = timestamp - this.lastTime;
      this.lastTime = timestamp;

      let targetDied = false;
      const safeBottom = window.innerHeight + 150; // Add padding to avoid immediate game over on browser bar changes

      this.activeBlocks.forEach(block => {
        block.top += block.speed * dt;
        if (block.wordId === this.targetCard?.id && block.top > safeBottom) {
          targetDied = true;
        }
      });

      if (targetDied) {
        this.endGame();
        return;
      }

      this.gameLoopId = requestAnimationFrame(update);
    };
    this.gameLoopId = requestAnimationFrame(update);
  }

  stopGameLoop() {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
  }

  onBlockClick(block: FallingBlock) {
    if (!this.isPlaying || this.isShowingFeedback) return;

    if (block.wordId === this.targetCard?.id) {
       this.score += 10;
       this.profileService.addXP(5);
       this.profileService.recordActivity('game');
       this.showFeedback(true);
    } else {
       this.showFeedback(false);
    }
  }

  showFeedback(isSuccess: boolean) {
    this.stopGameLoop();
    this.isShowingFeedback = true;
    this.isFeedbackSuccess = isSuccess;

    setTimeout(() => {
      this.isShowingFeedback = false;
      if (isSuccess) {
        this.startRound(); 
      } else {
        this.endGame();
      }
    }, 1200);
  }

  endGame() {
    this.stopGameLoop();
    this.isPlaying = false;
    this.isGameOver = true;
  }

  getBlockColor(id: string): string {
    const num = parseFloat(id) * 100;
    const digit = Math.floor(num) % 4;
    const gradients = [
      'linear-gradient(135deg, rgba(88, 28, 135, 0.7), rgba(126, 34, 206, 0.8))', // Purple
      'linear-gradient(135deg, rgba(15, 118, 110, 0.7), rgba(20, 184, 166, 0.8))', // Teal
      'linear-gradient(135deg, rgba(185, 28, 28, 0.7), rgba(220, 38, 38, 0.8))', // Red
      'linear-gradient(135deg, rgba(194, 65, 12, 0.7), rgba(234, 88, 12, 0.8))' // Orange
    ];
    return gradients[digit];
  }

  trackByBlockId(index: number, block: FallingBlock) {
    return block.id;
  }
}
