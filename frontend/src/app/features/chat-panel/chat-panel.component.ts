import { Component, inject, input, output, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PoolMessage } from '../../core/models/index';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
  host: {
    '[class.collapsed]': 'collapsed()',
    '[class.fullscreen]': 'fullscreen()',
    '[class.mobile-open]': 'mobileOpen()',
  },
})
export class ChatPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private channel: RealtimeChannel | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private shouldScroll = false;
  private atBottom = true;

  poolId = input.required<string>();
  displayName = input<string>('');
  collapsed = input<boolean>(false);
  fullscreen = input<boolean>(false);
  mobileOpen = input<boolean>(false);
  collapseToggle = output<void>();
  fullscreenToggle = output<void>();
  closeMobile = output<void>();

  @ViewChild('messageList') messageList?: ElementRef<HTMLDivElement>;

  readonly messages = signal<PoolMessage[]>([]);
  readonly loading = signal(true);
  readonly sending = signal(false);
  messageText = '';

  async ngOnInit(): Promise<void> {
    const msgs = await this.chatService.getMessages(this.poolId());
    this.messages.set(msgs);
    this.loading.set(false);
    this.shouldScroll = true;

    this.channel = this.chatService.subscribeToMessages(this.poolId(), (msg) => {
      this.messages.update(list => {
        if (list.some(m => m.id === msg.id)) return list;
        return [...list, msg];
      });
      this.shouldScroll = true;
    });

    this.pollInterval = setInterval(async () => {
      const msgs = await this.chatService.getMessages(this.poolId());
      const prevCount = this.messages().length;
      this.messages.set(msgs);
      if (msgs.length > prevCount && this.atBottom) this.shouldScroll = true;
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.channel) this.supabase.client.removeChannel(this.channel);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    const el = this.messageList?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  onMessageScroll(el: HTMLDivElement): void {
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
    const optimistic: PoolMessage = {
      id: tempId,
      pool_id: this.poolId(),
      user_id: user.id,
      display_name: this.displayName() || 'Anonymous',
      message: text,
      created_at: new Date().toISOString(),
    };
    this.messages.update(list => [...list, optimistic]);
    this.shouldScroll = true;

    try {
      await this.chatService.sendMessage(this.poolId(), user.id, this.displayName() || 'Anonymous', text);
      // Replace temp with real data on next poll; realtime will dedup
    } catch {
      this.messages.update(list => list.filter(m => m.id !== tempId));
      this.messageText = text;
    } finally {
      this.sending.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  isMine(msg: PoolMessage): boolean {
    return msg.user_id === this.auth.currentUser()?.id;
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}
