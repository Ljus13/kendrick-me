-- ============================================================
-- 008 — Marry Me, Mary! Avatar Settings
-- Global avatar URLs for left (blue) and right (pink) persons
-- ============================================================

CREATE TABLE IF NOT EXISTS wedding_avatars (
  side        text  PRIMARY KEY CHECK (side IN ('left', 'right')),
  avatar_url  text  NOT NULL DEFAULT '' CHECK (char_length(avatar_url) <= 2000),
  updated_at  timestamptz DEFAULT now() NOT NULL
);

-- Seed default rows so upsert always has a target
INSERT INTO wedding_avatars (side, avatar_url)
VALUES ('left', ''), ('right', '')
ON CONFLICT (side) DO NOTHING;

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE wedding_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wedding_avatars_select_public"
  ON wedding_avatars FOR SELECT USING (true);

CREATE POLICY "wedding_avatars_update_public"
  ON wedding_avatars FOR UPDATE
  USING (true)
  WITH CHECK (char_length(avatar_url) <= 2000);
