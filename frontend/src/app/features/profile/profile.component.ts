import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatInputModule, MatFormFieldModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly displayName = signal('');
  readonly email = signal('');

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) { await this.router.navigate(['/auth/login']); return; }

    this.email.set(user.email ?? '');
    const profile = await this.auth.getProfile(user.id);
    this.displayName.set(profile?.display_name ?? '');
    this.loading.set(false);
  }

  async save(): Promise<void> {
    const name = this.displayName().trim();
    if (!name) return;
    const user = this.auth.currentUser();
    if (!user) return;

    this.saving.set(true);
    try {
      await this.auth.updateProfile(user.id, name);
      this.snackBar.open('Profile updated!', '', { duration: 2500, panelClass: 'snack-success' });
    } catch {
      this.snackBar.open('Failed to save — try again', 'Dismiss', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void { this.router.navigate(['/', { replaceUrl: true }]); }
}
