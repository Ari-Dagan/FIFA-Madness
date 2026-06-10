import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatchService } from '../../core/services/match.service';
import { ResultsService } from '../../core/services/results.service';
import { PicksService } from '../../core/services/picks.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Match, Outcome, Result } from '../../core/models/index';
import { NetworkBadgeComponent } from '../../shared/components/network-badge/network-badge.component';
import { getFlagUrl, teamDisplayName } from '../../core/utils/country-flags';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MatchWithResult extends Match {
  result?: Result;
}

@Component({
  selector: 'app-scores',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressSpinnerModule, MatDividerModule, NetworkBadgeComponent],
  templateUrl: './scores.component.html',
  styleUrl: './scores.component.scss',
})
export class ScoresComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly matchService = inject(MatchService);
  private readonly resultsService = inject(ResultsService);
  private readonly picksService = inject(PicksService);
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private channel: RealtimeChannel | null = null;

  private pickMap = new Map<string, Outcome>();

  readonly loading = signal(true);
  readonly matchesWithResults = signal<MatchWithResult[]>([]);
  readonly selectedGroup = signal<string>('ALL');

  readonly groups = computed(() => {
    const letters = [...new Set(this.matchesWithResults().map(m => m.group_letter))].sort();
    return ['ALL', ...letters];
  });

  readonly filtered = computed(() => {
    const group = this.selectedGroup();
    const all = this.matchesWithResults();
    return group === 'ALL' ? all : all.filter(m => m.group_letter === group);
  });

  readonly groupedFiltered = computed((): { letter: string; matches: MatchWithResult[] }[] => {
    const map = new Map<string, MatchWithResult[]>();
    for (const m of this.filtered()) {
      const arr = map.get(m.group_letter) ?? [];
      arr.push(m);
      map.set(m.group_letter, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([letter, matches]) => ({ letter, matches }));
  });

  readonly completedCount = computed(() => this.matchesWithResults().filter(m => m.result?.status === 'finished').length);
  readonly liveCount = computed(() => this.matchesWithResults().filter(m => m.result?.status === 'live').length);

  async ngOnInit(): Promise<void> {
    const poolId = this.route.snapshot.paramMap.get('poolId');
    const user = this.auth.currentUser();

    const [matches, results, picks] = await Promise.all([
      this.matchService.getMatches(),
      this.resultsService.getResults(),
      poolId && user ? this.picksService.getPicks(poolId, user.id).catch(() => []) : Promise.resolve([]),
    ]);

    this.pickMap = new Map(picks.map(p => [p.match_id, p.pick]));

    const resultMap = new Map<string, Result>(results.map(r => [r.match_id, r]));
    this.matchesWithResults.set(matches.map(m => ({ ...m, result: resultMap.get(m.id) })));
    this.loading.set(false);

    this.channel = this.supabase.client
      .channel('scores-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, (payload) => {
        const updated = payload.new as Result;
        if (!updated?.match_id) return;
        this.matchesWithResults.update(list =>
          list.map(m => m.id === updated.match_id ? { ...m, result: updated } : m)
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        const updated = payload.new as Match;
        if (!updated?.id) return;
        this.matchesWithResults.update(list =>
          list.map(m => m.id === updated.id ? { ...m, ...updated } : m)
        );
      })
      .subscribe();
  }

  ngOnDestroy(): void {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
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

  pickState(matchId: string, outcome: string | undefined): 'correct' | 'wrong' | null {
    const pick = this.pickMap.get(matchId);
    if (!pick || !outcome) return null;
    return pick === outcome ? 'correct' : 'wrong';
  }

  outcomeLabel(outcome: string | undefined): string {
    if (!outcome) return '';
    if (outcome === 'home') return 'HOME WIN';
    if (outcome === 'away') return 'AWAY WIN';
    return 'DRAW';
  }
}
