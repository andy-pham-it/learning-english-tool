import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'flashcards', loadComponent: () => import('./features/flashcards/pages/flashcards-page.component').then(m => m.FlashcardsPageComponent) },
      { path: 'think-aloud', loadComponent: () => import('./features/think-aloud/pages/think-aloud-page.component').then(m => m.ThinkAloudPageComponent) },
      { path: 'minigames', loadChildren: () => import('./features/minigames/minigames.routes').then(m => m.MINIGAME_ROUTES) },

      { path: 'bossfight', loadChildren: () => import('./features/bossfight/bossfight.routes').then(m => m.BOSSFIGHT_ROUTES) },
      { path: 'dictionary', loadComponent: () => import('./features/dictionary/dictionary.component').then(m => m.DictionaryComponent) },
    ]
  }
];
