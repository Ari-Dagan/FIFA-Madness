# FIFA 2026 World Cup Pool — Project Spec

> Built for Fox Sports World Cup group stage pick'em pool.  
> Claude Code: read this top-to-bottom before writing a single line of code.

---

## 0. What This Is

A web app where a group of friends picks **W / L / Draw** for every group-stage match of the 2026 FIFA World Cup. Points are scored for correct picks. A leaderboard ranks all entrants. An admin ("the intern") manually enters real match results. No automated score ingestion required — but an optional live score API integration is described in Section 7.

Inspired by the attached 2023 WWC Excel sheet: each entrant fills out one row per game.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19+ (standalone components, no NgModules) + Angular Material |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email/password + magic link) |
| Hosting (FE) | Vercel |
| Hosting (BE) | Railway |
| Realtime | Supabase Realtime (for live leaderboard pushes) |

**New Supabase project and Vercel project** — standalone from TheAriLab.

---

## 2. Design System

### Colors (FIFA / World-themed)
```
Primary:        #1A1A2E  (deep navy)
Accent:         #C8102E  (FIFA red)
Gold:           #FFD700  (trophy gold)
Green pitch:    #00843D  (field green)
White:          #FFFFFF
Surface dark:   #16213E
Surface card:   #0F3460

Light mode equivalents:
Background:     #F5F5F5
Surface:        #FFFFFF
Text primary:   #1A1A2E
```

### Dark / Light Mode
- Toggle button fixed in **bottom-left corner of the nav sidebar** (moon/sun icon)
- Persisted in `localStorage`
- Use Angular CDK or a CSS class on `<body>` (`theme-dark` / `theme-light`)
- All Angular Material components use a custom theme for both modes

### Typography
- Headings: `'Bebas Neue'` or `'Oswald'` (Google Fonts — bold, sporty)
- Body: `'Inter'` or `'Roboto'`

### Worldly Aesthetic
- World map SVG as hero background (semi-transparent)
- Country flag emoji next to team names throughout
- Trophy / ball icons via Angular Material icons or a small SVG set
- Confetti animation on leaderboard rank-up (optional, phase 2)

---

## 3. Feature Scope

### Phase 1 — Core (Build This First)

#### 3.1 Auth
- Supabase Auth: email + password
- On first login, user sets their **display name** (stored in `profiles` table)
- No social login needed

#### 3.2 Group / Pool System
- Any authenticated user can **create a pool**
- Pool creator becomes the **admin**
- Pool has:
  - `name` (e.g., "Coakley & Friends 2026")
  - `join_code` — 6-char alphanumeric, auto-generated, shareable
  - `is_locked` — bool; admin locks picks before tournament starts; no edits after lock
  - `tiebreaker_mode` — enum: `'usa_goals'` | `'total_goals'` | `'none'`
  - `tiebreaker_value` — integer; each entrant submits their tiebreaker guess at pick time
- Users join a pool by entering the `join_code`
- One user can be in multiple pools
- One user can have **one bracket per pool** (their picks)

#### 3.3 Bracket / Picks Page
- Shows all 48 group-stage matches in chronological order (see Section 6 for full match list)
- Each match row shows:
  - Day + Date
  - Kick-off time (ET)
  - **Network badge**: `FOX` / `FS1` / `TUBI` (colored chips — FOX blue, FS1 orange, Tubi purple)
  - Home team (with flag emoji)
  - Away team (with flag emoji)
  - Segmented toggle: **[Home Win] [Draw] [Away Win]**
- Tiebreaker field at bottom (if pool has tiebreaker enabled)
- "Save Picks" button — saves to DB; allowed until pool is locked
- After pool lock: picks shown read-only, correct picks highlighted green, wrong = red, pending = grey

#### 3.4 Results Entry (Admin Only)
- Separate page: `/admin/results/:poolId`
- Only accessible if `user.id === pool.admin_id`
- Same match list, but each row has:
  - Result dropdown: **[Home Win] [Draw] [Away Win]**
  - Score inputs: `home_score` (int) and `away_score` (int)
- "Save Result" per match (or bulk save)
- Saving a result triggers leaderboard recalculation for all entrants in that pool

#### 3.5 Leaderboard
- Page: `/pool/:poolId/leaderboard`
- Table columns: Rank | Name | Correct Picks | Total Picks Entered | Tiebreaker Guess
- Sorted by `correct_picks DESC`, tiebreaker as fallback sort
- **Live updates** via Supabase Realtime subscription on `picks` / `results` tables
- Highlight the logged-in user's row
- Show total possible points remaining (games without results yet)
- Medal icons for top 3 (🥇🥈🥉)

#### 3.6 Matches / Scores Page
- Page: `/pool/:poolId/scores`
- Shows all matches with results filled in so far
- Unentered results show "TBD"
- Filterable by group (A–L) and date

### Phase 2 — Nice to Have (After Phase 1 Works)
- Email notification when results are entered
- Per-entrant pick breakdown (click a name on leaderboard → see all their picks vs actuals)
- Mobile-responsive layout (flex stack, touch-friendly dropdowns)
- Optional live score API feed (see Section 7)

---

## 4. Database Schema

```sql
-- Supabase: enable RLS on all tables

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text unique not null,
  admin_id uuid references profiles(id),
  is_locked boolean default false,
  tiebreaker_mode text default 'none',     -- 'usa_goals' | 'total_goals' | 'none'
  created_at timestamptz default now()
);

create table pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  tiebreaker_value integer,
  joined_at timestamptz default now(),
  unique(pool_id, user_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  match_number integer unique not null,
  group_letter char(1) not null,
  home_team text not null,
  away_team text not null,
  home_team_flag text,                     -- emoji e.g. '🇲🇽'
  away_team_flag text,
  kickoff_utc timestamptz not null,
  kickoff_et text not null,               -- display string e.g. '3:00 PM ET'
  network text not null,                   -- 'FOX' | 'FS1' | 'TUBI'
  venue text,
  city text
);

create table results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id) on delete cascade,
  home_score integer,
  away_score integer,
  outcome text,                            -- 'home' | 'draw' | 'away'
  entered_by uuid references profiles(id),
  entered_at timestamptz default now()
);

create table picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  pick text not null,                      -- 'home' | 'draw' | 'away'
  is_correct boolean,                      -- null until result entered
  updated_at timestamptz default now(),
  unique(pool_id, user_id, match_id)
);

-- Leaderboard view
create view leaderboard as
select
  pm.pool_id,
  p.id as user_id,
  p.display_name,
  pm.tiebreaker_value,
  count(*) filter (where pk.is_correct = true) as correct_picks,
  count(*) filter (where pk.pick is not null) as total_picks,
  rank() over (partition by pm.pool_id order by count(*) filter (where pk.is_correct = true) desc) as rank
from pool_members pm
join profiles p on p.id = pm.user_id
left join picks pk on pk.user_id = pm.user_id and pk.pool_id = pm.pool_id
group by pm.pool_id, p.id, p.display_name, pm.tiebreaker_value;

-- RLS policies:
-- profiles: users can read all, update their own
-- pools: members can read their pool, admin can update
-- picks: users can read/write their own picks within non-locked pools
-- results: pool admin can insert/update; all pool members can read
-- matches: public read
```

---

## 5. API Endpoints (FastAPI)

Base URL: `https://fifa2026-api.railway.app`

All endpoints require `Authorization: Bearer <supabase_jwt>` unless marked public.

```
GET    /health                          — public health check

POST   /pools                           — create pool
GET    /pools/:poolId                   — get pool details
POST   /pools/join                      — join pool by join_code
GET    /pools/:poolId/members           — list members

GET    /matches                         — all 48 matches (public)
GET    /matches/:matchId                — single match

GET    /pools/:poolId/picks             — current user's picks
POST   /pools/:poolId/picks             — save/upsert picks [{match_id, pick}]
GET    /pools/:poolId/picks/all         — admin only: all member picks

POST   /results/:matchId                — admin only: enter result
PATCH  /results/:matchId                — admin only: update result

GET    /pools/:poolId/leaderboard       — ranked leaderboard
```

---

## 6. Complete Group Stage Match Data (Seed This)

Seed the `matches` table on first deploy. All times ET. Networks confirmed from Fox Sports broadcast schedule.

**Note on Tubi:** Only 2 matches simulcast on Tubi (free, no login): Mexico vs South Africa (Jun 11) and USA vs Paraguay (Jun 12). All other matches are FOX or FS1 only. Use `'FOX/TUBI'` and `'FOX'` network values accordingly, or add a separate `tubi_simulcast boolean` column.

```
GROUP A: Mexico, South Korea, Czechia, South Africa
  1  Jun 11  3:00 PM    Mexico vs South Africa        FOX+TUBI  Estadio Azteca, Mexico City
  2  Jun 11  10:00 PM   South Korea vs Czechia         FS1       Estadio Akron, Guadalajara
  3  Jun 18  12:00 PM   Czechia vs South Africa        FOX       Mercedes-Benz Stadium, Atlanta
  4  Jun 18  9:00 PM    Mexico vs South Korea           FOX       Estadio Akron, Guadalajara
  5  Jun 27  TBD        Mexico vs Czechia               TBD       TBD
  6  Jun 27  TBD        South Africa vs South Korea    TBD       TBD

GROUP B: Canada, Qatar, Switzerland, Bosnia and Herzegovina
  7  Jun 12  3:00 PM    Canada vs Bosnia and Herzegovina  FOX    BMO Field, Toronto
  8  Jun 13  3:00 PM    Qatar vs Switzerland               FOX    Levi's Stadium, San Francisco Bay
  9  Jun 18  3:00 PM    Switzerland vs Bosnia and Herzegovina  FOX  SoFi Stadium, Los Angeles
  10 Jun 18  6:00 PM    Canada vs Qatar                    FS1    BC Place, Vancouver
  11 Jun 27  TBD        Canada vs Switzerland              TBD    TBD
  12 Jun 27  TBD        Bosnia and Herzegovina vs Qatar    TBD    TBD

GROUP C: Brazil, Morocco, Haiti, Scotland
  13 Jun 13  6:00 PM    Brazil vs Morocco                  FS1    MetLife Stadium, East Rutherford
  14 Jun 13  9:00 PM    Haiti vs Scotland                  FS1    Gillette Stadium, Boston
  15 Jun 19  3:00 PM    Scotland vs Morocco                FOX    Gillette Stadium, Boston
  16 Jun 19  9:00 PM    Brazil vs Haiti                    FOX    Lincoln Financial Field, Philadelphia
  17 Jun 27  TBD        Brazil vs Scotland                 TBD    TBD
  18 Jun 27  TBD        Morocco vs Haiti                   TBD    TBD

GROUP D: USA, Australia, Paraguay, Türkiye
  19 Jun 12  9:00 PM    USA vs Paraguay                    FOX+TUBI  SoFi Stadium, Los Angeles
  20 Jun 13  12:00 AM   Australia vs Türkiye               FOX    BC Place, Vancouver
  21 Jun 19  3:00 PM    USA vs Australia                   FOX    Lumen Field, Seattle
  22 Jun 19  12:00 AM   Türkiye vs Paraguay                FS1    Levi's Stadium, San Francisco Bay
  23 Jun 25  10:00 PM   Türkiye vs USA                     FOX    SoFi Stadium, Los Angeles
  24 Jun 25  10:00 PM   Paraguay vs Australia              FS1    Levi's Stadium, Santa Clara

GROUP E: Germany, Ivory Coast, Ecuador, Curaçao
  25 Jun 14  1:00 PM    Germany vs Curaçao                 FOX    NRG Stadium, Houston
  26 Jun 14  7:00 PM    Ivory Coast vs Ecuador             FS1    Lincoln Financial Field, Philadelphia
  27 Jun 20  4:00 PM    Germany vs Ivory Coast             FOX    BMO Field, Toronto
  28 Jun 20  8:00 PM    Ecuador vs Curaçao                 FS1    Arrowhead Stadium, Kansas City
  29 Jun 25  4:00 PM    Ecuador vs Germany                 FOX    MetLife Stadium, East Rutherford
  30 Jun 25  4:00 PM    Curaçao vs Ivory Coast             FS1    Lincoln Financial Field, Philadelphia

GROUP F: Netherlands, Japan, Sweden, Tunisia
  31 Jun 14  4:00 PM    Netherlands vs Japan               FOX    AT&T Stadium, Dallas
  32 Jun 14  10:00 PM   Tunisia vs Sweden                  FS1    Estadio BBVA, Monterrey
  33 Jun 20  1:00 PM    Netherlands vs Sweden              FOX    NRG Stadium, Houston
  34 Jun 20  12:00 AM   Tunisia vs Japan                   FS1    Estadio BBVA, Monterrey
  35 Jun 25  7:00 PM    Tunisia vs Netherlands             FOX    Arrowhead Stadium, Kansas City
  36 Jun 25  7:00 PM    Japan vs Sweden                    FS1    AT&T Stadium, Arlington

GROUP G: Belgium, Egypt, Iran, New Zealand
  37 Jun 15  3:00 PM    Belgium vs Egypt                   FOX    Lumen Field, Seattle
  38 Jun 15  9:00 PM    Iran vs New Zealand                FS1    SoFi Stadium, Los Angeles
  39 Jun 21  3:00 PM    Belgium vs Iran                    FS1    SoFi Stadium, Los Angeles
  40 Jun 21  9:00 PM    New Zealand vs Egypt               FS1    BC Place, Vancouver
  41 Jun 26  11:00 PM   New Zealand vs Belgium             FOX    BC Place, Vancouver
  42 Jun 26  11:00 PM   Egypt vs Iran                      FS1    Lumen Field, Seattle

GROUP H: Spain, Saudi Arabia, Uruguay, Cape Verde
  43 Jun 15  12:00 PM   Spain vs Cape Verde                FOX    Mercedes-Benz Stadium, Atlanta
  44 Jun 15  6:00 PM    Saudi Arabia vs Uruguay            FS1    Hard Rock Stadium, Miami
  45 Jun 21  12:00 PM   Spain vs Saudi Arabia              FOX    Mercedes-Benz Stadium, Atlanta
  46 Jun 21  6:00 PM    Uruguay vs Cape Verde              FS1    Hard Rock Stadium, Miami
  47 Jun 26  8:00 PM    Uruguay vs Spain                   FOX    Estadio Akron, Zapopan
  48 Jun 26  8:00 PM    Cape Verde vs Saudi Arabia         FS1    NRG Stadium, Houston

GROUP I: France, Senegal, Iraq, Norway
  49 Jun 16  3:00 PM    France vs Senegal                  FOX    MetLife Stadium, East Rutherford
  50 Jun 16  6:00 PM    Iraq vs Norway                     FOX    Gillette Stadium, Boston
  51 Jun 22  5:00 PM    France vs Iraq                     FOX    Lincoln Financial Field, Philadelphia
  52 Jun 22  8:00 PM    Norway vs Senegal                  FOX    MetLife Stadium, East Rutherford
  53 Jun 26  3:00 PM    Norway vs France                   FOX    Gillette Stadium, Boston
  54 Jun 26  3:00 PM    Senegal vs Iraq                    FS1    BMO Field, Toronto

GROUP J: Argentina, Algeria, Austria, Jordan
  55 Jun 16  9:00 PM    Argentina vs Algeria               FOX    Arrowhead Stadium, Kansas City
  56 Jun 16  12:00 AM   Austria vs Jordan                  FS1    Levi's Stadium, San Francisco Bay
  57 Jun 22  1:00 PM    Argentina vs Austria               FOX    AT&T Stadium, Dallas
  58 Jun 22  11:00 PM   Jordan vs Algeria                  FS1    Levi's Stadium, San Francisco Bay
  59 Jun 27  10:00 PM   Jordan vs Argentina                FOX    AT&T Stadium, Dallas
  60 Jun 27  10:00 PM   Algeria vs Austria                 TBD    Arrowhead Stadium, Kansas City

GROUP K: Portugal, Congo DR, Uzbekistan, Colombia
  61 Jun 17  1:00 PM    Portugal vs Congo DR               FOX    NRG Stadium, Houston
  62 Jun 17  10:00 PM   Uzbekistan vs Colombia             FS1    Estadio Azteca, Mexico City
  63 Jun 23  1:00 PM    Portugal vs Uzbekistan             FOX    NRG Stadium, Houston
  64 Jun 23  10:00 PM   Colombia vs Congo DR               FS1    Estadio Akron, Guadalajara
  65 Jun 27  TBD        Portugal vs Colombia               TBD    TBD
  66 Jun 27  7:30 PM    Congo DR vs Uzbekistan             FS1    Mercedes-Benz Stadium, Atlanta

GROUP L: England, Croatia, Ghana, Panama
  67 Jun 17  4:00 PM    England vs Croatia                 FOX    AT&T Stadium, Dallas
  68 Jun 17  7:00 PM    Ghana vs Panama                    FS1    BMO Field, Toronto
  69 Jun 23  4:00 PM    England vs Ghana                   FOX    Gillette Stadium, Boston
  70 Jun 23  7:00 PM    Panama vs Croatia                  FS1    BMO Field, Toronto
  71 Jun 27  5:00 PM    Panama vs England                  FOX    MetLife Stadium, East Rutherford
  72 Jun 27  5:00 PM    Croatia vs Ghana                   FS1    Lincoln Financial Field, Philadelphia
```

> ⚠️ June 27 matchday-3 simultaneous games: confirm exact kickoff times and network assignments closer to tournament. The data above is correct for matchdays 1 and 2; some matchday 3 slots are placeholders. Cross-reference the Fox Sports broadcast page before final deploy: https://www.foxsports.com/stories/soccer/2026-world-cup-schedule-all-games-dates-matchups-how-watch

---

## 7. Live Score API Options (Optional Enhancement)

The primary flow is **manual result entry by the admin**. If you want to add a live score feed so the scores page auto-updates during matches, here are the best options:

### Option A: Free — football-data.org (Recommended for Phase 2)
- **Free tier**: 10 calls/minute, includes World Cup
- **Endpoint**: `GET https://api.football-data.org/v4/competitions/WC/matches`
- **Requires**: Free API key from football-data.org
- **Use case**: Poll every 60s during match windows, update `results` table automatically
- **Note**: Rate limits will be stressed during simultaneous games — add Redis caching

### Option B: Free with limits — API-Football (RapidAPI)
- **Free tier**: 100 requests/day — enough for polling if you're smart about it
- **League ID**: `league=1`, `season=2026`
- **Docs**: https://www.api-football.com
- **Note**: 100/day will run out fast during live matches; consider paid tier ($10-20/mo) for tournament duration

### Option C: Free & open source — github.com/rezarahiminia/worldcup2026
- Community-maintained REST API specifically for 2026 WC
- Completely free, open source
- Good for fixtures/standings; real-time reliability less guaranteed than commercial options
- **Best for**: seeding the matches table and schedule data

### Recommendation
- **Seeding matches table**: Use Option C or just hardcode from Section 6 above
- **Live scores during tournament**: football-data.org free tier with smart polling (only poll when a match is in-progress based on kickoff times)
- **Admin manual entry stays primary** — the API integration is purely additive for the scores display page, not the picks/leaderboard system

### FastAPI polling service (if implementing)
```python
# Add to FastAPI: background task that polls during active match windows
# Only poll when current UTC time is within 2h of a match kickoff
# Cache results in Supabase; don't poll if result already entered manually
```

---

## 8. Frontend Routes

```
/                        — landing page (join or create pool, hero banner)
/auth/login              — login / signup
/auth/register           — register + set display name
/pool/create             — create new pool
/pool/join               — enter join code
/pool/:poolId            — pool home (your picks status, leaderboard teaser)
/pool/:poolId/picks      — your bracket / picks entry
/pool/:poolId/leaderboard — full leaderboard
/pool/:poolId/scores     — match results / scores tracker
/admin/results/:poolId   — admin results entry (guarded route)
```

---

## 9. Angular Project Structure

```
src/
  app/
    core/
      services/
        supabase.service.ts
        auth.service.ts
        pool.service.ts
        match.service.ts
        picks.service.ts
        results.service.ts
        leaderboard.service.ts
      guards/
        auth.guard.ts
        admin.guard.ts
      models/
        pool.model.ts
        match.model.ts
        pick.model.ts
        result.model.ts
        leaderboard.model.ts
    shared/
      components/
        nav/                      — sidebar nav + dark mode toggle (bottom-left)
        flag-chip/                — flag emoji + team name
        network-badge/            — FOX / FS1 / TUBI colored chip
        pick-toggle/              — W / D / L segmented control
        leaderboard-table/        — reusable table
    features/
      landing/
      auth/
      pool-home/
      picks/
      leaderboard/
      scores/
      admin-results/
  environments/
    environment.ts
    environment.prod.ts
  theme/
    _variables.scss
    _dark-theme.scss
    _light-theme.scss
    _fifa-theme.scss
```

---

## 10. Key Component Details

### `pick-toggle` component
- Three-button segmented control: `[🇲🇽 Mexico]  [Draw]  [🇿🇦 South Africa]`
- Selected state: accent color background
- Disabled state (after pool lock): greyed out; correct pick = green, wrong = red, pending = grey
- Emits `(pickChange): 'home' | 'draw' | 'away'`

### `network-badge` component
- Input: `network: 'FOX' | 'FS1' | 'TUBI'`
- FOX: `#003087` blue chip
- FS1: `#E87722` orange chip
- Tubi: `#7B2FBE` purple chip
- Small inline badge — fits in match row

### `nav` component
- Left sidebar (collapsible on mobile)
- Logo: ⚽ "WC 2026 Pool"
- Links: Home, My Picks, Leaderboard, Scores, Admin Results (admin only)
- **Bottom-left corner**: dark/light mode toggle (🌙 / ☀️ icon button)

### Leaderboard live update
```typescript
this.supabase
  .channel('leaderboard-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, () => {
    this.refreshLeaderboard(poolId);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => {
    this.refreshLeaderboard(poolId);
  })
  .subscribe();
```

---

## 11. Environment Variables

### Angular (`environment.ts`)
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  apiBaseUrl: 'http://localhost:8000'
};
```

### FastAPI (`.env`)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
ENVIRONMENT=development
FOOTBALL_DATA_API_KEY=        # optional, for live score polling
```

---

## 12. Scoring Logic

```
1 point per correct pick (home win / draw / away win matches actual result)
0 points for incorrect or not-yet-entered results
Tiebreaker: closest guess to actual USA group-stage goals total (or total goals, per pool setting)
  — used only to break ties; does not add points
```

When a result is entered via `POST /results/:matchId`:
1. Compute `outcome` from `home_score` vs `away_score`
2. Look up all picks for that match across all pools
3. Compare `pick` to `outcome` → set `picks.is_correct`
4. Leaderboard view recalculates automatically

---

## 13. Coding Standards

- **TypeScript**: No `any`; use `unknown` + narrowing for external data
- **Immutability**: Always return new objects/arrays — never mutate in place
- **File size**: 200–400 lines typical, 800 max
- **Functions**: < 50 lines, < 4 nesting levels
- **No `console.log`** in production code
- **No hardcoded secrets** — env vars only
- **Python**: Specific exception types only, type hints on all public functions
- **Angular**: Standalone components, `inject()` function, signals where appropriate
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `refactor:`

---

## 14. Setup Order for Claude Code

1. Scaffold Angular: `ng new fifa2026-pool --standalone --routing --style=scss`
2. Install deps: `@supabase/supabase-js`, `@angular/material`, Google Fonts (Bebas Neue, Inter)
3. Create Supabase project → run SQL schema from Section 4
4. Seed `matches` table from Section 6
5. Set up FastAPI with folder structure + `.env`
6. Build in this order:
   - Core services (supabase, auth)
   - Auth pages (login/register)
   - Pool create + join flow
   - Picks entry page ← core feature, build this well
   - Admin results entry
   - Leaderboard (static first, then Realtime)
   - Scores page
   - Dark/light theme + nav polish
7. Deploy FE to Vercel, BE to Railway

---

## 15. What We're NOT Building (Scope Boundary)

- No knockout bracket prediction (group stage only)
- No automated score ingestion required (manual admin entry is primary)
- No payment / prize pool tracking
- No mobile app (responsive web is sufficient)
- No social login (email only)
