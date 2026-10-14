import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

const MEMBER_LINKS: readonly NavLink[] = [
  { path: '/contacts', label: 'Contacts', icon: 'contacts' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/profile', label: 'Profile', icon: 'person' }
];

const GUEST_LINKS: readonly NavLink[] = [
  { path: '/login', label: 'Sign in', icon: 'login' },
  { path: '/register', label: 'Create account', icon: 'person_add' }
];

@Component({
  selector: 'app-mainnav',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './mainnav.component.html',
  styleUrl: './mainnav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainnavComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly isAuthenticated = this.session.isAuthenticated;
  protected readonly firstName = computed(() => this.session.user()?.name ?? '');
  protected readonly links = computed(() => (this.isAuthenticated() ? MEMBER_LINKS : GUEST_LINKS));

  protected signOut(): void {
    this.api.logout().subscribe(() => void this.router.navigate(['/login']));
  }
}
