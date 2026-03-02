// ============================================================
// Leaderboard Store — Phase 5: Auto-save & Stats
// Upsert scores to global_leaderboard, fetch top/recent
// ============================================================
import { createSignal } from "solid-js";
import { supabase } from "../lib/supabase";
import type { LeaderboardEntry, Player } from "../types/database";

// ── State ────────────────────────────────────────────────────

const [topScores, setTopScores] = createSignal<LeaderboardEntry[]>([]);
const [recentPlayers, setRecentPlayers] = createSignal<LeaderboardEntry[]>([]);
const [statsLoading, setStatsLoading] = createSignal(false);
const [leaderboardSaved, setLeaderboardSaved] = createSignal(false);

// ── Save All Players' Scores ────────────────────────────────

/**
 * Upsert each player's score into global_leaderboard.
 * - If player_name exists → accumulate total_score & games_played, update best_score if higher
 * - If new → insert fresh row
 *
 * Called once when game ends (from Game.tsx).
 */
async function saveGameToLeaderboard(rankedPlayers: Player[]): Promise<void> {
  if (leaderboardSaved()) return; // prevent double-save

  for (const player of rankedPlayers) {
    // Check if player already has a leaderboard entry
    const { data: existing } = await supabase
      .from("global_leaderboard")
      .select("*")
      .eq("player_name", player.name)
      .maybeSingle();

    if (existing) {
      // Accumulate
      const newTotal = (existing.total_score ?? 0) + player.score;
      const newGames = (existing.games_played ?? 0) + 1;
      const prevBest = existing.best_score ?? -Infinity;
      const newBest = Math.max(prevBest, player.score);

      await supabase
        .from("global_leaderboard")
        .update({
          total_score: newTotal,
          games_played: newGames,
          best_score: newBest,
          last_played: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Insert new entry
      await supabase.from("global_leaderboard").insert({
        player_name: player.name,
        total_score: player.score,
        games_played: 1,
        best_score: player.score,
        last_played: new Date().toISOString(),
      });
    }
  }

  setLeaderboardSaved(true);
}

/** Reset saved flag (call when starting new game / navigating away) */
function resetLeaderboardSaved(): void {
  setLeaderboardSaved(false);
}

// ── Fetch Stats ─────────────────────────────────────────────

/** Fetch top N players by best_score (all-time high scores) */
async function fetchTopScores(limit: number = 50): Promise<void> {
  setStatsLoading(true);
  const { data, error } = await supabase
    .from("global_leaderboard")
    .select("*")
    .order("best_score", { ascending: false })
    .limit(limit);

  if (!error && data) {
    setTopScores(data as LeaderboardEntry[]);
  }
  setStatsLoading(false);
}

/** Fetch recent players (most recently played) */
async function fetchRecentPlayers(limit: number = 20): Promise<void> {
  setStatsLoading(true);
  const { data, error } = await supabase
    .from("global_leaderboard")
    .select("*")
    .order("last_played", { ascending: false })
    .limit(limit);

  if (!error && data) {
    setRecentPlayers(data as LeaderboardEntry[]);
  }
  setStatsLoading(false);
}

// ── Exports ─────────────────────────────────────────────────

export {
  // State
  topScores,
  recentPlayers,
  statsLoading,
  leaderboardSaved,
  // Actions
  saveGameToLeaderboard,
  resetLeaderboardSaved,
  fetchTopScores,
  fetchRecentPlayers,
};
