-- ============================================================
-- Migration 006: Expand slot_index range for larger bean counts
-- Old constraint: slot_index >= 0 AND slot_index <= 19 (only 20 beans)
-- New constraint: slot_index >= 0 AND slot_index <= 49 (up to 50 beans)
-- ============================================================

-- Drop the old check constraint on slot_index
ALTER TABLE game_board DROP CONSTRAINT IF EXISTS game_board_slot_index_check;

-- Add new constraint supporting up to 50 slots
ALTER TABLE game_board
  ADD CONSTRAINT game_board_slot_index_check CHECK (slot_index >= 0 AND slot_index <= 49);
