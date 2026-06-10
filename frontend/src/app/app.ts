import { Component, inject, OnInit, signal, effect, computed } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './core/services/auth.service';
import { PoolService } from './core/services/pool.service';
import { NavComponent } from './shared/components/nav/nav.component';
import { ChatPanelComponent } from './features/chat-panel/chat-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavComponent, ChatPanelComponent, MatButtonModule, MatIconModule],
  template: `
    @if (showNav()) {
      <app-nav
        [poolId]="currentPoolId()"
        [isAdmin]="isAdmin()"
        [userDisplayName]="displayName()"
        [isDark]="isDark()"
        [mobileOpen]="mobileNavOpen()"
        (themeToggle)="toggleTheme()"
        (signOut)="signOut()"
        (collapseChange)="onCollapseChange($event)"
        (closeMobile)="mobileNavOpen.set(false)"
      ></app-nav>

      <!-- Mobile hamburger button -->
      <button class="hamburger-btn" (click)="mobileNavOpen.set(true)" aria-label="Open menu">
        <mat-icon>menu</mat-icon>
      </button>

      <main class="main-content" [style.margin-left]="contentMargin()" [style.margin-right]="contentMarginRight()">
        <router-outlet></router-outlet>
      </main>
    } @else {
      <router-outlet></router-outlet>
    }

    @if (currentPoolId()) {
      @if (joinCode()) {
        <div class="join-code-badge" [style.right]="contentMarginRight()">
          <span class="join-code-label">Join Code</span>
          <span class="join-code-value">{{ joinCode() }}</span>
        </div>
      }
      <app-chat-panel
        [poolId]="currentPoolId()!"
        [displayName]="displayName()"
        [collapsed]="chatCollapsed()"
        [fullscreen]="chatFullscreen()"
        (collapseToggle)="chatCollapsed.set(!chatCollapsed())"
        (fullscreenToggle)="chatFullscreen.set(!chatFullscreen())"
      ></app-chat-panel>
    }
  `,
  styles: [`
    :host { display: block; }

    .main-content {
      min-height: 100vh;
      background-color: var(--bg);
      transition: margin-left 0.25s ease, margin-right 0.25s ease;
    }

    .hamburger-btn {
      display: none;
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 1050;
      background: var(--surface-2);
      border: 1px solid var(--border-2);
      border-radius: 8px;
      cursor: pointer;
      padding: 6px;
      color: var(--text);
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      transition: background 0.15s;
    }
    .hamburger-btn:hover { background: var(--surface-hover); }
    .hamburger-btn mat-icon { display: block; }

    @media (max-width: 768px) {
      .hamburger-btn { display: flex; }
      .main-content { margin-left: 0 !important; margin-right: 0 !important; padding-top: 52px; }
    }

    .join-code-badge {
      position: fixed; top: 14px; z-index: 895;
      display: flex; align-items: center; gap: 7px;
      background: var(--surface-2); border: 1px solid var(--border-2);
      border-radius: 8px; padding: 5px 12px;
      pointer-events: none;
      transition: right 0.25s ease;
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
  readonly sidebarCollapsed = signal(localStorage.getItem('nav-collapsed') === '1');
  readonly mobileNavOpen = signal(false);
  readonly chatCollapsed = signal(false);
  readonly chatFullscreen = signal(false);

  readonly contentMargin = computed(() => this.sidebarCollapsed() ? '72px' : '240px');
  readonly contentMarginRight = computed(() => {
    if (!this.currentPoolId()) return '0';
    if (this.chatCollapsed()) return '40px';
    return '260px';
  });

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
      this.mobileNavOpen.set(false); // close mobile nav on route change

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

  onCollapseChange(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
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
