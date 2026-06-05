import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Pick, Outcome } from '../models/index';

@Injectable({ providedIn: 'root' })
export class PicksService {
  private readonly supabase = inject(SupabaseService);

  async getPicks(poolId: string, userId: string): Promise<Pick[]> {
    const { data, error } = await this.supabase.client
      .from('picks')
      .select('*')
      .eq('pool_id', poolId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data ?? []) as Pick[];
  }

  async getAllPicks(poolId: string): Promise<Pick[]> {
    const { data, error } = await this.supabase.client
      .from('picks')
      .select('*')
      .eq('pool_id', poolId);

    if (error) throw new Error(error.message);
    return (data ?? []) as Pick[];
  }

  async savePicks(
    poolId: string,
    userId: string,
    picks: { match_id: string; pick: Outcome }[]
  ): Promise<void> {
    const rows = picks.map(p => ({
      pool_id: poolId,
      user_id: userId,
      match_id: p.match_id,
      pick: p.pick,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase.client
      .from('picks')
      .upsert(rows, { onConflict: 'pool_id,user_id,match_id' });

    if (error) throw new Error(error.message);
  }
}
