import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { MatchService } from '../../core/services/match.service';
import { PicksService } from '../../core/services/picks.service';
import { ResultsService } from '../../core/services/results.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Match, Outcome, Pick, Pool, Result } from '../../core/models/index';
import { PickToggleComponent } from '../../shared/components/pick-toggle/pick-toggle.component';
import { NetworkBadgeComponent } from '../../shared/components/network-badge/network-badge.component';
import { getFlagUrl, teamDisplayName } from '../../core/utils/country-flags';
import { isTournamentStarted } from '../../core/utils/tournament';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MatchGroup {
  letter: string;
  matches: Match[];
}

@Component({
  selector: 'app-picks',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressBarModule, MatChipsModule, MatDividerModule, MatSnackBarModule, MatIconModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, PickToggleComponent, NetworkBadgeComponent],
  templateUrl: './picks.component.html',
  styleUrl: './picks.component.scss',
})
export class PicksComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly matchService = inject(MatchService);
  private readonly picksService = inject(PicksService);
  private readonly resultsService = inject(ResultsService);
  private readonly supabase = inject(SupabaseService);
  private readonly snackBar = inject(MatSnackBar);
  private channel: RealtimeChannel | null = null;

  readonly poolId = this.route.snapshot.paramMap.get('poolId')!;
  readonly viewUserId = this.route.snapshot.queryParamMap.get('view');
  readonly viewedName = this.route.snapshot.queryParamMap.get('name') ?? '';
  readonly isViewingOther = !!this.viewUserId;

  readonly currentUser = this.auth.currentUser;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly pool = signal<Pool | null>(null);
  readonly matches = signal<Match[]>([]);
  readonly results = signal<Map<string, Result>>(new Map());
  readonly pickMap = signal<Map<string, Outcome>>(new Map());
  readonly tiebreakerValue = signal<number | null>(null);

  readonly effectiveLocked = computed(() =>
    (this.pool()?.is_locked ?? false) || isTournamentStarted()
  );

  readonly matchGroups = computed((): MatchGroup[] => {
    const groups = new Map<string, Match[]>();
    for (const m of this.matches()) {
      const list = groups.get(m.group_letter) ?? [];
      list.push(m);
      groups.set(m.group_letter, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, matches]) => ({ letter, matches }));
  });

  readonly pickCount = computed(() => this.pickMap().size);
  readonly pickProgress = computed(() => Math.round((this.pickCount() / Math.max(this.matches().length, 1)) * 100));

  async ngOnInit(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    const targetUserId = this.viewUserId ?? user.id;

    const [poolData, matchData, picksData, resultsData, tiebreakerVal] = await Promise.all([
      this.poolService.getPool(this.poolId),
      this.matchService.getMatches(),
      this.picksService.getPicks(this.poolId, targetUserId),
      this.resultsService.getResults(),
      this.isViewingOther ? Promise.resolve(null) : this.poolService.getTiebreakerValue(this.poolId, user.id),
    ]);

    this.pool.set(poolData);
    this.matches.set(matchData);
    this.tiebreakerValue.set(tiebreakerVal);

    if (this.isViewingOther && !this.effectiveLocked()) {
      this.router.navigate(['/pool', this.poolId, 'leaderboard']);
      return;
    }

    const pm = new Map<string, Outcome>();
    for (const p of picksData) pm.set(p.match_id, p.pick);
    this.pickMap.set(pm);

    const rm = new Map<string, Result>();
    for (const r of resultsData) rm.set(r.match_id, r);
    this.results.set(rm);

    this.loading.set(false);

    this.channel = this.supabase.client
      .channel('picks-matches-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        const updated = payload.new as Match;
        if (!updated?.id) return;
        this.matches.update(list => list.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();
  }

  ngOnDestroy(): void {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
  }

  goBack(): void {
    this.router.navigate(['/pool', this.poolId, 'leaderboard']);
  }

  onPickChange(matchId: string, outcome: Outcome): void {
    if (this.isViewingOther || this.effectiveLocked()) return;
    const newMap = new Map(this.pickMap());
    newMap.set(matchId, outcome);
    this.pickMap.set(newMap);
  }

  getResult(matchId: string): Result | undefined {
    return this.results().get(matchId);
  }

  getPick(matchId: string): Outcome | null {
    return this.pickMap().get(matchId) ?? null;
  }

  getPickState(matchId: string): 'correct' | 'wrong' | null {
    const result = this.results().get(matchId);
    const pick = this.pickMap().get(matchId);
    if (!result?.outcome || !pick) return null;
    return pick === result.outcome ? 'correct' : 'wrong';
  }

  readonly getFlagUrl = getFlagUrl;
  readonly teamDisplayName = teamDisplayName;

  formatMatchDate(kickoffUtc: string): string {
    if (!kickoffUtc) return '';
    return new Date(kickoffUtc).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'America/New_York'
    });
  }

  async saveAll(): Promise<void> {
    const user = this.currentUser();
    if (!user || this.effectiveLocked() || this.isViewingOther) return;

    this.saving.set(true);
    try {
      const picks = Array.from(this.pickMap().entries()).map(([match_id, pick]) => ({ match_id, pick }));
      const saveOps: Promise<unknown>[] = [this.picksService.savePicks(this.poolId, user.id, picks)];
      const tb = this.tiebreakerValue();
      if (tb !== null && this.pool()?.tiebreaker_mode !== 'none') {
        saveOps.push(this.poolService.saveTiebreakerValue(this.poolId, user.id, tb));
      }
      await Promise.all(saveOps);
      this.snackBar.open(`✓ ${picks.length} picks saved!`, '', { duration: 3000, panelClass: 'snack-success' });
    } catch (e: unknown) {
      this.snackBar.open('Error saving picks', 'Dismiss', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
