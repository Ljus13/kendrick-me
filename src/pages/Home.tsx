import { createSignal, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { nickname, setNickname, isReady, activeRoomCode, setActiveRoomCode, sessionId } from "../stores/playerStore";
import { createRoom, joinRoom, error, loading } from "../stores/roomStore";
import { isValidRoomCode, normalizeRoomCode } from "../lib/roomHelpers";
import { supabase } from "../lib/supabase";
import type { Player } from "../types/database";

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = createSignal<"menu" | "create" | "join">("menu");
  const [roomCode, setRoomCode] = createSignal("");
  const [localError, setLocalError] = createSignal("");
  const [pendingRejoin, setPendingRejoin] = createSignal<string>("");

  // ── Check if player was in a room (browser crash recovery) ──
  onMount(async () => {
    const saved = activeRoomCode();
    if (!saved || !isReady()) return;

    // Verify room still exists and player is still in it
    const { data } = await supabase
      .from("game_rooms")
      .select("*")
      .eq("room_code", saved)
      .single();

    if (!data) {
      // Room was deleted or doesn't exist
      setActiveRoomCode("");
      return;
    }

    const isInRoom = (data.players as Player[]).some(
      (p: Player) => p.session_id === sessionId()
    );

    if (!isInRoom || data.status === "finished") {
      setActiveRoomCode("");
      return;
    }

    // Player still in an active room — show rejoin prompt
    setPendingRejoin(saved);
  });

  function handleRejoin() {
    const code = pendingRejoin();
    setPendingRejoin("");
    navigate(`/lobby/${code}`);
  }

  function handleDismissRejoin() {
    // Leave the old room and clear
    const code = pendingRejoin();
    setPendingRejoin("");
    setActiveRoomCode("");
    // Fire & forget: remove player from old room via joinRoom store
    (async () => {
      const { data } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", code)
        .single();
      if (!data) return;
      const updated = (data.players as Player[]).filter(
        (p: Player) => p.session_id !== sessionId()
      );
      if (updated.length === 0) {
        await supabase.from("game_board").delete().eq("room_id", data.id);
        await supabase.from("game_rooms").delete().eq("id", data.id);
      } else {
        await supabase.from("game_rooms").update({ players: updated }).eq("id", data.id);
      }
    })();
  }

  async function handleCreate() {
    if (!isReady()) {
      setLocalError("กรุณาใส่ชื่อก่อน (อย่างน้อย 2 ตัวอักษร)");
      return;
    }
    setLocalError("");
    const code = await createRoom();
    if (code) {
      navigate(`/lobby/${code}`);
    }
  }

  async function handleJoin() {
    if (!isReady()) {
      setLocalError("กรุณาใส่ชื่อก่อน (อย่างน้อย 2 ตัวอักษร)");
      return;
    }
    const code = normalizeRoomCode(roomCode());
    if (!isValidRoomCode(code)) {
      setLocalError("รหัสห้องไม่ถูกต้อง (ตัวอย่าง: BB-8899)");
      return;
    }
    setLocalError("");
    const ok = await joinRoom(code);
    if (ok) {
      navigate(`/lobby/${code}`);
    }
  }

  /** Format room code as user types */
  function onCodeInput(raw: string) {
    let v = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    // Auto-insert dash
    if (v.length === 2 && !v.includes("-")) v = "BB-";
    if (v.length > 7) v = v.slice(0, 7);
    setRoomCode(v);
  }

  return (
    <main class="min-h-screen bg-[#10141d] bg-parchment text-[#b1a59a] flex items-center justify-center p-4">
      <div class="w-full max-w-md space-y-8">
        {/* ── Header ────────────────────────────────── */}
        <div class="text-center space-y-2">
          <h1 class="text-3xl sm:text-4xl font-display font-bold tracking-tight">
            🍬 Bertie Bott's
          </h1>
          <p class="text-base sm:text-lg font-display font-medium opacity-80">Every Flavour Beans</p>
          <p class="text-xs sm:text-sm opacity-50">
            เกมเสี่ยงดวงเยลลี่สไตล์ Harry Potter — เล่นได้ 2-4 คน
          </p>
        </div>

        {/* ── Nickname Input ────────────────────────── */}
        <div class="space-y-2">
          <label class="text-sm font-medium opacity-70">ชื่อผู้เล่น</label>
          <input
            type="text"
            maxLength={20}
            placeholder="พิมพ์ชื่อเล่นของคุณ…"
            value={nickname()}
            onInput={(e) => setNickname(e.currentTarget.value)}
            class="w-full px-4 py-3 rounded-lg bg-[#151723] border border-[#b1a59a]/20
                   placeholder:text-[#b1a59a]/30 focus:outline-none focus:border-[#b1a59a]/50
                   text-lg transition-colors"
          />
          <Show when={nickname().length > 0 && nickname().length < 2}>
            <p class="text-xs text-amber-400/80">อย่างน้อย 2 ตัวอักษร</p>
          </Show>
        </div>

        {/* ── Error messages ────────────────────────── */}
        <Show when={localError() || error()}>
          <div class="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {localError() || error()}
          </div>
        </Show>

        {/* ── Rejoin Banner (browser crash recovery) ── */}
        <Show when={pendingRejoin()}>
          <div class="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <p class="text-sm text-amber-400 font-medium">
              🔄 คุณยังอยู่ในห้อง <span class="font-mono font-bold">{pendingRejoin()}</span>
            </p>
            <p class="text-xs opacity-60">ดูเหมือนว่าคุณออกไปโดยไม่ได้ตั้งใจ — กลับเข้าห้องเดิมได้เลย!</p>
            <div class="flex gap-2">
              <button
                onClick={handleRejoin}
                class="flex-1 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white 
                       font-bold text-sm transition-all"
              >
                🚪 กลับเข้าห้องเดิม
              </button>
              <button
                onClick={handleDismissRejoin}
                class="flex-1 py-2 rounded-lg bg-[#151723] border border-[#b1a59a]/20
                       text-sm hover:bg-[#1e2035] transition-all"
              >
                ❌ ออกจากห้อง
              </button>
            </div>
          </div>
        </Show>

        {/* ── Action Buttons ────────────────────────── */}
        <Show when={mode() === "menu"}>
          <div class="space-y-3">
            <button
              onClick={() => setMode("create")}
              disabled={!isReady()}
              class="w-full py-3 rounded-lg bg-amber-600/80 hover:bg-amber-600 disabled:opacity-30
                     disabled:cursor-not-allowed text-white font-bold text-lg transition-all"
            >
              🏰 สร้างห้องใหม่
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={!isReady()}
              class="w-full py-3 rounded-lg bg-[#151723] hover:bg-[#1e2035] disabled:opacity-30
                     disabled:cursor-not-allowed border border-[#b1a59a]/20 font-bold text-lg transition-all"
            >
              🚪 เข้าร่วมห้อง
            </button>
          </div>
        </Show>

        {/* ── Create Room ───────────────────────────── */}
        <Show when={mode() === "create"}>
          <div class="space-y-3">
            <p class="text-sm opacity-60 text-center">
              คลิกเพื่อสร้างห้องใหม่ แล้วแชร์รหัสให้เพื่อน!
            </p>
            <button
              onClick={handleCreate}
              disabled={loading()}
              class="w-full py-3 rounded-lg bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50
                     text-white font-bold text-lg transition-all"
            >
              {loading() ? "⏳ กำลังสร้าง..." : "🎲 สร้างห้องเลย!"}
            </button>
            <button
              onClick={() => { setMode("menu"); setLocalError(""); }}
              class="w-full py-2 text-sm opacity-50 hover:opacity-80 transition-opacity"
            >
              ← ย้อนกลับ
            </button>
          </div>
        </Show>

        {/* ── Join Room ─────────────────────────────── */}
        <Show when={mode() === "join"}>
          <div class="space-y-3">
            <label class="text-sm font-medium opacity-70">รหัสห้อง</label>
            <input
              type="text"
              placeholder="BB-8899"
              maxLength={7}
              value={roomCode()}
              onInput={(e) => onCodeInput(e.currentTarget.value)}
              class="w-full px-4 py-3 rounded-lg bg-[#151723] border border-[#b1a59a]/20
                     placeholder:text-[#b1a59a]/30 focus:outline-none focus:border-[#b1a59a]/50
                     text-xl text-center tracking-widest font-mono transition-colors"
            />
            <button
              onClick={handleJoin}
              disabled={loading() || roomCode().length < 7}
              class="w-full py-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-30
                     disabled:cursor-not-allowed text-white font-bold text-lg transition-all"
            >
              {loading() ? "⏳ กำลังเข้าห้อง..." : "🚪 เข้าร่วม"}
            </button>
            <button
              onClick={() => { setMode("menu"); setLocalError(""); setRoomCode(""); }}
              class="w-full py-2 text-sm opacity-50 hover:opacity-80 transition-opacity"
            >
              ← ย้อนกลับ
            </button>
          </div>
        </Show>

        {/* ── Footer ────────────────────────────────── */}
        <div class="text-center pt-4 border-t border-[#b1a59a]/10 space-y-2">
          <a
            href="/stats"
            class="block text-sm text-amber-400/70 hover:text-amber-400 transition-colors font-medium"
          >
            🏆 สถิติ & ลีดเดอร์บอร์ด
          </a>
          <a
            href="/admin/login"
            class="text-xs opacity-30 hover:opacity-60 transition-opacity"
          >
            Admin →
          </a>
        </div>
      </div>
    </main>
  );
}
