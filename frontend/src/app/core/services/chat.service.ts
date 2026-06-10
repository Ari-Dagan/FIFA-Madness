import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PoolMessage } from '../models/index';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly supabase = inject(SupabaseService);

  async getMessages(poolId: string, limit = 60): Promise<PoolMessage[]> {
    const { data, error } = await this.supabase.client
      .from('pool_messages')
      .select('*')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as PoolMessage[];
  }

  async sendMessage(poolId: string, userId: string, displayName: string, message: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('pool_messages')
      .insert({ pool_id: poolId, user_id: userId, display_name: displayName, message });
    if (error) throw new Error(error.message);
  }

  subscribeToMessages(poolId: string, onMessage: (msg: PoolMessage) => void): RealtimeChannel {
    return this.supabase.client
      .channel(`chat-${poolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pool_messages', filter: `pool_id=eq.${poolId}` },
        (payload) => onMessage(payload.new as PoolMessage)
      )
      .subscribe();
  }
}
