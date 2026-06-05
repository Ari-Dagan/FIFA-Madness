import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Pool, PoolMember } from '../models/index';

@Injectable({ providedIn: 'root' })
export class PoolService {
  private readonly supabase = inject(SupabaseService);

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async createPool(name: string, tiebreakerMode: Pool['tiebreaker_mode'], adminId: string): Promise<Pool> {
    const join_code = this.generateJoinCode();
    const { data, error } = await this.supabase.client
      .from('pools')
      .insert({ name, join_code, admin_id: adminId, tiebreaker_mode: tiebreakerMode, is_locked: false })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const pool = data as Pool;
    await this.supabase.client
      .from('pool_members')
      .insert({ pool_id: pool.id, user_id: adminId });

    return pool;
  }

  async getPool(poolId: string): Promise<Pool | null> {
    const { data, error } = await this.supabase.client
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (error) return null;
    return data as Pool;
  }

  async joinPool(joinCode: string, userId: string): Promise<Pool> {
    const { data: poolData, error: poolError } = await this.supabase.client
      .from('pools')
      .select('*')
      .eq('join_code', joinCode.toUpperCase())
      .single();

    if (poolError || !poolData) throw new Error('Pool not found for that join code.');

    const pool = poolData as Pool;
    const { error: memberError } = await this.supabase.client
      .from('pool_members')
      .insert({ pool_id: pool.id, user_id: userId });

    if (memberError && memberError.code !== '23505') {
      throw new Error(memberError.message);
    }

    return pool;
  }

  async getUserPools(userId: string): Promise<Pool[]> {
    const { data, error } = await this.supabase.client
      .from('pool_members')
      .select('pool_id, pools(*)')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row: { pool_id: string; pools: unknown }) => row.pools as Pool);
  }

  async getMembers(poolId: string): Promise<PoolMember[]> {
    const { data, error } = await this.supabase.client
      .from('pool_members')
      .select('*, profiles(*)')
      .eq('pool_id', poolId);

    if (error) throw new Error(error.message);
    return (data ?? []) as PoolMember[];
  }

  async isAdmin(poolId: string, userId: string): Promise<boolean> {
    const pool = await this.getPool(poolId);
    return pool?.admin_id === userId;
  }

  async lockPool(poolId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('pools')
      .update({ is_locked: true })
      .eq('id', poolId);

    if (error) throw new Error(error.message);
  }

  async getTiebreakerValue(poolId: string, userId: string): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('pool_members')
      .select('tiebreaker_value')
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return (data as { tiebreaker_value: number | null }).tiebreaker_value;
  }

  async saveTiebreakerValue(poolId: string, userId: string, value: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('pool_members')
      .update({ tiebreaker_value: value })
      .eq('pool_id', poolId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }
}
