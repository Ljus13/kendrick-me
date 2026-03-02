// ============================================================
// Stats Page — Phase 5: Public Leaderboard
// Route: /stats
// Top scores (all-time) + Recent players
// ============================================================
import { createSignal, onMount, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  topScores,
  recentPlayers,
  statsLoading,
  fetchTopScores,
  fetchRecentPlayers,
} from "../stores/leaderboardStore";
import type { LeaderboardEntry } from "../types/database";

export default function Stats() {
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<"top" | "recent">("top");

  onMount(async () => {
    await Promise.all([fetchTopScores(50), fetchRecentPlayers(20)]);
  });

  const rankMedal = (i: number): string => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <main class="min-h-screen bg-[#10141d] bg-parchment text-[#b1a59a] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div class="text-center mb-6">
        <div class="text-5xl mb-2">🏆</div>
        <h1 class="text-2xl sm:text-3xl font-display font-bold text-amber-400">
          สถิติ & ลีดเดอร์บอร์ด
        </h1>
        <p class="text-sm opacity-50 mt-1">
          Bertie Bott's Every Flavour Beans
        </p>
      </div>

      {/* Tab switcher */}
      <div class="flex gap-2 mb-6">
        <button
          onClick={() => setTab("top")}
          class={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            tab() === "top"
              ? "bg-amber-600/80 text-white"
              : "bg-[#151723] text-[#b1a59a]/60 hover:text-[#b1a59a]"
          }`}
        >
          🏅 Top Scores
        </button>
        <button
          onClick={() => setTab("recent")}
          class={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            tab() === "recent"
              ? "bg-amber-600/80 text-white"
              : "bg-[#151723] text-[#b1a59a]/60 hover:text-[#b1a59a]"
          }`}
        >
          🕐 เล่นล่าสุด
        </button>
      </div>

      {/* Loading */}
      <Show when={statsLoading()}>
        <div class="text-center opacity-50 py-12">
          <div class="text-3xl mb-2 animate-bounce">⏳</div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      </Show>

      {/* Top Scores Tab */}
      <Show when={!statsLoading() && tab() === "top"}>
        <div class="w-full max-w-lg space-y-2">
          <Show
            when={topScores().length > 0}
            fallback={
              <div class="text-center opacity-40 py-12">
                <div class="text-3xl mb-2">📭</div>
                <p>ยังไม่มีข้อมูลสถิติ</p>
              </div>
            }
          >
            {/* Header */}
            <div class="flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-40">
              <span class="w-10 text-center">#</span>
              <span class="flex-1">ชื่อผู้เล่น</span>
              <span class="w-16 text-right">Best</span>
              <span class="w-16 text-right">Total</span>
              <span class="w-12 text-right">เล่น</span>
            </div>

            <For each={topScores()}>
              {(entry: LeaderboardEntry, i) => (
                <div
                  class={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    i() < 3
                      ? "bg-amber-500/10 border border-amber-500/20"
                      : "bg-[#151723]/60"
                  }`}
                >
                  {/* Rank */}
                  <span class="w-10 text-center text-lg font-bold">
                    {rankMedal(i())}
                  </span>

                  {/* Name */}
                  <span class="flex-1 font-medium truncate">
                    {entry.player_name}
                  </span>

                  {/* Best Score */}
                  <span
                    class={`w-16 text-right font-mono font-bold ${
                      (entry.best_score ?? 0) >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {entry.best_score ?? 0}
                  </span>

                  {/* Total Score */}
                  <span class="w-16 text-right font-mono text-sm opacity-60">
                    {entry.total_score}
                  </span>

                  {/* Games */}
                  <span class="w-12 text-right text-sm opacity-40">
                    {entry.games_played}
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Recent Players Tab */}
      <Show when={!statsLoading() && tab() === "recent"}>
        <div class="w-full max-w-lg space-y-2">
          <Show
            when={recentPlayers().length > 0}
            fallback={
              <div class="text-center opacity-40 py-12">
                <div class="text-3xl mb-2">📭</div>
                <p>ยังไม่มีข้อมูลการเล่น</p>
              </div>
            }
          >
            {/* Header */}
            <div class="flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-40">
              <span class="flex-1">ชื่อผู้เล่น</span>
              <span class="w-16 text-right">Best</span>
              <span class="w-12 text-right">เล่น</span>
              <span class="w-28 text-right">เมื่อ</span>
            </div>

            <For each={recentPlayers()}>
              {(entry: LeaderboardEntry) => (
                <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#151723]/60">
                  {/* Name */}
                  <span class="flex-1 font-medium truncate">
                    {entry.player_name}
                  </span>

                  {/* Best Score */}
                  <span
                    class={`w-16 text-right font-mono font-bold ${
                      (entry.best_score ?? 0) >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {entry.best_score ?? 0}
                  </span>

                  {/* Games */}
                  <span class="w-12 text-right text-sm opacity-40">
                    {entry.games_played}
                  </span>

                  {/* Last played */}
                  <span class="w-28 text-right text-xs opacity-40">
                    {formatDate(entry.last_played)}
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      {/* Back button */}
      <div class="mt-8">
        <button
          onClick={() => navigate("/")}
          class="px-6 py-3 rounded-lg bg-[#151723] border border-[#b1a59a]/20
                 hover:border-[#b1a59a]/40 font-bold transition-all"
        >
          🏠 กลับหน้าหลัก
        </button>
      </div>
    </main>
  );
}
