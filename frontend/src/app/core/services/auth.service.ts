import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Profile } from '../models/index';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly currentUser = signal<User | null>(null);

  private readonly _session$ = new Subject<Session | null>();
  readonly session$: Observable<Session | null> = this._session$.asObservable();

  constructor() {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.currentUser.set(data.session?.user ?? null);
    });

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
      this._session$.next(session);
    });
  }

  async signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    return error;
  }

  async signUp(email: string, password: string, displayName: string): Promise<AuthError | null> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error || !data.user) return error;

    // Trigger handles profile creation. Client-side insert is a fallback
    // for cases where the session is immediately available (email confirm off).
    await this.supabase.client
      .from('profiles')
      .upsert({ id: data.user.id, display_name: displayName }, { onConflict: 'id', ignoreDuplicates: true });

    // When "Confirm email" is disabled in Supabase, signUp returns a session directly.
    // Use it to set the authenticated state without a separate sign-in call.
    if (data.session) {
      await this.supabase.client.auth.setSession(data.session);
    }

    return null;
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data as Profile;
  }
}
