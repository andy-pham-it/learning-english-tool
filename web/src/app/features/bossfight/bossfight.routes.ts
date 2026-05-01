import { Routes } from '@angular/router';

export const BOSSFIGHT_ROUTES: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./pages/bossfight-page/bossfight-page.component').then(m => m.BossfightPageComponent) 
  }
];
