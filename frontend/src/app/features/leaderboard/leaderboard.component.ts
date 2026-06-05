import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { ResultsService } from '../../core/services/results.service';
import { LeaderboardEntry, Pool } from '../../core/models/index';

const TOTAL_MATCHES = 48;

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatProgressBarModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly resultsService = inject(ResultsService);
  private readonly snackBar = inject(MatSnackBar);

  readonly poolId = this.route.snapshot.paramMap.get('poolId')!;
  readonly currentUser = this.auth.currentUser;

  readonly loading = signal(true);
  readonly pool = signal<Pool | null>(null);
  readonly entries = signal<LeaderboardEntry[]>([]);
  readonly finishedMatchCount = signal(0);
  private channel: RealtimeChannel | null = null;

  readonly displayedColumns = ['rank', 'name', 'correct', 'total', 'max_possible', 'behind', 'alive', 'tiebreaker'];

  readonly myEntry = computed(() => {
    const user = this.currentUser();
    if (!user) return null;
    return this.entries().find(e => e.user_id === user.id) ?? null;
  });

  readonly leader = computed(() => this.entries()[0] ?? null);

  readonly aliveCount = computed(() => this.entries().filter(e => e.still_alive).length);

  readonly totalGamesRemaining = computed(() => TOTAL_MATCHES - this.finishedMatchCount());

  rankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return String(rank);
  }

  maxPossibleBarValue(entry: LeaderboardEntry): number {
    const totalGames = 48;
    return Math.round((entry.max_possible_points / totalGames) * 100);
  }

  async ngOnInit(): Promise<void> {
    const [poolData, entries, results] = await Promise.all([
      this.poolService.getPool(this.poolId),
      this.leaderboardService.getLeaderboard(this.poolId),
      this.resultsService.getResults(),
    ]);

    this.pool.set(poolData);
    this.entries.set(entries);
    this.finishedMatchCount.set(results.filter(r => r.status === 'finished').length);
    this.loading.set(false);

    this.channel = this.leaderboardService.subscribeToLeaderboard(this.poolId, (updated) => {
      this.entries.set(updated);
      this.snackBar.open('📊 Leaderboard updated!', '', { duration: 2500, panelClass: 'snack-info' });
    });
  }

  ngOnDestroy(): void {
    this.channel?.unsubscribe();
  }
}
