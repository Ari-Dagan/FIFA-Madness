import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';

@Component({
  selector: 'app-pool-join',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './pool-join.component.html',
  styleUrl: './pool-join.component.scss',
})
export class PoolJoinComponent {
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    joinCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^[A-Z0-9]+$/i)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const user = this.auth.currentUser();
    if (!user) { await this.router.navigate(['/auth/login']); return; }

    this.loading.set(true);
    this.error.set(null);

    try {
      const pool = await this.poolService.joinPool(this.form.getRawValue().joinCode!, user.id);
      await this.router.navigate(['/pool', pool.id]);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Could not join pool');
    } finally {
      this.loading.set(false);
    }
  }
}
