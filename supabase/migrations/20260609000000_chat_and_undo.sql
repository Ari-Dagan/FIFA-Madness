-- ── Pool Group Chat ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pool_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  message text NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 500),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pool_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS pool_messages_pool_created_idx
  ON pool_messages(pool_id, created_at ASC);

CREATE POLICY "messages_read_member" ON pool_messages
  FOR SELECT USING (
    pool_id IN (SELECT pool_id FROM pool_members WHERE user_id = auth.uid())
  );

CREATE POLICY "messages_insert_member" ON pool_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    pool_id IN (SELECT pool_id FROM pool_members WHERE user_id = auth.uid())
  );

-- ── Undo / Reset result ───────────────────────────────────────────

-- Allow authenticated admins to delete results (app layer enforces admin check)
CREATE POLICY "results_delete_auth" ON results
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RPC that deletes result AND un-grades all picks for the match.
-- Uses SECURITY DEFINER to bypass per-user picks RLS.
CREATE OR REPLACE FUNCTION reset_match_result(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM results WHERE match_id = p_match_id;
  UPDATE picks SET is_correct = NULL WHERE match_id = p_match_id;
END;
$$;

-- ── Enable realtime for pool_messages ────────────────────────────
-- Run in Supabase Dashboard → Database → Replication:
-- Enable replication for: pool_messages
