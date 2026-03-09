-- ============================================================
-- 007 — Marry Me, Mary! Wedding Chat Messages
-- Public table — no auth needed, secured via RLS + constraints
-- ============================================================

-- Main table
CREATE TABLE IF NOT EXISTS wedding_chat_messages (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id  integer     NOT NULL CHECK (mission_id BETWEEN 1 AND 5),
  pair_index  integer     NOT NULL CHECK (pair_index >= 0),
  side        text        NOT NULL CHECK (side IN ('left', 'right')),
  message     text        NOT NULL DEFAULT '' CHECK (char_length(message) <= 5000),
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,

  -- Prevent duplicate slots (same mission + pair + side)
  CONSTRAINT wedding_chat_unique_slot UNIQUE (mission_id, pair_index, side)
);

-- Index for fast per-mission queries
CREATE INDEX IF NOT EXISTS idx_wedding_chat_mission
  ON wedding_chat_messages (mission_id, pair_index, side);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE wedding_chat_messages ENABLE ROW LEVEL SECURITY;

-- Public read — anyone can view all messages
CREATE POLICY "wedding_select_public"
  ON wedding_chat_messages
  FOR SELECT
  USING (true);

-- Public insert — validated by column constraints
-- (empty message allowed on initial pair creation)
CREATE POLICY "wedding_insert_public"
  ON wedding_chat_messages
  FOR INSERT
  WITH CHECK (
    mission_id BETWEEN 1 AND 5
    AND char_length(message) <= 5000
  );

-- Public update — only non-empty messages can be saved
CREATE POLICY "wedding_update_public"
  ON wedding_chat_messages
  FOR UPDATE
  USING (true)
  WITH CHECK (
    char_length(message) >= 1
    AND char_length(message) <= 5000
  );

-- Public delete — anyone can remove their messages
CREATE POLICY "wedding_delete_public"
  ON wedding_chat_messages
  FOR DELETE
  USING (true);
