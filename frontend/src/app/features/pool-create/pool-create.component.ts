import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { Pool } from '../../core/models/index';

@Component({
  selector: 'app-pool-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './pool-create.component.html',
  styleUrl: './pool-create.component.scss',
})
export class PoolCreateComponent {
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly clipboard = inject(Clipboard);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly createdPool = signal<Pool | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    tiebreakerMode: ['none' as Pool['tiebreaker_mode']],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const user = this.auth.currentUser();
    if (!user) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { name, tiebreakerMode } = this.form.getRawValue();
      const pool = await this.poolService.createPool(name!, tiebreakerMode!, user.id);
      this.createdPool.set(pool);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      this.loading.set(false);
    }
  }

  copyCode(): void {
    const code = this.createdPool()?.join_code;
    if (code) {
      this.clipboard.copy(code);
      this.snackBar.open('Join code copied!', '', { duration: 2000 });
    }
  }

  goToPool(): void {
    const pool = this.createdPool();
    if (pool) this.router.navigate(['/pool', pool.id]);
  }
}
