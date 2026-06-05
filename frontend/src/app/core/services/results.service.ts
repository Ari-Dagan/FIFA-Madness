import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Result, Outcome } from '../models/index';

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly supabase = inject(SupabaseService);

  async getResults(): Promise<Result[]> {
    const { data, error } = await this.supabase.client
      .from('results')
      .select('*');

    if (error) throw new Error(error.message);
    return (data ?? []) as Result[];
  }

  async getResult(matchId: string): Promise<Result | null> {
    const { data, error } = await this.supabase.client
      .from('results')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (error) return null;
    return data as Result;
  }

  async saveResult(matchId: string, homeScore: number, awayScore: number, userId: string): Promise<void> {
    let outcome: Outcome;
    if (homeScore > awayScore) outcome = 'home';
    else if (awayScore > homeScore) outcome = 'away';
    else outcome = 'draw';

    const { error: upsertError } = await this.supabase.client
      .from('results')
      .upsert(
        { match_id: matchId, home_score: homeScore, away_score: awayScore, outcome, status: 'finished', entered_by: userId, entered_at: new Date().toISOString() },
        { onConflict: 'match_id' }
      );

    if (upsertError) throw new Error(upsertError.message);

    const { error: gradeError } = await this.supabase.client
      .rpc('grade_match_picks', { p_match_id: matchId, p_outcome: outcome });

    if (gradeError) throw new Error(gradeError.message);
  }
}
