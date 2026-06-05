import { Component, input, output } from '@angular/core';
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
  themeToggle = output<void>();
  signOut = output<void>();
}
