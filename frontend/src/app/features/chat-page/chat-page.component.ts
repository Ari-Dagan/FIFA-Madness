import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PoolMessage } from '../../core/models/index';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
})
export class ChatPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly supabase = inject(SupabaseService);

  private channel: RealtimeChannel | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private shouldScroll = false;
  private atBottom = true;

  readonly poolId = this.route.snapshot.paramMap.get('poolId')!;
  readonly messages = signal<PoolMessage[]>([]);
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly joinCode = signal<string | null>(null);
  messageText = '';

  @ViewChild('messageList') messageList?: ElementRef<HTMLDivElement>;

  async ngOnInit(): Promise<void> {
    const pool = await this.poolService.getPool(this.poolId);
    this.joinCode.set(pool?.join_code ?? null);

    const msgs = await this.chatService.getMessages(this.poolId);
    this.messages.set(msgs);
    this.loading.set(false);
    this.shouldScroll = true;

    this.channel = this.chatService.subscribeToMessages(this.poolId, (msg) => {
      this.messages.update(list => list.some(m => m.id === msg.id) ? list : [...list, msg]);
      this.shouldScroll = true;
    });

    this.pollInterval = setInterval(async () => {
      const fresh = await this.chatService.getMessages(this.poolId);
      const prev = this.messages().length;
      this.messages.set(fresh);
      if (fresh.length > prev && this.atBottom) this.shouldScroll = true;
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      const el = this.messageList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onScroll(el: HTMLDivElement): void {
    this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async send(): Promise<void> {
    const text = this.messageText.trim();
    if (!text || this.sending()) return;
    const user = this.auth.currentUser();
    if (!user) return;

    this.sending.set(true);
    this.messageText = '';

    const tempId = crypto.randomUUID();
    const displayName = user.user_metadata?.['display_name'] ?? user.email ?? 'Anonymous';
    const optimistic: PoolMessage = {
      id: tempId, pool_id: this.poolId, user_id: user.id,
      display_name: displayName, message: text, created_at: new Date().toISOString(),
    };
    this.messages.update(list => [...list, optimistic]);
    this.shouldScroll = true;

    try {
      await this.chatService.sendMessage(this.poolId, user.id, displayName, text);
    } catch {
      this.messages.update(list => list.filter(m => m.id !== tempId));
      this.messageText = text;
    } finally {
      this.sending.set(false);
    }
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  isMine(msg: PoolMessage): boolean {
    return msg.user_id === this.auth.currentUser()?.id;
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  goBack(): void {
    this.router.navigate(['/pool', this.poolId]);
  }
}
