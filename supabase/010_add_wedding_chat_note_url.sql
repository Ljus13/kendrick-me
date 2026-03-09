-- ============================================================
-- 010 — Add note URL to wedding_chat_messages
-- ============================================================

ALTER TABLE wedding_chat_messages
  ADD COLUMN IF NOT EXISTS note_url text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wedding_chat_note_url_len'
  ) THEN
    ALTER TABLE wedding_chat_messages
      ADD CONSTRAINT wedding_chat_note_url_len
      CHECK (char_length(note_url) <= 2000);
  END IF;
END $$;

-- Update policies to include note_url length constraint
DROP POLICY IF EXISTS "wedding_insert_public" ON wedding_chat_messages;
DROP POLICY IF EXISTS "wedding_update_public" ON wedding_chat_messages;

CREATE POLICY "wedding_insert_public"
  ON wedding_chat_messages
  FOR INSERT
  WITH CHECK (
    mission_id BETWEEN 1 AND 5
    AND char_length(message) <= 5000
    AND char_length(note_url) <= 2000
  );

CREATE POLICY "wedding_update_public"
  ON wedding_chat_messages
  FOR UPDATE
  USING (true)
  WITH CHECK (
    char_length(message) >= 1
    AND char_length(message) <= 5000
    AND char_length(note_url) <= 2000
  );
