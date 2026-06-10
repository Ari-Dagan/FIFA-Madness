import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { MatchService } from '../../core/services/match.service';
import { ResultsService } from '../../core/services/results.service';
import { Match, Result } from '../../core/models/index';
import { NetworkBadgeComponent } from '../../shared/components/network-badge/network-badge.component';
import { getFlagUrl, teamDisplayName } from '../../core/utils/country-flags';

interface MatchRow {
  match: Match;
  homeScore: number | null;
  awayScore: number | null;
  existingResult: Result | null;
  isAutoSynced: boolean;
  saving: boolean;
  saved: boolean;
}

@Component({
  selector: 'app-admin-results',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTableModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, MatChipsModule, MatTooltipModule, NetworkBadgeComponent],
  templateUrl: './admin-results.component.html',
  styleUrl: './admin-results.component.scss',
})
export class AdminResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly matchService = inject(MatchService);
  private readonly resultsService = inject(ResultsService);
  private readonly snackBar = inject(MatSnackBar);

  readonly poolId = this.route.snapshot.paramMap.get('poolId')!;
  readonly loading = signal(true);
  readonly isLocked = signal(false);
  readonly locking = signal(false);
  readonly rows = signal<MatchRow[]>([]);
  readonly displayedColumns = ['match', 'teams', 'home_score', 'away_score', 'outcome', 'source', 'action', 'undo'];

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser();
    const pool = await this.poolService.getPool(this.poolId);
    if (!user || !pool || pool.admin_id !== user.id) {
      await this.router.navigate(['/pool', this.poolId]);
      return;
    }

    this.isLocked.set(pool.is_locked);

    const [matches, results] = await Promise.all([
      this.matchService.getMatches(),
      this.resultsService.getResults(),
    ]);

    const resultMap = new Map<string, Result>(results.map(r => [r.match_id, r]));
    const rows = matches.map(match => {
      const existing = resultMap.get(match.id) ?? null;
      return {
        match,
        homeScore: existing?.home_score ?? null,
        awayScore: existing?.away_score ?? null,
        existingResult: existing,
        isAutoSynced: existing !== null && existing.entered_by === null,
        saving: false,
        saved: false,
      } as MatchRow;
    });

    this.rows.set(rows);
    this.loading.set(false);
  }

  async lockPool(): Promise<void> {
    if (!confirm('Lock the pool? Players will no longer be able to change their picks.')) return;
    this.locking.set(true);
    try {
      await this.poolService.lockPool(this.poolId);
      this.isLocked.set(true);
      this.snackBar.open('Pool locked — picks are now frozen.', '', { duration: 3000, panelClass: 'snack-success' });
    } catch {
      this.snackBar.open('Error locking pool', 'Dismiss', { duration: 4000 });
    } finally {
      this.locking.set(false);
    }
  }

  readonly getFlagUrl = getFlagUrl;
  readonly teamDisplayName = teamDisplayName;

  formatMatchDate(kickoffUtc: string): string {
    if (!kickoffUtc) return '';
    return new Date(kickoffUtc).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'America/New_York'
    });
  }

  computedOutcome(row: MatchRow): string {
    if (row.homeScore === null || row.awayScore === null) return '—';
    if (row.homeScore > row.awayScore) return `${row.match.home_team} WIN`;
    if (row.awayScore > row.homeScore) return `${row.match.away_team} WIN`;
    return 'DRAW';
  }

  async saveRow(row: MatchRow): Promise<void> {
    if (row.homeScore === null || row.awayScore === null) return;
    const user = this.auth.currentUser();
    if (!user) return;

    row.saving = true;
    this.rows.set([...this.rows()]);

    try {
      await this.resultsService.saveResult(row.match.id, row.homeScore, row.awayScore, user.id);
      row.saved = true;
      row.isAutoSynced = false;
      row.existingResult = {
        id: row.existingResult?.id ?? '',
        match_id: row.match.id,
        home_score: row.homeScore,
        away_score: row.awayScore,
        outcome: row.homeScore > row.awayScore ? 'home' : row.awayScore > row.homeScore ? 'away' : 'draw',
        status: 'finished',
        entered_by: user.id,
        entered_at: new Date().toISOString(),
      };
      this.snackBar.open(`✓ Result saved: ${row.match.home_team} ${row.homeScore}–${row.awayScore} ${row.match.away_team}`, '', { duration: 3000, panelClass: 'snack-success' });
    } catch {
      this.snackBar.open('Error saving result', 'Dismiss', { duration: 4000 });
    } finally {
      row.saving = false;
      this.rows.set([...this.rows()]);
    }
  }

  async resetRow(row: MatchRow): Promise<void> {
    if (!confirm(`Reset result for match #${row.match.match_number}? This will clear scores and un-grade all picks for this match.`)) return;

    row.saving = true;
    this.rows.set([...this.rows()]);

    try {
      await this.resultsService.deleteResult(row.match.id);
      row.homeScore = null;
      row.awayScore = null;
      row.existingResult = null;
      row.isAutoSynced = false;
      row.saved = false;
      this.snackBar.open(`↩ Result reset for match #${row.match.match_number}`, '', { duration: 3000 });
    } catch {
      this.snackBar.open('Error resetting result', 'Dismiss', { duration: 4000 });
    } finally {
      row.saving = false;
      this.rows.set([...this.rows()]);
    }
  }
}
