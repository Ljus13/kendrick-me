// ============================================================
// Game Page — Phase 4: Core Gameplay
// Route: /game/:code
// 5×4 grid, turn indicator, click-to-reveal, score sidebar
// ============================================================
import {
  createSignal,
  createEffect,
  onCleanup,
  onMount,
  Show,
  For,
} from "solid-js";
import type { Accessor } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { sessionId, nickname } from "../stores/playerStore";
import { room, players, isHost, joinRoom, subscribeToRoom } from "../stores/roomStore";
import { connectionStatus, onlinePlayers, hostDisconnectedAt, endGameEarly } from "../stores/roomStore";
import type { ConnectionStatus } from "../stores/roomStore";
import {
  board,
  revealPopup,
  revealPopups,
  gameLoading,
  setGameLoading,
  isMyTurn,
  currentTurnPlayer,
  isGameOver,
  unrevealed,
  sortedPlayers,
  rankedPlayers,
  initBoard,
  loadBoard,
  clickBean,
  autoSkipTurn,
  subscribeToGameEvents,
  reconnectGame,
  cleanupGame,
  activeEmote,
  screenShake,
  EMOTE_MAP,
  sendEmote,
} from "../stores/gameStore";
import type { EmoteType } from "../stores/gameStore";
import {
  saveGameToLeaderboard,
  resetLeaderboardSaved,
} from "../stores/leaderboardStore";
import type { Player, GameBoardSlotWithBean } from "../types/database";
import { getGridConfig, getMaxPlayers } from "../types/database";
import ChatPanel from "../components/game/ChatPanel";

export default function Game() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [initMessage, setInitMessage] = createSignal("กำลังโหลดกระดาน...");
  const [showGameOver, setShowGameOver] = createSignal(false);
  const [chatOpen, setChatOpen] = createSignal(false);
  const [showDisconnectModal, setShowDisconnectModal] = createSignal(false);
  const [hostCountdown, setHostCountdown] = createSignal("");

  /** Deterministic "active host": first online player in turn order */
  const isActiveHost = (): boolean => {
    const r = room();
    if (!r) return false;
    const online = onlinePlayers();
    const sorted = [...r.players].sort(
      (a: Player, b: Player) => a.turn_order - b.turn_order,
    );
    const firstOnline = sorted.find((p) => online.has(p.session_id));
    return firstOnline?.session_id === sessionId();
  };

  // ── Initialize on mount ────────────────────────────────────
  onMount(async () => {
    // Guard: must have nickname
    if (!nickname() || nickname().length < 2) {
      navigate("/", { replace: true });
      return;
    }

    // If room is not in memory (page refresh), re-fetch from DB
    let r = room();
    if (!r) {
      const ok = await joinRoom(params.code);
      if (!ok) {
        navigate("/", { replace: true });
        return;
      }
      r = room();
    }

    if (!r) {
      navigate("/", { replace: true });
      return;
    }

    // Subscribe to room updates (for turn/score changes via postgres_changes)
    subscribeToRoom(r.id);

    // Host initializes the board first
    if (isHost()) {
      const beanCount = r.bean_count ?? 20;
      setInitMessage(`🫘 กำลังสุ่มเยลลี่ ${beanCount} เม็ด...`);
      const ok = await initBoard(r.id);
      if (!ok) {
        setInitMessage("❌ สร้างกระดานไม่สำเร็จ");
        return;
      }
    }

    // All players: load board (with retry for non-host)
    let loaded = false;
    let retries = 0;
    const maxRetries = 30;

    while (!loaded && retries < maxRetries) {
      loaded = await loadBoard(r.id);
      if (!loaded) {
        setInitMessage(
          `⏳ รอ Host สุ่มเยลลี่... (${retries + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, 600));
        retries++;
      }
    }

    if (!loaded) {
      setInitMessage("❌ โหลดกระดานไม่สำเร็จ — ลองรีเฟรช");
      return;
    }

    // Subscribe to game broadcast events
    subscribeToGameEvents(r.id);

    setGameLoading(false);
  });

  // ── Watch for game over ────────────────────────────────────
  createEffect(() => {
    if (isGameOver()) {
      // Short delay so last popup can display
      setTimeout(() => {
        setShowGameOver(true);
        // Auto-save all players' scores to leaderboard
        const ranked = rankedPlayers();
        if (ranked.length > 0) {
          saveGameToLeaderboard(ranked);
        }
      }, 1500);
    }
  });

  // ── Auto-skip disconnected player's turn ───────────────────
  createEffect(() => {
    const r = room();
    const turnPlayer = currentTurnPlayer();
    const online = onlinePlayers();

    if (!r || r.status !== "playing" || isGameOver() || !turnPlayer) return;
    if (online.has(turnPlayer.session_id)) return; // Online — no skip needed
    if (!isActiveHost()) return; // Only active host executes

    const timer = setTimeout(() => autoSkipTurn(), 5000);
    onCleanup(() => clearTimeout(timer));
  });

  // ── Show disconnect modal when only 1 player remains ───────
  createEffect(() => {
    const r = room();
    if (!r || r.status !== "playing" || isGameOver()) {
      setShowDisconnectModal(false);
      return;
    }
    const online = onlinePlayers();
    const onlineCount = r.players.filter((p) => online.has(p.session_id)).length;
    if (onlineCount <= 1 && r.players.length >= 2 && online.has(sessionId())) {
      setShowDisconnectModal(true);
    } else {
      setShowDisconnectModal(false);
    }
  });

  // ── Host disconnect countdown ──────────────────────────────
  createEffect(() => {
    const disconnectedAt = hostDisconnectedAt();
    if (!disconnectedAt) {
      setHostCountdown("");
      return;
    }
    const update = () => {
      const remaining = Math.max(0, 2 * 60 * 1000 - (Date.now() - disconnectedAt));
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setHostCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const iv = setInterval(update, 1000);
    onCleanup(() => clearInterval(iv));
  });

  // ── Cleanup ────────────────────────────────────────────────
  onCleanup(() => {
    cleanupGame();
    resetLeaderboardSaved();
  });

  // ── Handlers ───────────────────────────────────────────────
  function handleClick(slot: GameBoardSlotWithBean) {
    if (!isMyTurn() || slot.is_revealed || isGameOver()) return;
    clickBean(slot.slot_index);
  }

  function handleBackToHome() {
    navigate("/", { replace: true });
  }

  // ── Player emoji helper ────────────────────────────────────
  function playerEmoji(index: number): string {
    return ["🧙‍♂️", "🧙‍♀️", "🧝", "🧛", "🧝‍♀️", "🧌"][index] || "🎭";
  }

  /** Medal for rank */
  function rankMedal(rank: number): string {
    return ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"][rank] || "";
  }

  return (
    <main
      class={`min-h-screen bg-[#10141d] bg-parchment text-[#b1a59a] flex flex-col ${
        screenShake() ? "animate-screen-shake" : ""
      }`}
    >
      {/* ── Loading Screen ──────────────────────────── */}
      <Show when={gameLoading()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center space-y-4">
            <div class="text-6xl animate-bounce">🫘</div>
            <p class="text-lg font-display font-medium animate-pulse">{initMessage()}</p>
            <div class="flex justify-center gap-1">
              <div class="w-2 h-2 bg-amber-500/60 rounded-full animate-bounce" style="animation-delay: 0s"></div>
              <div class="w-2 h-2 bg-amber-500/60 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 bg-amber-500/60 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Main Game UI ────────────────────────────── */}
      <Show when={!gameLoading()}>
        {/* ── Connection Status Banner ────────────── */}
        <Show when={connectionStatus() !== "connected"}>
          <div
            class={`text-center text-sm font-medium py-2 px-4 shrink-0 ${
              connectionStatus() === "reconnecting"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {connectionStatus() === "reconnecting"
              ? "⏳ กำลังเชื่อมต่อใหม่..."
              : "🔗 ไม่มีการเชื่อมต่อ — รอเครือข่ายกลับมา"}
          </div>
        </Show>

        {/* ── Host Disconnect Countdown Banner ────── */}
        <Show when={hostCountdown()}>
          <div class="text-center text-sm font-medium py-2 px-4 shrink-0 bg-purple-500/20 text-purple-400">
            👑 หัวห้องหลุด — โอนสิทธิ์ใน {hostCountdown()}
          </div>
        </Show>

        {/* ── Top Bar ─────────────────────────────── */}
        <header class="bg-[#151723]/80 backdrop-blur-sm border-b border-[#b1a59a]/10 px-3 sm:px-4 py-2.5 sm:py-3 shrink-0">
          <div class="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
            {/* Room code + home link */}
            <div class="flex items-center gap-2">
              <button
                onClick={() => navigate("/", { replace: true })}
                class="text-xs opacity-40 hover:opacity-80 hover:text-amber-400 transition-all"
                title="กลับหน้าแรก"
              >
                🏠
              </button>
              <span class="text-xs opacity-40">ห้อง</span>
              <span class="font-mono font-bold text-sm">{params.code}</span>
            </div>

            {/* Turn indicator */}
            <div
              class={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                isMyTurn()
                  ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30 animate-pulse"
                  : "bg-[#b1a59a]/10 text-[#b1a59a]/60"
              }`}
            >
              {isGameOver()
                ? "🏁 เกมจบแล้ว!"
                : isMyTurn()
                  ? "🎯 ตาคุณ — เลือกเยลลี่เลย!"
                  : `⏳ ตาของ ${currentTurnPlayer()?.name ?? "..."}`}
            </div>

            {/* Remaining beans */}
            <div class="text-xs sm:text-sm opacity-50 font-mono">
              <span class="text-amber-400 font-bold">{unrevealed()}</span>/{room()?.bean_count ?? 20}
            </div>
          </div>
        </header>

        {/* ── Game Content: Grid + Sidebar ─────────── */}
        <div class="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-2 sm:p-4 gap-3 sm:gap-4">
          {/* ── Dynamic Grid ───────────────────────── */}
          <div class="flex-1 flex items-center justify-center">
            <div
              class="gap-2 sm:gap-3 w-full"
              style={{
                display: "grid",
                "grid-template-columns": `repeat(${(() => { const r = room(); return getGridConfig(r?.bean_count ?? 20).cols; })()}, minmax(0, 1fr))`,
                "max-width": `${(() => { const r = room(); return getGridConfig(r?.bean_count ?? 20).cols * 112; })()}px`,
              }}
            >
              <For each={board}>
                {(slot: GameBoardSlotWithBean) => (
                  <button
                    onClick={() => handleClick(slot)}
                    disabled={!isMyTurn() || slot.is_revealed || isGameOver()}
                    class={`aspect-square rounded-xl border-2 transition-all duration-300
                      flex flex-col items-center justify-center overflow-hidden relative
                      ${
                        slot.is_revealed
                          ? "border-amber-500/20 bg-[#151723]/80 scale-[0.97]"
                          : isMyTurn() && !isGameOver()
                            ? "border-amber-500/40 bg-[#151723] hover:bg-[#1e2035] hover:scale-[1.05] hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer active:scale-95"
                            : "border-[#b1a59a]/10 bg-[#151723] cursor-not-allowed opacity-60"
                      }`}
                  >
                    {/* Hidden state — all beans show the same mystery image */}
                    <Show when={!slot.is_revealed}>
                      <div class="flex flex-col items-center justify-center w-full h-full p-1 bean-shimmer">
                        <span class="text-2xl sm:text-4xl select-none">
                          🫘
                        </span>
                        <span class="text-[9px] sm:text-[10px] opacity-20 mt-0.5 font-mono">
                          #{slot.slot_index + 1}
                        </span>
                      </div>
                    </Show>

                    {/* Revealed state */}
                    <Show when={slot.is_revealed}>
                      <div class="flex flex-col items-center justify-center w-full h-full p-1 animate-bean-flip">
                        <Show
                          when={slot.bean.img_revealed}
                          fallback={
                            <span class="text-3xl sm:text-4xl select-none">
                              ✨
                            </span>
                          }
                        >
                          <img
                            src={slot.bean.img_revealed!}
                            alt={slot.bean.flavor}
                            class="w-full h-full object-contain"
                            draggable={false}
                          />
                        </Show>
                        <span
                          class={`text-[10px] sm:text-xs font-bold mt-0.5 ${
                            slot.bean.points >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {slot.bean.points >= 0 ? "+" : ""}
                          {slot.bean.points}
                        </span>
                      </div>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* ── Sidebar: Scoreboard + Emotes ────── */}
          <div class="lg:w-60 shrink-0 space-y-3">
            <div class="bg-[#151723]/80 backdrop-blur-sm rounded-xl border border-[#b1a59a]/10 overflow-hidden">
              <div class="px-4 py-2.5 border-b border-[#b1a59a]/10">
                <span class="font-display font-semibold text-sm">🏆 คะแนน</span>
              </div>
              <div class="divide-y divide-[#b1a59a]/5">
                <For each={sortedPlayers()}>
                  {(p: Player, i: Accessor<number>) => {
                    const isCurrent = (): boolean =>
                      i() === room()?.current_turn;
                    const isMe = (): boolean =>
                      p.session_id === sessionId();

                    return (
                      <div
                        class={`px-3 py-2.5 flex items-center gap-2 transition-all duration-300
                        ${isCurrent() ? "bg-amber-500/10" : ""}
                        ${
                          isMe()
                            ? "border-l-2 border-amber-500"
                            : "border-l-2 border-transparent"
                        }`}
                      >
                        {/* Emoji */}
                        <span class="text-lg shrink-0">
                          {playerEmoji(i())}
                        </span>

                        {/* Online indicator */}
                        <Show
                          when={onlinePlayers().has(p.session_id)}
                          fallback={
                            <span class="text-xs text-red-400 shrink-0" title="หลุดจากเกม">🔗</span>
                          }
                        >
                          <span class="w-2 h-2 bg-emerald-400 rounded-full shrink-0" title="ออนไลน์" />
                        </Show>

                        {/* Name + turn arrow */}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-1">
                            <span class="text-sm font-medium truncate">
                              {p.name}
                            </span>
                            <Show when={isMe()}>
                              <span class="text-[10px] text-amber-400/60">
                                (คุณ)
                              </span>
                            </Show>
                          </div>
                        </div>

                        {/* Turn indicator */}
                        <Show when={isCurrent() && !isGameOver()}>
                          <span class="text-amber-400 text-xs animate-pulse">
                            ◀
                          </span>
                        </Show>

                        {/* Score */}
                        <span
                          class={`font-bold font-mono text-sm shrink-0 ${
                            p.score >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {p.score}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* ── Emote Buttons ──────────────────── */}
            <Show when={!isGameOver()}>
              <div class="bg-[#151723]/80 backdrop-blur-sm rounded-xl border border-[#b1a59a]/10 p-3">
                <p class="text-[10px] sm:text-xs opacity-40 text-center mb-2 font-display">รีแอค</p>
                <div class="grid grid-cols-4 gap-1.5">
                  <For each={Object.entries(EMOTE_MAP) as unknown as [EmoteType, string][]}>
                    {([type, emoji]) => (
                      <button
                        onClick={() => sendEmote(type as EmoteType)}
                        class="py-2 rounded-lg bg-[#b1a59a]/5 hover:bg-[#b1a59a]/15 border border-[#b1a59a]/10
                               hover:border-amber-500/30 transition-all text-xl sm:text-2xl
                               hover:scale-110 active:scale-95"
                        title={type as string}
                      >
                        {emoji as string}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Help text */}
            <div class="text-center text-[10px] sm:text-xs opacity-30 space-y-1 px-2">
              <p>🫘 คลิกถั่วเพื่อเปิด — ได้ทั้งแต้มดีและแต้มร้าย!</p>
              <p>🎯 เล่นตามลำดับ — รอตาของคุณ</p>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Emote Bubble Overlay ────────────────────── */}
      <Show when={activeEmote()}>
        {(emote) => {
          const fromPlayer = () =>
            players.find((p: Player) => p.session_id === emote().from);
          return (
            <div class="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div class="bg-[#151723]/90 backdrop-blur-sm border border-amber-500/30 rounded-2xl px-5 py-3
                          text-center shadow-xl animate-emote-pop animate-emote-float">
                <span class="text-4xl sm:text-5xl block">{EMOTE_MAP[emote().type]}</span>
                <span class="text-xs opacity-60 mt-1 block">{fromPlayer()?.name ?? "???"}</span>
              </div>
            </div>
          );
        }}
      </Show>

      {/* ── Stacked Reveal Popups (top) ─────────────── */}
      <Show when={revealPopups().length > 0}>
        <div class="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-1.5 w-full max-w-sm px-3">
          <For each={revealPopups()}>
            {(popup) => {
              const isPositive = () => popup.points >= 0;
              const revealerName = () =>
                popup.revealed_by === sessionId()
                  ? null
                  : players.find((p: Player) => p.session_id === popup.revealed_by)?.name ?? "???";
              return (
                <div
                  class={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-lg
                    animate-popup-slide-in
                    ${
                      isPositive()
                        ? "bg-emerald-950/80 border-emerald-500/40 shadow-emerald-500/10"
                        : "bg-red-950/80 border-red-500/40 shadow-red-500/10"
                    }`}
                >
                  {/* Emoji */}
                  <span class="text-2xl sm:text-3xl shrink-0">
                    {isPositive() ? "✨" : "🤢"}
                  </span>

                  {/* Flavor + score */}
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-display font-bold truncate text-[#b1a59a]">
                      {popup.flavor}
                    </p>
                    <Show when={revealerName()}>
                      <p class="text-[10px] opacity-40 truncate">เปิดโดย {revealerName()}</p>
                    </Show>
                  </div>

                  {/* Points */}
                  <span
                    class={`text-lg sm:text-xl font-bold font-mono shrink-0 ${
                      isPositive() ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isPositive() ? "+" : ""}{popup.points}
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* ── Disconnect Modal (only 1 player left) ──── */}
      <Show when={showDisconnectModal() && !showGameOver()}>
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div class="bg-[#151723] border border-amber-500/30 rounded-2xl p-5 sm:p-6 max-w-sm w-full mx-4 text-center space-y-4">
            <div class="text-4xl">⚠️</div>
            <h3 class="text-lg font-display font-bold text-amber-400">
              ผู้เล่นอื่นหลุดจากเกม
            </h3>
            <p class="text-sm opacity-60">
              รออีกคนกลับมา หรือจบเกมเพื่อนับคะแนน?
            </p>
            <div class="flex gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                class="flex-1 py-2.5 rounded-lg bg-[#b1a59a]/10 border border-[#b1a59a]/20
                       hover:bg-[#b1a59a]/20 font-semibold text-sm transition-all"
              >
                🕐 รอ
              </button>
              <button
                onClick={() => { endGameEarly(); setShowDisconnectModal(false); }}
                class="flex-1 py-2.5 rounded-lg bg-amber-600/80 hover:bg-amber-600
                       text-white font-bold text-sm transition-all"
              >
                🏁 จบเกม
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Game Over Overlay ───────────────────────── */}
      <Show when={showGameOver()}>
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div class="bg-[#151723] border border-amber-500/30 rounded-2xl p-5 sm:p-8 max-w-sm w-full mx-4 text-center space-y-5">
            {/* Title */}
            <div>
              <div class="text-5xl mb-2">🏁</div>
              <h2 class="text-2xl font-display font-bold text-amber-400">เกมจบแล้ว!</h2>
              <p class="text-sm opacity-50 mt-1">
                เยลลี่ทั้ง {room()?.bean_count ?? 20} เม็ดถูกเปิดหมดแล้ว
              </p>
            </div>

            {/* Rankings */}
            <div class="space-y-2">
              <For each={rankedPlayers()}>
                {(p: Player, i: Accessor<number>) => (
                  <div
                    class={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                      i() === 0
                        ? "bg-amber-500/15 border border-amber-500/30"
                        : "bg-[#b1a59a]/5"
                    }`}
                  >
                    <span class="text-xl">{rankMedal(i())}</span>
                    <span class="flex-1 text-left font-medium truncate">
                      {p.name}
                      <Show when={p.session_id === sessionId()}>
                        <span class="text-xs text-amber-400/60 ml-1">
                          (คุณ)
                        </span>
                      </Show>
                    </span>
                    <span
                      class={`font-bold font-mono ${
                        p.score >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {p.score}
                    </span>
                  </div>
                )}
              </For>
            </div>

            {/* Action buttons */}
            <div class="space-y-2">
              <button
                onClick={handleBackToHome}
                class="w-full py-3 rounded-lg bg-amber-600/80 hover:bg-amber-600
                       text-white font-bold transition-colors"
              >
                🏠 กลับหน้าหลัก
              </button>
              <button
                onClick={() => navigate("/stats")}
                class="w-full py-2.5 rounded-lg bg-[#b1a59a]/10 border border-[#b1a59a]/20
                       hover:border-[#b1a59a]/40 text-[#b1a59a] font-semibold text-sm transition-all"
              >
                🏆 ดูสถิติ & ลีดเดอร์บอร์ด
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Chat Panel ──────────────────────────────── */}
      <Show when={!gameLoading()}>
        <ChatPanel open={chatOpen()} onToggle={() => setChatOpen((o) => !o)} />
      </Show>
    </main>
  );
}
