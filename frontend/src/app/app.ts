import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { PoolService } from './core/services/pool.service';
import { NavComponent } from './shared/components/nav/nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavComponent],
  template: `
    @if (showNav()) {
      <app-nav
        [poolId]="currentPoolId()"
        [isAdmin]="isAdmin()"
        [userDisplayName]="displayName()"
        [isDark]="isDark()"
        (themeToggle)="toggleTheme()"
        (signOut)="signOut()"
      ></app-nav>
      <main class="main-content">
        @if (joinCode()) {
          <div class="join-code-badge">
            <span class="join-code-label">Join Code</span>
            <span class="join-code-value">{{ joinCode() }}</span>
          </div>
        }
        <router-outlet></router-outlet>
      </main>
    } @else {
      <router-outlet></router-outlet>
    }
  `,
  styles: [`
    :host { display: block; }
    .main-content { margin-left: 240px; min-height: 100vh; background-color: var(--bg); }
    @media (max-width: 768px) { .main-content { margin-left: 0; } }
    .join-code-badge {
      position: fixed; top: 14px; right: 20px; z-index: 999;
      display: flex; align-items: center; gap: 7px;
      background: var(--surface-2); border: 1px solid var(--border-2);
      border-radius: 8px; padding: 5px 12px;
      pointer-events: none;
    }
    .join-code-label {
      font-family: 'Inter', sans-serif; font-size: 0.68rem; font-weight: 600;
      letter-spacing: 0.5px; color: var(--text-3); text-transform: uppercase;
    }
    .join-code-value {
      font-family: 'Bebas Neue', sans-serif; font-size: 1rem;
      letter-spacing: 3px; color: var(--score);
    }
  `],
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly router = inject(Router);

  readonly isDark = signal(true);
  readonly currentPoolId = signal<string | null>(null);
  readonly joinCode = signal<string | null>(null);
  readonly isAdmin = signal(false);
  readonly displayName = signal('');

  readonly showNav = signal(false);

  constructor() {
    const stored = localStorage.getItem('theme');
    this.isDark.set(stored !== 'light');
    this.applyTheme(this.isDark());

    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.auth.getProfile(user.id).then(p => this.displayName.set(p?.display_name ?? user.email ?? ''));
      } else {
        this.displayName.set('');
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects)
    ).subscribe(async (url) => {
      const isAuthPage = url.startsWith('/auth/');
      const user = this.auth.currentUser();
      this.showNav.set(!isAuthPage && !!user);

      const poolMatch = url.match(/\/pool\/([^/]+)/);
      const adminMatch = url.match(/\/admin\/results\/([^/]+)/);
      const poolId = poolMatch?.[1] ?? adminMatch?.[1] ?? null;
      this.currentPoolId.set(poolId);

      if (poolId) {
        const pool = await this.poolService.getPool(poolId);
        this.joinCode.set(pool?.join_code ?? null);
        this.isAdmin.set(!!user && pool?.admin_id === user.id);
      } else {
        this.joinCode.set(null);
        this.isAdmin.set(false);
      }
    });

    this.auth.session$.subscribe(session => {
      const url = this.router.url;
      const isAuthPage = url.startsWith('/auth/');
      this.showNav.set(!isAuthPage && !!session);
    });
  }

  toggleTheme(): void {
    const newDark = !this.isDark();
    this.isDark.set(newDark);
    this.applyTheme(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean): void {
    document.body.classList.toggle('theme-dark', dark);
    document.body.classList.toggle('theme-light', !dark);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/auth/login']);
  }
}
