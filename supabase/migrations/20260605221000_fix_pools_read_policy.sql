-- Allow admins to read their own pools (needed for insert+select on create)
create policy "pools_read_admin" on pools for select
  using (auth.uid() = admin_id);

-- Allow any authenticated user to look up a pool (needed for join-by-code flow)
-- Security: join code is still required to actually join
create policy "pools_read_by_code" on pools for select
  using (auth.uid() is not null);
