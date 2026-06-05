# FIFA 2026 Pool — Setup Guide

## 1. Supabase Setup (one-time)

1. Go to your Supabase project: https://xpklbljafyovtcaeipos.supabase.co
2. Open the **SQL Editor**
3. Paste and run the contents of `supabase_schema.sql` (in this repo root)
   - This creates all tables, the leaderboard view, RLS policies, and seeds all 72 matches
4. Go to **Database → Replication** and enable replication for the `picks` and `results` tables (needed for live leaderboard)

## 2. Run Locally

```bash
cd frontend
npm install
npm start
# App available at http://localhost:4200
```

## 3. Deploy to Vercel

```bash
cd frontend
npm run build
# Push to GitHub → import repo in Vercel → set root to "frontend"
```

No environment variables needed in Vercel — keys are baked into the environment files for now.

## 4. How to Use

### Create a Pool
1. Sign up at `/auth/register`
2. Go to **Create Pool** → name it, choose tiebreaker
3. Share the 6-character join code with friends

### Enter Results (Admin)
1. Go to **Admin Results** in the sidebar (only visible to pool admin)
2. Enter home and away scores for each match
3. Hit **Save** — picks are graded instantly, leaderboard updates live

### Leaderboard Features
- **Max Possible Points**: how high each player can still score (their correct picks + pending ungraded picks)
- **Still In It?**: ✓ if they can mathematically still win, ✗ if eliminated
- **Live updates**: leaderboard auto-refreshes whenever new results are entered
