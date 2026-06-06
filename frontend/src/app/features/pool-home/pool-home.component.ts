import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Clipboard } from '@angular/cdk/clipboard';
import { isTournamentStarted, formatLockTime } from '../../core/utils/tournament';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { Pool, PoolMember } from '../../core/models/index';

@Component({
  selector: 'app-pool-home',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule, MatTooltipModule],
  templateUrl: './pool-home.component.html',
  styleUrl: './pool-home.component.scss',
})
export class PoolHomeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly clipboard = inject(Clipboard);

  readonly pool = signal<Pool | null>(null);
  readonly members = signal<PoolMember[]>([]);
  readonly isAdmin = signal(false);
  readonly loading = signal(true);
  readonly locking = signal(false);
  readonly lockTimeLabel = formatLockTime();
  readonly isTournamentStarted = isTournamentStarted;

  readonly poolId = this.route.snapshot.paramMap.get('poolId')!;
  readonly currentUser = this.auth.currentUser;

  async ngOnInit(): Promise<void> {
    const [poolData, membersData] = await Promise.all([
      this.poolService.getPool(this.poolId),
      this.poolService.getMembers(this.poolId),
    ]);

    this.pool.set(poolData);
    this.members.set(membersData);

    const user = this.currentUser();
    if (user && poolData) {
      this.isAdmin.set(poolData.admin_id === user.id);
    }
    this.loading.set(false);

    if (poolData && !poolData.is_locked && isTournamentStarted()) {
      try {
        await this.poolService.lockPool(this.poolId);
        this.pool.update(p => p ? { ...p, is_locked: true } : p);
      } catch { /* silent */ }
    }
  }

  copyCode(): void {
    const code = this.pool()?.join_code;
    if (code) {
      this.clipboard.copy(code);
      this.snackBar.open('Join code copied!', '', { duration: 2000 });
    }
  }

  navigate(path: string): void {
    this.router.navigate(['/pool', this.poolId, path]);
  }

  async lockPool(): Promise<void> {
    const confirmed = window.confirm(
      'Lock this pool? Players will no longer be able to change their picks or tiebreaker. This cannot be undone.'
    );
    if (!confirmed) return;

    this.locking.set(true);
    try {
      await this.poolService.lockPool(this.poolId);
      this.pool.update(p => p ? { ...p, is_locked: true } : p);
      this.snackBar.open('🔒 Pool locked — picks are frozen.', '', { duration: 3500, panelClass: 'snack-success' });
    } catch {
      this.snackBar.open('Error locking pool', 'Dismiss', { duration: 4000 });
    } finally {
      this.locking.set(false);
    }
  }
}
