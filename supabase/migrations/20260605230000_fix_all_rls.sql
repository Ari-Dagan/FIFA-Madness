-- ── 1. Auto-create profile on signup ─────────────────────────────
-- Runs as superuser (security definer) so it bypasses RLS.
-- Reads display_name from metadata passed during signUp, falls back to email prefix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. Backfill any existing auth users missing a profile ─────────
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ── 3. Fix picks read policy ──────────────────────────────────────
-- Old policy only allowed reading your own picks.
-- Leaderboard pending-count queries and result grading need to read
-- all picks within a pool. Allow any pool member to read all picks in their pool.
drop policy if exists "picks_read_own" on picks;
create policy "picks_read_pool_member" on picks for select
  using (is_pool_member(pool_id));

-- ── 4. RPC to grade picks after a result is saved ─────────────────
-- security definer bypasses picks_update_own so the admin can mark
-- is_correct on every user's pick for the match, not just their own.
create or replace function public.grade_match_picks(p_match_id uuid, p_outcome text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.picks
  set is_correct = (pick = p_outcome)
  where match_id = p_match_id;
end;
$$;
