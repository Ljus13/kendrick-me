-- ============================================================
-- Migration 005: Add bean_count column to game_rooms
-- Allows configurable bean count per room (20/30/40/50)
-- Default 20 for backward compatibility with existing rooms
-- ============================================================

ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS bean_count integer NOT NULL DEFAULT 20;

-- Add check constraint for valid values
ALTER TABLE game_rooms
  ADD CONSTRAINT chk_bean_count CHECK (bean_count IN (20, 30, 40, 50));
