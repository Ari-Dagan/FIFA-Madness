-- Fix infinite recursion in pool_members RLS policies
-- The old policies queried pool_members from within pool_members policies, causing recursion.
-- Solution: security definer function bypasses RLS when checking membership.

drop policy if exists "pool_members_read" on pool_members;
drop policy if exists "pools_read_member" on pools;

create or replace function is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from pool_members
    where pool_members.pool_id = p_pool_id
    and pool_members.user_id = auth.uid()
  );
$$;

create policy "pools_read_member" on pools for select
  using (is_pool_member(id));

create policy "pool_members_read" on pool_members for select
  using (is_pool_member(pool_id));
