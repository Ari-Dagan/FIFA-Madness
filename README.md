# FIFA-Madness

An Angular app for a 2026 World Cup group-stage pick'em pool. Friends create or join pools, make match picks, compare results on a leaderboard, and use pool chat. Pool admins can enter scores. The project uses Supabase for auth and data.

## What is in the repo
- `frontend/`: Angular 21 and Angular Material app with routes for registration, pools, picks, leaderboards, scores, chat, and admin results.
- `supabase/` and root SQL files: database setup.
- `SETUP.md`: local and deployment steps.

## Run locally
```bash
cd frontend
npm install
npm start
```
Open `http://localhost:4200`. You will need your own Supabase project and matching schema before account and pool features work. Review `SETUP.md` and replace the project configuration for your environment. Do not reuse the repository's project settings for a new deployment.

## Status
This is a personal project. The repo includes a project specification in `FIFA2026_POOL_SPEC.md`; the app code and setup files, rather than that spec, are the source for what is implemented.
