import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'pool/create',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pool-create/pool-create.component').then(m => m.PoolCreateComponent),
  },
  {
    path: 'pool/join',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pool-join/pool-join.component').then(m => m.PoolJoinComponent),
  },
  {
    path: 'pool/:poolId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pool-home/pool-home.component').then(m => m.PoolHomeComponent),
  },
  {
    path: 'pool/:poolId/picks',
    canActivate: [authGuard],
    loadComponent: () => import('./features/picks/picks.component').then(m => m.PicksComponent),
  },
  {
    path: 'pool/:poolId/leaderboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
  },
  {
    path: 'pool/:poolId/scores',
    canActivate: [authGuard],
    loadComponent: () => import('./features/scores/scores.component').then(m => m.ScoresComponent),
  },
  {
    path: 'admin/results/:poolId',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin-results/admin-results.component').then(m => m.AdminResultsComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  { path: '**', redirectTo: '' },
];
