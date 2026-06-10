import { Component, input, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterModule, CommonModule, MatListModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {
  poolId = input<string | null>(null);
  isAdmin = input<boolean>(false);
  userDisplayName = input<string>('');
  isDark = input<boolean>(true);
  mobileOpen = input<boolean>(false);

  themeToggle = output<void>();
  signOut = output<void>();
  collapseChange = output<boolean>();
  closeMobile = output<void>();

  readonly collapsed = signal(
    localStorage.getItem('nav-collapsed') === '1'
  );

  toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem('nav-collapsed', next ? '1' : '0');
    this.collapseChange.emit(next);
  }
}
