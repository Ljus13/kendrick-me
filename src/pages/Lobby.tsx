// ============================================================
// Lobby Page — Realtime player list, Ready toggle, Dice roll
// Route: /lobby/:code
// ============================================================
import { createSignal, createEffect, onCleanup, Show, For, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { sessionId, nickname } from "../stores/playerStore";
import type { Player } from "../types/database";
import {
  room,
  players,
  error,
  loading,
  diceResults,
  myPlayer,
  isHost,
  allReady,
  canStart,
  isRoomExpired,
  joinRoom,
  subscribeToRoom,
  toggleReady,
  startGame,
  leaveRoom,
  cleanup,
  connectionStatus,
} from "../stores/roomStore";
import { MIN_PLAYERS, MAX_PLAYERS } from "../lib/roomHelpers";

export default function Lobby() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = createSignal(false);
  const [showDice, setShowDice] = createSignal(false);

  // ── Initialize: join room + subscribe ──────────────────────
  onMount(async () => {
    // Redirect if no nickname
    if (!nickname() || nickname().length < 2) {
      navigate("/", { replace: true });
      return;
    }

    const ok = await joinRoom(params.code);
    if (!ok) return;

    const r = room();
    if (r) {
      // Check room expiry (2h max)
      if (isRoomExpired(r)) {
        cleanup();
        navigate("/", { replace: true });
        return;
      }
      subscribeToRoom(r.id);
    }
  });

  // ── Watch for game start → navigate to /game/:code ─────────
  createEffect(() => {
    const r = room();
    if (r?.status === "playing") {
      navigate(`/game/${params.code}`, { replace: true });
    }
  });

  // ── Watch dice results for animation ───────────────────────
  createEffect(() => {
    if (diceResults()) {
      setShowDice(true);
      setTimeout(() => setShowDice(false), 3000);
    }
  });

  // ── Cleanup on leave ───────────────────────────────────────
  onCleanup(() => {
    // Don't auto-leave just because component unmounts (navigation)
  });

  async function handleLeave() {
    await leaveRoom();
    navigate("/", { replace: true });
  }

  function copyCode() {
    navigator.clipboard.writeText(params.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleStart() {
    await startGame();
  }

  // ── Player status badges ───────────────────────────────────
  function playerEmoji(index: number): string {
    const emojis = ["🧙‍♂️", "🧙‍♀️", "🧝", "🧛"];
    return emojis[index] || "🎭";
  }

  return (
    <main class="min-h-screen bg-[#10141d] bg-parchment text-[#b1a59a] flex items-center justify-center p-4">
      <div class="w-full max-w-lg space-y-6">
        {/* ── Connection Status Banner ────────────── */}
        <Show when={connectionStatus() !== "connected"}>
          <div
            class={`text-center text-sm font-medium py-2 px-4 rounded-lg ${
              connectionStatus() === "reconnecting"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {connectionStatus() === "reconnecting"
              ? "⏳ กำลังเชื่อมต่อใหม่..."
              : "❌ ขาดการเชื่อมต่อ"}
          </div>
        </Show>

        {/* ── Room Header ──────────────────────────── */}
        <div class="text-center space-y-2">
          <p class="text-sm opacity-50">ห้อง</p>
          <div class="flex items-center justify-center gap-3">
            <h1 class="text-3xl font-bold font-mono tracking-widest">
              {params.code}
            </h1>
            <button
              onClick={copyCode}
              class="px-3 py-1 text-xs rounded bg-[#151723] border border-[#b1a59a]/20
                     hover:bg-[#1e2035] transition-colors"
            >
              {copied() ? "✅ คัดลอกแล้ว" : "📋 คัดลอก"}
            </button>
          </div>
          <p class="text-sm opacity-50">
            แชร์รหัสนี้ให้เพื่อนเพื่อเข้าร่วม
          </p>
        </div>

        {/* ── Error ────────────────────────────────── */}
        <Show when={error()}>
          <div class="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error()}
          </div>
        </Show>

        {/* ── Players List ─────────────────────────── */}
        <div class="bg-[#151723] rounded-xl border border-[#b1a59a]/10 overflow-hidden">
          <div class="px-4 py-3 border-b border-[#b1a59a]/10 flex items-center justify-between">
            <span class="font-medium">
              ผู้เล่น ({players.length}/{MAX_PLAYERS})
            </span>
            <span class="text-xs opacity-50">
              ต้องการอย่างน้อย {MIN_PLAYERS} คน
            </span>
          </div>

          {/* Player slots */}
          <div class="divide-y divide-[#b1a59a]/5">
            <For each={players}>
              {(player: Player, index: Accessor<number>) => (
                <div
                  class={`px-4 py-3 flex items-center gap-3 transition-colors
                    ${player.session_id === sessionId() ? "bg-amber-500/5" : ""}`}
                >
                  {/* Avatar */}
                  <span class="text-2xl">{playerEmoji(index())}</span>

                  {/* Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium truncate">{player.name}</span>
                      <Show when={player.session_id === sessionId()}>
                        <span class="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          คุณ
                        </span>
                      </Show>
                      <Show when={index() === 0}>
                        <span class="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          👑 Host
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Ready status */}
                  <span
                    class={`text-sm font-medium px-3 py-1 rounded-full transition-all
                      ${player.is_ready
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-[#b1a59a]/10 text-[#b1a59a]/40"}`}
                  >
                    {player.is_ready ? "✅ พร้อม" : "⏳ รอ"}
                  </span>
                </div>
              )}
            </For>

            {/* Empty slots */}
            <For each={Array(MAX_PLAYERS - players.length)}>
              {() => (
                <div class="px-4 py-3 flex items-center gap-3 opacity-20">
                  <span class="text-2xl">👤</span>
                  <span class="text-sm italic">ว่าง — รอผู้เล่น…</span>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* ── Dice Roll Animation ──────────────────── */}
        <Show when={showDice()}>
          <div class="bg-[#151723] rounded-xl border border-amber-500/30 p-4 text-center animate-bounce">
            <p class="text-lg font-bold mb-2">🎲 ทอยลูกเต๋าจัดลำดับ!</p>
            <div class="flex justify-center gap-3">
              <For each={players}>
                {(player, index) => (
                  <div class="text-center">
                    <div class="text-3xl mb-1">
                      {["🎲", "🎯", "⚡", "🌟"][diceResults()?.[index()] ?? 0]}
                    </div>
                    <p class="text-xs opacity-70">{player.name}</p>
                    <p class="text-sm font-bold">#{(diceResults()?.[index()] ?? 0) + 1}</p>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* ── Action Buttons ───────────────────────── */}
        <div class="space-y-3">
          {/* Ready toggle */}
          <button
            onClick={toggleReady}
            class={`w-full py-3 rounded-lg font-bold text-lg transition-all
              ${myPlayer()?.is_ready
                ? "bg-emerald-600/80 hover:bg-emerald-600 text-white"
                : "bg-[#151723] hover:bg-[#1e2035] border border-[#b1a59a]/20"}`}
          >
            {myPlayer()?.is_ready ? "✅ พร้อมแล้ว (คลิกเพื่อยกเลิก)" : "🙋 กดพร้อม!"}
          </button>

          {/* Start game (host only) */}
          <Show when={isHost()}>
            <button
              onClick={handleStart}
              disabled={!canStart() || loading()}
              class="w-full py-3 rounded-lg bg-amber-600/80 hover:bg-amber-600
                     disabled:opacity-30 disabled:cursor-not-allowed
                     text-white font-bold text-lg transition-all"
            >
              {loading()
                ? "⏳ กำลังเริ่ม..."
                : canStart()
                ? "🎲 ทอยเต๋า & เริ่มเกม!"
                : `⏳ รอผู้เล่นพร้อม (${players.filter((p) => p.is_ready).length}/${players.length})`}
            </button>
          </Show>

          {/* Not-host waiting message */}
          <Show when={!isHost() && allReady()}>
            <p class="text-center text-sm opacity-60 animate-pulse">
              ⏳ รอ Host เริ่มเกม...
            </p>
          </Show>

          {/* Leave room */}
          <button
            onClick={handleLeave}
            class="w-full py-2 text-sm opacity-40 hover:opacity-70 hover:text-red-400 transition-all"
          >
            🚪 ออกจากห้อง
          </button>
        </div>

        {/* ── Tips ──────────────────────────────────── */}
        <div class="text-center text-xs opacity-30 space-y-1">
          <p>💡 ต้องมีผู้เล่นอย่างน้อย {MIN_PLAYERS} คน ถึงจะเริ่มได้</p>
          <p>🎲 ลำดับเดินจะถูกสุ่มด้วยลูกเต๋าเมื่อเริ่มเกม</p>
        </div>
      </div>
    </main>
  );
}
