import { Routes } from '@angular/router';

export const MINIGAME_ROUTES: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./pages/minigames-hub/minigames-hub.component').then(m => m.MinigamesHubComponent) 
  },
  { 
    path: 'falling-words', 
    loadComponent: () => import('./pages/falling-words/falling-words.component').then(m => m.FallingWordsComponent) 
  },
  { 
    path: 'speaking-drill', 
    loadComponent: () => import('./pages/speaking-drill/speaking-drill.component').then(m => m.SpeakingDrillComponent) 
  }
];
