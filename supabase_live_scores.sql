-- ═══════════════════════════════════════════════════════════════
-- FIFA 2026 — Live Scores Setup
-- Run this in the Supabase SQL Editor AFTER supabase_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Add status column to results
alter table results
  add column if not exists status text default 'finished'
  check (status in ('live', 'finished'));

-- 2. Enable extensions needed for scheduled HTTP calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3. Schedule the Edge Function to run every 2 minutes
--    (replace ANON_KEY with your actual anon key)
select cron.schedule(
  'sync-match-scores',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://xpklbljafyovtcaeipos.supabase.co/functions/v1/sync-scores',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwa2xibGphZnlvdnRjYWVpcG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDA5MDMsImV4cCI6MjA5NjE3NjkwM30.kX49e0laLKzFHYQO5s18vrRdJOboRTKIeOeDmtq-AYQ'
    ),
    body    := '{}'::jsonb
  ) as request_id
  $$
);

-- 4. To check scheduled jobs:  SELECT * FROM cron.job;
-- 5. To remove the job:        SELECT cron.unschedule('sync-match-scores');
