import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Match } from '../models/index';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly supabase = inject(SupabaseService);

  async getMatches(): Promise<Match[]> {
    const { data, error } = await this.supabase.client
      .from('matches')
      .select('*')
      .order('match_number', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as Match[];
  }

  async getMatch(matchId: string): Promise<Match | null> {
    const { data, error } = await this.supabase.client
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) return null;
    return data as Match;
  }
}
