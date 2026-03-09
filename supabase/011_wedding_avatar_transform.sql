-- ============================================================
-- 011 — Add avatar position/scale settings
-- ============================================================

ALTER TABLE wedding_avatars
  ADD COLUMN IF NOT EXISTS avatar_pos_x integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS avatar_pos_y integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS avatar_scale integer NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wedding_avatars_pos_x_range'
  ) THEN
    ALTER TABLE wedding_avatars
      ADD CONSTRAINT wedding_avatars_pos_x_range
      CHECK (avatar_pos_x BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wedding_avatars_pos_y_range'
  ) THEN
    ALTER TABLE wedding_avatars
      ADD CONSTRAINT wedding_avatars_pos_y_range
      CHECK (avatar_pos_y BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wedding_avatars_scale_range'
  ) THEN
    ALTER TABLE wedding_avatars
      ADD CONSTRAINT wedding_avatars_scale_range
      CHECK (avatar_scale BETWEEN 50 AND 200);
  END IF;
END $$;

-- Update policy to include new constraints
DROP POLICY IF EXISTS "wedding_avatars_update_public" ON wedding_avatars;

CREATE POLICY "wedding_avatars_update_public"
  ON wedding_avatars FOR UPDATE
  USING (true)
  WITH CHECK (
    char_length(avatar_url) <= 2000
    AND avatar_pos_x BETWEEN 0 AND 100
    AND avatar_pos_y BETWEEN 0 AND 100
    AND avatar_scale BETWEEN 50 AND 200
  );
