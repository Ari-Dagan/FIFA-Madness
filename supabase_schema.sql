-- ═══════════════════════════════════════════════════════════════
-- FIFA 2026 World Cup Pool — Supabase Schema
-- Run this in your Supabase SQL Editor (one-shot)
-- ═══════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text unique not null,
  admin_id uuid references profiles(id),
  is_locked boolean default false,
  tiebreaker_mode text default 'none' check (tiebreaker_mode in ('usa_goals','total_goals','none')),
  created_at timestamptz default now()
);

create table if not exists pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  tiebreaker_value integer,
  joined_at timestamptz default now(),
  unique(pool_id, user_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  match_number integer unique not null,
  group_letter char(1) not null,
  home_team text not null,
  away_team text not null,
  home_team_flag text,
  away_team_flag text,
  kickoff_utc timestamptz not null,
  kickoff_et text not null,
  network text not null,
  venue text,
  city text
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id) on delete cascade,
  home_score integer,
  away_score integer,
  outcome text check (outcome in ('home','draw','away')),
  entered_by uuid references profiles(id),
  entered_at timestamptz default now()
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  pick text not null check (pick in ('home','draw','away')),
  is_correct boolean,
  updated_at timestamptz default now(),
  unique(pool_id, user_id, match_id)
);

-- ── Leaderboard view ─────────────────────────────────────────────

create or replace view leaderboard as
select
  pm.pool_id,
  p.id as user_id,
  p.display_name,
  pm.tiebreaker_value,
  count(*) filter (where pk.is_correct = true)::integer as correct_picks,
  count(*) filter (where pk.pick is not null)::integer as total_picks,
  rank() over (
    partition by pm.pool_id
    order by count(*) filter (where pk.is_correct = true) desc,
             abs(coalesce(pm.tiebreaker_value, 999) - 0) asc
  )::integer as rank
from pool_members pm
join profiles p on p.id = pm.user_id
left join picks pk on pk.user_id = pm.user_id and pk.pool_id = pm.pool_id
group by pm.pool_id, p.id, p.display_name, pm.tiebreaker_value;

-- ── RLS ──────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table pools enable row level security;
alter table pool_members enable row level security;
alter table matches enable row level security;
alter table results enable row level security;
alter table picks enable row level security;

-- profiles: anyone can read, users update their own
create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- pools: members can read, admin can update
create policy "pools_read_member" on pools for select
  using (id in (select pool_id from pool_members where user_id = auth.uid()));
create policy "pools_insert_auth" on pools for insert with check (auth.uid() = admin_id);
create policy "pools_update_admin" on pools for update using (auth.uid() = admin_id);

-- pool_members: members can read their pools
create policy "pool_members_read" on pool_members for select
  using (pool_id in (select pool_id from pool_members where user_id = auth.uid()));
create policy "pool_members_insert" on pool_members for insert with check (auth.uid() = user_id);

-- matches: public read
create policy "matches_read_all" on matches for select using (true);

-- results: pool members can read, any authenticated user can insert/update (admin check done in app)
create policy "results_read_member" on results for select using (true);
create policy "results_insert_auth" on results for insert with check (auth.uid() is not null);
create policy "results_update_auth" on results for update using (auth.uid() is not null);

-- picks: users manage their own picks
create policy "picks_read_own" on picks for select using (auth.uid() = user_id);
create policy "picks_insert_own" on picks for insert with check (auth.uid() = user_id);
create policy "picks_update_own" on picks for update using (auth.uid() = user_id);

-- ── Enable Realtime ───────────────────────────────────────────────
-- Run in Supabase Dashboard → Database → Replication:
-- Enable replication for: picks, results

-- ── Seed matches ─────────────────────────────────────────────────

insert into matches (match_number, group_letter, home_team, away_team, home_team_flag, away_team_flag, kickoff_utc, kickoff_et, network, venue, city) values
-- GROUP A
(1,'A','Mexico','South Africa','🇲🇽','🇿🇦','2026-06-11 19:00:00+00','3:00 PM ET','FOX/TUBI','Estadio Azteca','Mexico City'),
(2,'A','South Korea','Czechia','🇰🇷','🇨🇿','2026-06-12 02:00:00+00','10:00 PM ET','FS1','Estadio Akron','Guadalajara'),
(3,'A','Czechia','South Africa','🇨🇿','🇿🇦','2026-06-18 16:00:00+00','12:00 PM ET','FOX','Mercedes-Benz Stadium','Atlanta'),
(4,'A','Mexico','South Korea','🇲🇽','🇰🇷','2026-06-19 01:00:00+00','9:00 PM ET','FOX','Estadio Akron','Guadalajara'),
(5,'A','Mexico','Czechia','🇲🇽','🇨🇿','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
(6,'A','South Africa','South Korea','🇿🇦','🇰🇷','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
-- GROUP B
(7,'B','Canada','Bosnia and Herzegovina','🇨🇦','🇧🇦','2026-06-12 19:00:00+00','3:00 PM ET','FOX','BMO Field','Toronto'),
(8,'B','Qatar','Switzerland','🇶🇦','🇨🇭','2026-06-13 19:00:00+00','3:00 PM ET','FOX','Levi''s Stadium','San Francisco Bay'),
(9,'B','Switzerland','Bosnia and Herzegovina','🇨🇭','🇧🇦','2026-06-18 19:00:00+00','3:00 PM ET','FOX','SoFi Stadium','Los Angeles'),
(10,'B','Canada','Qatar','🇨🇦','🇶🇦','2026-06-18 22:00:00+00','6:00 PM ET','FS1','BC Place','Vancouver'),
(11,'B','Canada','Switzerland','🇨🇦','🇨🇭','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
(12,'B','Bosnia and Herzegovina','Qatar','🇧🇦','🇶🇦','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
-- GROUP C
(13,'C','Brazil','Morocco','🇧🇷','🇲🇦','2026-06-13 22:00:00+00','6:00 PM ET','FS1','MetLife Stadium','East Rutherford'),
(14,'C','Haiti','Scotland','🇭🇹','🏴󠁧󠁢󠁳󠁣󠁴󠁿','2026-06-14 01:00:00+00','9:00 PM ET','FS1','Gillette Stadium','Boston'),
(15,'C','Scotland','Morocco','🏴󠁧󠁢󠁳󠁣󠁴󠁿','🇲🇦','2026-06-19 19:00:00+00','3:00 PM ET','FOX','Gillette Stadium','Boston'),
(16,'C','Brazil','Haiti','🇧🇷','🇭🇹','2026-06-20 01:00:00+00','9:00 PM ET','FOX','Lincoln Financial Field','Philadelphia'),
(17,'C','Brazil','Scotland','🇧🇷','🏴󠁧󠁢󠁳󠁣󠁴󠁿','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
(18,'C','Morocco','Haiti','🇲🇦','🇭🇹','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
-- GROUP D
(19,'D','USA','Paraguay','🇺🇸','🇵🇾','2026-06-13 01:00:00+00','9:00 PM ET','FOX/TUBI','SoFi Stadium','Los Angeles'),
(20,'D','Australia','Türkiye','🇦🇺','🇹🇷','2026-06-13 04:00:00+00','12:00 AM ET','FOX','BC Place','Vancouver'),
(21,'D','USA','Australia','🇺🇸','🇦🇺','2026-06-19 19:00:00+00','3:00 PM ET','FOX','Lumen Field','Seattle'),
(22,'D','Türkiye','Paraguay','🇹🇷','🇵🇾','2026-06-20 04:00:00+00','12:00 AM ET','FS1','Levi''s Stadium','San Francisco Bay'),
(23,'D','Türkiye','USA','🇹🇷','🇺🇸','2026-06-26 02:00:00+00','10:00 PM ET','FOX','SoFi Stadium','Los Angeles'),
(24,'D','Paraguay','Australia','🇵🇾','🇦🇺','2026-06-26 02:00:00+00','10:00 PM ET','FS1','Levi''s Stadium','Santa Clara'),
-- GROUP E
(25,'E','Germany','Curaçao','🇩🇪','🇨🇼','2026-06-14 17:00:00+00','1:00 PM ET','FOX','NRG Stadium','Houston'),
(26,'E','Ivory Coast','Ecuador','🇨🇮','🇪🇨','2026-06-14 23:00:00+00','7:00 PM ET','FS1','Lincoln Financial Field','Philadelphia'),
(27,'E','Germany','Ivory Coast','🇩🇪','🇨🇮','2026-06-20 20:00:00+00','4:00 PM ET','FOX','BMO Field','Toronto'),
(28,'E','Ecuador','Curaçao','🇪🇨','🇨🇼','2026-06-21 00:00:00+00','8:00 PM ET','FS1','Arrowhead Stadium','Kansas City'),
(29,'E','Ecuador','Germany','🇪🇨','🇩🇪','2026-06-25 20:00:00+00','4:00 PM ET','FOX','MetLife Stadium','East Rutherford'),
(30,'E','Curaçao','Ivory Coast','🇨🇼','🇨🇮','2026-06-25 20:00:00+00','4:00 PM ET','FS1','Lincoln Financial Field','Philadelphia'),
-- GROUP F
(31,'F','Netherlands','Japan','🇳🇱','🇯🇵','2026-06-14 20:00:00+00','4:00 PM ET','FOX','AT&T Stadium','Dallas'),
(32,'F','Tunisia','Sweden','🇹🇳','🇸🇪','2026-06-15 02:00:00+00','10:00 PM ET','FS1','Estadio BBVA','Monterrey'),
(33,'F','Netherlands','Sweden','🇳🇱','🇸🇪','2026-06-20 17:00:00+00','1:00 PM ET','FOX','NRG Stadium','Houston'),
(34,'F','Tunisia','Japan','🇹🇳','🇯🇵','2026-06-20 04:00:00+00','12:00 AM ET','FS1','Estadio BBVA','Monterrey'),
(35,'F','Tunisia','Netherlands','🇹🇳','🇳🇱','2026-06-25 23:00:00+00','7:00 PM ET','FOX','Arrowhead Stadium','Kansas City'),
(36,'F','Japan','Sweden','🇯🇵','🇸🇪','2026-06-25 23:00:00+00','7:00 PM ET','FS1','AT&T Stadium','Arlington'),
-- GROUP G
(37,'G','Belgium','Egypt','🇧🇪','🇪🇬','2026-06-15 19:00:00+00','3:00 PM ET','FOX','Lumen Field','Seattle'),
(38,'G','Iran','New Zealand','🇮🇷','🇳🇿','2026-06-16 01:00:00+00','9:00 PM ET','FS1','SoFi Stadium','Los Angeles'),
(39,'G','Belgium','Iran','🇧🇪','🇮🇷','2026-06-21 19:00:00+00','3:00 PM ET','FS1','SoFi Stadium','Los Angeles'),
(40,'G','New Zealand','Egypt','🇳🇿','🇪🇬','2026-06-22 01:00:00+00','9:00 PM ET','FS1','BC Place','Vancouver'),
(41,'G','New Zealand','Belgium','🇳🇿','🇧🇪','2026-06-27 03:00:00+00','11:00 PM ET','FOX','BC Place','Vancouver'),
(42,'G','Egypt','Iran','🇪🇬','🇮🇷','2026-06-27 03:00:00+00','11:00 PM ET','FS1','Lumen Field','Seattle'),
-- GROUP H
(43,'H','Spain','Cape Verde','🇪🇸','🇨🇻','2026-06-15 16:00:00+00','12:00 PM ET','FOX','Mercedes-Benz Stadium','Atlanta'),
(44,'H','Saudi Arabia','Uruguay','🇸🇦','🇺🇾','2026-06-15 22:00:00+00','6:00 PM ET','FS1','Hard Rock Stadium','Miami'),
(45,'H','Spain','Saudi Arabia','🇪🇸','🇸🇦','2026-06-21 16:00:00+00','12:00 PM ET','FOX','Mercedes-Benz Stadium','Atlanta'),
(46,'H','Uruguay','Cape Verde','🇺🇾','🇨🇻','2026-06-21 22:00:00+00','6:00 PM ET','FS1','Hard Rock Stadium','Miami'),
(47,'H','Uruguay','Spain','🇺🇾','🇪🇸','2026-06-27 00:00:00+00','8:00 PM ET','FOX','Estadio Akron','Zapopan'),
(48,'H','Cape Verde','Saudi Arabia','🇨🇻','🇸🇦','2026-06-27 00:00:00+00','8:00 PM ET','FS1','NRG Stadium','Houston'),
-- GROUP I
(49,'I','France','Senegal','🇫🇷','🇸🇳','2026-06-16 19:00:00+00','3:00 PM ET','FOX','MetLife Stadium','East Rutherford'),
(50,'I','Iraq','Norway','🇮🇶','🇳🇴','2026-06-16 22:00:00+00','6:00 PM ET','FOX','Gillette Stadium','Boston'),
(51,'I','France','Iraq','🇫🇷','🇮🇶','2026-06-22 21:00:00+00','5:00 PM ET','FOX','Lincoln Financial Field','Philadelphia'),
(52,'I','Norway','Senegal','🇳🇴','🇸🇳','2026-06-23 00:00:00+00','8:00 PM ET','FOX','MetLife Stadium','East Rutherford'),
(53,'I','Norway','France','🇳🇴','🇫🇷','2026-06-26 19:00:00+00','3:00 PM ET','FOX','Gillette Stadium','Boston'),
(54,'I','Senegal','Iraq','🇸🇳','🇮🇶','2026-06-26 19:00:00+00','3:00 PM ET','FS1','BMO Field','Toronto'),
-- GROUP J
(55,'J','Argentina','Algeria','🇦🇷','🇩🇿','2026-06-17 01:00:00+00','9:00 PM ET','FOX','Arrowhead Stadium','Kansas City'),
(56,'J','Austria','Jordan','🇦🇹','🇯🇴','2026-06-17 04:00:00+00','12:00 AM ET','FS1','Levi''s Stadium','San Francisco Bay'),
(57,'J','Argentina','Austria','🇦🇷','🇦🇹','2026-06-22 17:00:00+00','1:00 PM ET','FOX','AT&T Stadium','Dallas'),
(58,'J','Jordan','Algeria','🇯🇴','🇩🇿','2026-06-23 03:00:00+00','11:00 PM ET','FS1','Levi''s Stadium','San Francisco Bay'),
(59,'J','Jordan','Argentina','🇯🇴','🇦🇷','2026-06-28 02:00:00+00','10:00 PM ET','FOX','AT&T Stadium','Dallas'),
(60,'J','Algeria','Austria','🇩🇿','🇦🇹','2026-06-28 02:00:00+00','10:00 PM ET','TBD','Arrowhead Stadium','Kansas City'),
-- GROUP K
(61,'K','Portugal','Congo DR','🇵🇹','🇨🇩','2026-06-17 17:00:00+00','1:00 PM ET','FOX','NRG Stadium','Houston'),
(62,'K','Uzbekistan','Colombia','🇺🇿','🇨🇴','2026-06-18 02:00:00+00','10:00 PM ET','FS1','Estadio Azteca','Mexico City'),
(63,'K','Portugal','Uzbekistan','🇵🇹','🇺🇿','2026-06-23 17:00:00+00','1:00 PM ET','FOX','NRG Stadium','Houston'),
(64,'K','Colombia','Congo DR','🇨🇴','🇨🇩','2026-06-24 02:00:00+00','10:00 PM ET','FS1','Estadio Akron','Guadalajara'),
(65,'K','Portugal','Colombia','🇵🇹','🇨🇴','2026-06-27 00:00:00+00','TBD','TBD','TBD','TBD'),
(66,'K','Congo DR','Uzbekistan','🇨🇩','🇺🇿','2026-06-27 23:30:00+00','7:30 PM ET','FS1','Mercedes-Benz Stadium','Atlanta'),
-- GROUP L
(67,'L','England','Croatia','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇭🇷','2026-06-17 20:00:00+00','4:00 PM ET','FOX','AT&T Stadium','Dallas'),
(68,'L','Ghana','Panama','🇬🇭','🇵🇦','2026-06-17 23:00:00+00','7:00 PM ET','FS1','BMO Field','Toronto'),
(69,'L','England','Ghana','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇬🇭','2026-06-23 20:00:00+00','4:00 PM ET','FOX','Gillette Stadium','Boston'),
(70,'L','Panama','Croatia','🇵🇦','🇭🇷','2026-06-23 23:00:00+00','7:00 PM ET','FS1','BMO Field','Toronto'),
(71,'L','Panama','England','🇵🇦','🏴󠁧󠁢󠁥󠁮󠁧󠁿','2026-06-27 21:00:00+00','5:00 PM ET','FOX','MetLife Stadium','East Rutherford'),
(72,'L','Croatia','Ghana','🇭🇷','🇬🇭','2026-06-27 21:00:00+00','5:00 PM ET','FS1','Lincoln Financial Field','Philadelphia')
on conflict (match_number) do nothing;
