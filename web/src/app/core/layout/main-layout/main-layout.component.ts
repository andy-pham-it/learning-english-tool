import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, BottomNavComponent],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-hidden">
      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto relative isolate">
        <router-outlet></router-outlet>
      </main>
      
      <!-- Bottom Navigation -->
      <app-bottom-nav></app-bottom-nav>
    </div>

  `
})
export class MainLayoutComponent {}
