import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-minigames-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#0B1121] flex flex-col items-center pt-20 p-4">
      <div class="w-full max-w-lg mb-10 text-center">
        <h1 class="text-4xl font-bold bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent mb-3">Daily Drills</h1>
        <p class="text-indigo-200/70">Solidify your vocabulary through interactive challenges.</p>
      </div>

      <div class="w-full max-w-lg grid gap-6">
        
        <!-- Game 1 Card -->
        <a routerLink="falling-words" class="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition-all duration-300 p-6 flex items-center gap-6 cursor-pointer">
          <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div class="w-16 h-16 rounded-2xl bg-indigo-500/20 flex flex-shrink-0 items-center justify-center text-3xl shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            🎯
          </div>
          <div class="z-10">
            <h2 class="text-xl font-bold text-white mb-1">Falling Words</h2>
            <p class="text-sm text-gray-400">Listen carefully and catch the falling meanings before they drop!</p>
          </div>
        </a>

        <!-- Game 3 Card -->
        <a routerLink="speaking-drill" class="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-white/10 transition-all duration-300 p-6 flex items-center gap-6 cursor-pointer">
          <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 flex flex-shrink-0 items-center justify-center text-3xl shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            🎙️
          </div>
          <div class="z-10">
            <h2 class="text-xl font-bold text-white mb-1">Speaking Drill</h2>
            <p class="text-sm text-gray-400">Practice your pronunciation. Read the word out loud for evaluation.</p>
          </div>
        </a>

      </div>
    </div>
  `
})
export class MinigamesHubComponent {}
