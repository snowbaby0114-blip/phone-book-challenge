import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './services/auth-guard.service';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'contacts' },
  {
    path: 'login',
    title: 'Sign in | Phone Book',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    title: 'Create account | Phone Book',
    canActivate: [guestGuard],
    loadComponent: () => import('./signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'contacts',
    title: 'Contacts | Phone Book',
    canActivate: [authGuard],
    loadComponent: () => import('./contacts/contacts-page/contacts-page.component').then(m => m.ContactsPageComponent)
  },
  {
    path: 'history',
    title: 'History | Phone Book',
    canActivate: [authGuard],
    loadComponent: () => import('./history/history-page/history-page.component').then(m => m.HistoryPageComponent)
  },
  {
    path: 'profile',
    title: 'Profile | Phone Book',
    canActivate: [authGuard],
    loadComponent: () => import('./profile/profile-management/profile-management.component').then(m => m.ProfileManagementComponent)
  },
  { path: '**', redirectTo: 'contacts' }
];
