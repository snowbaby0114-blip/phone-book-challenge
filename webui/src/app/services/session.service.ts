import { Injectable, computed, inject, signal } from '@angular/core';
import { IS_BROWSER } from '../config/tokens';
import { User } from '../models/user.model';

const STORAGE_KEY = 'user';

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { name, surname, email } = value as Record<string, unknown>;
  return typeof name === 'string' && typeof surname === 'string' && typeof email === 'string';
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly isBrowser = inject(IS_BROWSER);
  private readonly currentUser = signal<User | null>(this.restore());

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  start(user: User): void {
    this.currentUser.set(user);
    this.persist(user);
  }

  update(user: User): void {
    this.start(user);
  }

  end(): void {
    this.currentUser.set(null);
    this.persist(null);
  }

  private restore(): User | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored: unknown = raw ? JSON.parse(raw) : null;
      return isUser(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  private persist(user: User | null): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      return;
    }
  }
}
