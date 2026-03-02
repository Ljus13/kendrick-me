-- ============================================================
-- Enable Supabase Realtime for game tables
-- Run this in Supabase SQL Editor AFTER 001 & 002
-- Without this, postgres_changes listeners won't fire!
-- ============================================================

-- Enable Realtime for game_rooms (player updates, status changes)
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;

-- Enable Realtime for game_board (bean reveal sync)
ALTER PUBLICATION supabase_realtime ADD TABLE game_board;
