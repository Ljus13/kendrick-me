-- ============================================================
-- Fix: Add DELETE policies for game_rooms & game_board
-- Without these, no one (including admin) can delete rows
-- because RLS is enabled but no DELETE policy exists.
-- ============================================================

-- game_rooms: allow delete for both anon (players leaving) and authenticated (admin)
create policy "game_rooms: public delete"
  on public.game_rooms for delete
  to anon, authenticated
  using (true);

-- game_board: allow delete (cascading with room deletion, or manual cleanup)
create policy "game_board: public delete"
  on public.game_board for delete
  to anon, authenticated
  using (true);
