import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { LeaderboardEntry } from '../models/index';

interface RawLeaderboardRow {
  pool_id: string;
  user_id: string;
  display_name: string;
  tiebreaker_value?: number;
  correct_picks: number;
  total_picks: number;
  rank: number;
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly supabase = inject(SupabaseService);

  async getLeaderboard(poolId: string): Promise<LeaderboardEntry[]> {
    const { data: rawRows, error } = await this.supabase.client
      .from('leaderboard')
      .select('*')
      .eq('pool_id', poolId)
      .order('rank', { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (rawRows ?? []) as RawLeaderboardRow[];
    if (rows.length === 0) return [];

    const leaderCorrectPicks = rows[0].correct_picks;

    const pendingCounts = await Promise.all(
      rows.map(row => this.getPendingPickCount(poolId, row.user_id))
    );

    return rows.map((row, i): LeaderboardEntry => {
      const pending_picks = pendingCounts[i];
      const max_possible_points = row.correct_picks + pending_picks;
      const points_behind_leader = leaderCorrectPicks - row.correct_picks;
      const still_alive = max_possible_points >= leaderCorrectPicks;

      return { ...row, max_possible_points, points_behind_leader, still_alive, pending_picks };
    });
  }

  private async getPendingPickCount(poolId: string, userId: string): Promise<number> {
    // Count picks that have no corresponding result yet
    const { data: allPicks, error: picksError } = await this.supabase.client
      .from('picks')
      .select('match_id')
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .is('is_correct', null);

    if (picksError) return 0;
    return (allPicks ?? []).length;
  }

  subscribeToLeaderboard(poolId: string, callback: (entries: LeaderboardEntry[]) => void): RealtimeChannel {
    return this.supabase.client
      .channel(`leaderboard:${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks', filter: `pool_id=eq.${poolId}` },
        () => { this.getLeaderboard(poolId).then(callback); }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' },
        () => { this.getLeaderboard(poolId).then(callback); }
      )
      .subscribe();
  }
}
