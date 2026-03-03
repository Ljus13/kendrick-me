// ============================================================
// Game Store — Phase 4: Core Gameplay (Real-time)
// Board state, bean reveal, turn management, score, broadcast
// ============================================================
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { supabase } from "../lib/supabase";
import { sessionId } from "./playerStore";
import { room, players, onlinePlayers } from "./roomStore";
import type {
  Bean,
  Player,
  GameBoardSlotWithBean,
  BroadcastPayloads,
} from "../types/database";

// ── Types ────────────────────────────────────────────────────

type RevealPopupData = BroadcastPayloads["bean-revealed"] | null;
type RevealPopupItem = BroadcastPayloads["bean-revealed"] & { _id: number };
type EmoteType = BroadcastPayloads["emote"]["type"];
type EmoteData = { from: string; fromName: string; type: EmoteType } | null;

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text: string;
  ts: number;
}

// ── State ────────────────────────────────────────────────────

const [board, setBoard] = createStore<GameBoardSlotWithBean[]>([]);
const [revealPopup, setRevealPopup] = createSignal<RevealPopupData>(null);
const [revealPopups, setRevealPopups] = createSignal<RevealPopupItem[]>([]);
const [gameLoading, setGameLoading] = createSignal(true);
const [activeEmote, setActiveEmote] = createSignal<EmoteData>(null);
const [screenShake, setScreenShake] = createSignal(false);
const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
const [unreadChat, setUnreadChat] = createSignal(0);
let chatOpen = false;  // tracked externally by UI, used to decide unread count

let gameChannel: ReturnType<typeof supabase.channel> | null = null;
let popupTimer: ReturnType<typeof setTimeout> | null = null;
let emoteTimer: ReturnType<typeof setTimeout> | null = null;
let _gameRoomId: string | null = null;
let _popupIdCounter = 0;

// ── Derived ──────────────────────────────────────────────────

/** Is it my turn right now? */
const isMyTurn = (): boolean => {
  const r = room();
  if (!r || r.status !== "playing") return false;
  const sorted = [...r.players].sort(
    (a: Player, b: Player) => a.turn_order - b.turn_order,
  );
  return sorted[r.current_turn]?.session_id === sessionId();
};

/** Player whose turn it is */
const currentTurnPlayer = (): Player | null => {
  const r = room();
  if (!r) return null;
  const sorted = [...r.players].sort(
    (a: Player, b: Player) => a.turn_order - b.turn_order,
  );
  return sorted[r.current_turn] ?? null;
};

/** Is the game over? */
const isGameOver = (): boolean => {
  const r = room();
  if (!r) return false;
  const total = r.bean_count ?? 20;
  return r.status === "finished" || r.total_clicked >= total;
};

/** Number of beans still hidden */
const unrevealed = (): number =>
  board.filter((s: GameBoardSlotWithBean) => !s.is_revealed).length;

/** Players sorted by turn order */
const sortedPlayers = (): Player[] => {
  const r = room();
  if (!r) return [];
  return [...r.players].sort(
    (a: Player, b: Player) => a.turn_order - b.turn_order,
  );
};

/** Players sorted by score (descending) for ranking */
const rankedPlayers = (): Player[] => {
  const r = room();
  if (!r) return [];
  return [...r.players].sort(
    (a: Player, b: Player) => b.score - a.score,
  );
};

// ── Turn Skip Helpers ────────────────────────────────────────

/** Find next online player's turn, skipping disconnected */
function findNextOnlineTurn(
  currentTurn: number,
  sortedPlayers: Player[],
  onlineSet: Set<string>,
): number {
  let next = currentTurn;
  let attempts = 0;
  do {
    next = (next + 1) % sortedPlayers.length;
    attempts++;
  } while (
    !onlineSet.has(sortedPlayers[next].session_id) &&
    attempts < sortedPlayers.length
  );
  // If ALL offline, just advance normally
  if (attempts >= sortedPlayers.length) {
    return (currentTurn + 1) % sortedPlayers.length;
  }
  return next;
}

/** Auto-skip a disconnected player's turn (called by active host) */
async function autoSkipTurn(): Promise<void> {
  const r = room();
  if (!r || r.status !== "playing" || isGameOver()) return;

  const sorted = [...r.players].sort(
    (a: Player, b: Player) => a.turn_order - b.turn_order,
  );
  const online = onlinePlayers();
  const nextTurn = findNextOnlineTurn(r.current_turn, sorted, online);

  if (nextTurn === r.current_turn) return; // no change

  await supabase
    .from("game_rooms")
    .update({ current_turn: nextTurn })
    .eq("id", r.id);

  if (gameChannel) {
    await gameChannel.send({
      type: "broadcast",
      event: "turn-changed",
      payload: {
        current_turn: nextTurn,
        next_player_session_id: sorted[nextTurn]?.session_id ?? "",
      },
    });
  }
}

// ── Initialize Board (host only) ────────────────────────────

async function initBoard(roomId: string): Promise<boolean> {
  // Check if board already exists for this room
  const { data: existing } = await supabase
    .from("game_board")
    .select("id")
    .eq("room_id", roomId)
    .limit(1);

  if (existing && existing.length > 0) return true; // Already initialized

  // Fetch all beans from master table
  const { data: beans, error: bErr } = await supabase
    .from("beans_master")
    .select("*");

  if (bErr || !beans || beans.length === 0) {
    console.error("Failed to fetch beans:", bErr);
    return false;
  }

  // Pick N random beans based on room's bean_count
  const r = room();
  const beanCount = r?.bean_count ?? 20;
  const picked: Bean[] = [];
  for (let i = 0; i < beanCount; i++) {
    picked.push(beans[Math.floor(Math.random() * beans.length)]);
  }

  // Fisher-Yates shuffle for random slot placement
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  // Insert N rows into game_board
  const rows = picked.map((bean: Bean, index: number) => ({
    room_id: roomId,
    slot_index: index,
    bean_id: bean.id,
    is_revealed: false,
    revealed_by: null,
  }));

  const { error: insertErr } = await supabase
    .from("game_board")
    .insert(rows);

  if (insertErr) {
    console.error("Failed to init board:", insertErr);
    return false;
  }

  return true;
}

// ── Load Board from DB ──────────────────────────────────────

async function loadBoard(roomId: string): Promise<boolean> {
  const { data, error: err } = await supabase
    .from("game_board")
    .select("*, bean:beans_master(*)")
    .eq("room_id", roomId)
    .order("slot_index");

  if (err || !data || data.length === 0) return false;

  // Map to GameBoardSlotWithBean[]
  const slots: GameBoardSlotWithBean[] = data.map((row: any) => ({
    id: row.id as string,
    room_id: row.room_id as string,
    slot_index: row.slot_index as number,
    bean_id: row.bean_id as string,
    is_revealed: row.is_revealed as boolean,
    revealed_by: row.revealed_by as string | null,
    bean: row.bean as Bean,
  }));

  setBoard(slots);
  return true;
}

// ── Click Bean ──────────────────────────────────────────────

async function clickBean(slotIndex: number): Promise<void> {
  const r = room();
  if (!r || !isMyTurn() || isGameOver()) return;

  const slotIdx = board.findIndex(
    (s: GameBoardSlotWithBean) => s.slot_index === slotIndex,
  );
  if (slotIdx === -1) return;

  const slot = board[slotIdx];
  if (slot.is_revealed) return;

  const bean = slot.bean;

  // ── 1. Optimistic UI — reveal instantly ──
  setBoard(
    produce((draft: GameBoardSlotWithBean[]) => {
      const target = draft.find(
        (s: GameBoardSlotWithBean) => s.slot_index === slotIndex,
      );
      if (target) {
        target.is_revealed = true;
        target.revealed_by = sessionId();
      }
    }),
  );

  // Show popup (isOwn = true → eligible for screen shake)
  showRevealPopup({
    slot_index: slotIndex,
    bean_id: bean.id,
    revealed_by: sessionId(),
    flavor: bean.flavor_th || bean.flavor,
    points: bean.points,
  }, true);

  // ── 2. Update game_board in DB ──
  await supabase
    .from("game_board")
    .update({ is_revealed: true, revealed_by: sessionId() })
    .eq("id", slot.id);

  // ── 3. Calculate new score ──
  const me = r.players.find(
    (p: Player) => p.session_id === sessionId(),
  );
  const newScore = (me?.score ?? 0) + bean.points;

  const updatedPlayers = r.players.map((p: Player) =>
    p.session_id === sessionId() ? { ...p, score: newScore } : p,
  );

  // ── 4. Advance turn + total_clicked ──
  const totalClicked = r.total_clicked + 1;
  const sorted = [...r.players].sort(
    (a: Player, b: Player) => a.turn_order - b.turn_order,
  );
  const nextTurn = findNextOnlineTurn(r.current_turn, sorted, onlinePlayers());
  const beanTotal = r.bean_count ?? 20;
  const newStatus = totalClicked >= beanTotal ? "finished" : "playing";

  await supabase
    .from("game_rooms")
    .update({
      players: updatedPlayers,
      current_turn: nextTurn,
      total_clicked: totalClicked,
      status: newStatus,
    })
    .eq("id", r.id);

  // ── 5. Broadcast bean-revealed ──
  if (gameChannel) {
    await gameChannel.send({
      type: "broadcast",
      event: "bean-revealed",
      payload: {
        slot_index: slotIndex,
        bean_id: bean.id,
        revealed_by: sessionId(),
        flavor: bean.flavor_th || bean.flavor,
        points: bean.points,
      },
    });
  }

  // ── 6. Broadcast turn-changed or game-ended ──
  if (gameChannel) {
    if (newStatus === "finished") {
      const rankings = [...updatedPlayers]
        .sort((a: Player, b: Player) => b.score - a.score)
        .map((p: Player, i: number) => ({
          name: p.name,
          score: p.score,
          rank: i + 1,
        }));

      await gameChannel.send({
        type: "broadcast",
        event: "game-ended",
        payload: { rankings },
      });
    } else {
      await gameChannel.send({
        type: "broadcast",
        event: "turn-changed",
        payload: {
          current_turn: nextTurn,
          next_player_session_id: sorted[nextTurn]?.session_id ?? "",
        },
      });
    }
  }
}

// ── Popup Helper ────────────────────────────────────────────

function showRevealPopup(data: BroadcastPayloads["bean-revealed"], isOwn = false): void {
  // Legacy single popup (keep for backward compat)
  if (popupTimer) clearTimeout(popupTimer);
  setRevealPopup(data);
  popupTimer = setTimeout(() => {
    setRevealPopup(null);
    popupTimer = null;
  }, 2500);

  // Stackable popups — add to list with unique ID
  const id = ++_popupIdCounter;
  const item: RevealPopupItem = { ...data, _id: id };
  setRevealPopups((prev) => [item, ...prev].slice(0, 8)); // max 8 stacked
  setTimeout(() => {
    setRevealPopups((prev) => prev.filter((p) => p._id !== id));
  }, 3000);

  // Trigger screen shake only for the player who clicked — gentle shake
  if (isOwn && data.points <= -3) {
    triggerScreenShake();
  }
}

// ── Emote System ────────────────────────────────────────────

const EMOTE_MAP: Record<EmoteType, string> = {
  laugh: "😂",
  scream: "😱",
  shake: "🫨",
  cry: "😭",
};

async function sendEmote(type: EmoteType): Promise<void> {
  if (!gameChannel) return;
  await gameChannel.send({
    type: "broadcast",
    event: "emote",
    payload: { from: sessionId(), type },
  });
  // Show own emote locally
  const me = players.find((p: Player) => p.session_id === sessionId());
  showEmoteBubble({ from: sessionId(), fromName: me?.name ?? "???", type });
}

function showEmoteBubble(data: NonNullable<EmoteData>): void {
  if (emoteTimer) clearTimeout(emoteTimer);
  setActiveEmote(data);
  emoteTimer = setTimeout(() => {
    setActiveEmote(null);
    emoteTimer = null;
  }, 2000);
}

// ── Chat ────────────────────────────────────────────────────

function sendChat(text: string): void {
  if (!gameChannel || !text.trim()) return;
  const me = players.find((p: Player) => p.session_id === sessionId());
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    from: sessionId(),
    name: me?.name ?? "???",
    text: text.trim(),
    ts: Date.now(),
  };
  gameChannel.send({ type: "broadcast", event: "chat", payload: msg });
  // Also add locally (broadcast doesn't echo back to sender)
  setChatMessages((prev) => [...prev.slice(-49), msg]);
}

function setChatOpenState(open: boolean): void {
  chatOpen = open;
  if (open) setUnreadChat(0);
}

// ── Screen Shake ────────────────────────────────────────────

function triggerScreenShake(): void {
  setScreenShake(true);
  setTimeout(() => setScreenShake(false), 500);
}

// ── Subscribe to Game Events ────────────────────────────────

function subscribeToGameEvents(roomId: string): void {
  // Cleanup previous
  if (gameChannel) {
    supabase.removeChannel(gameChannel);
    gameChannel = null;
  }

  gameChannel = supabase.channel(`game:${roomId}`);

  // ── bean-revealed — update board for all non-clicking players ──
  gameChannel.on("broadcast", { event: "bean-revealed" }, (payload: any) => {
    const data = payload.payload as BroadcastPayloads["bean-revealed"];

    // Update board state (skip if already revealed via optimistic UI)
    setBoard(
      produce((draft: GameBoardSlotWithBean[]) => {
        const target = draft.find(
          (s: GameBoardSlotWithBean) => s.slot_index === data.slot_index,
        );
        if (target && !target.is_revealed) {
          target.is_revealed = true;
          target.revealed_by = data.revealed_by;
        }
      }),
    );

    // Show popup for OTHER players (clicker already sees it)
    if (data.revealed_by !== sessionId()) {
      showRevealPopup(data);
    }
  });

  // ── emote — show reaction from other players ──
  gameChannel.on("broadcast", { event: "emote" }, (payload: any) => {
    const data = payload.payload as BroadcastPayloads["emote"];
    if (data.from !== sessionId()) {
      const p = players.find((pl: Player) => pl.session_id === data.from);
      showEmoteBubble({
        from: data.from,
        fromName: p?.name ?? "???",
        type: data.type,
      });
    }
  });

  // ── chat — receive messages from all players ──
  gameChannel.on("broadcast", { event: "chat" }, (payload: any) => {
    const msg = payload.payload as ChatMessage;
    setChatMessages((prev) => [...prev.slice(-49), msg]);  // keep last 50
    if (!chatOpen && msg.from !== sessionId()) {
      setUnreadChat((c) => c + 1);
    }
  });

  // ── game-ended — handled by roomStore's postgres_changes ──
  // The room().status will change to "finished" which Game.tsx watches

  gameChannel.subscribe();

  _gameRoomId = roomId;
}

// ── Reconnect Game — re-fetch board + re-subscribe ──────────

async function reconnectGame(): Promise<void> {
  const roomId = _gameRoomId;
  if (!roomId) return;

  // Re-load board from DB
  await loadBoard(roomId);

  // Re-subscribe to game events
  subscribeToGameEvents(roomId);
}

// ── Cleanup ─────────────────────────────────────────────────

function cleanupGame(): void {
  if (gameChannel) {
    supabase.removeChannel(gameChannel);
    gameChannel = null;
  }
  if (popupTimer) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }
  if (emoteTimer) {
    clearTimeout(emoteTimer);
    emoteTimer = null;
  }
  _gameRoomId = null;
  setBoard([]);
  setRevealPopup(null);
  setActiveEmote(null);
  setScreenShake(false);
  setChatMessages([]);
  setUnreadChat(0);
  chatOpen = false;
  setGameLoading(true);
}

// ── Exports ─────────────────────────────────────────────────

export {
  // State
  board,
  revealPopup,
  revealPopups,
  gameLoading,
  setGameLoading,
  activeEmote,
  screenShake,
  chatMessages,
  unreadChat,
  // Derived
  isMyTurn,
  currentTurnPlayer,
  isGameOver,
  unrevealed,
  sortedPlayers,
  rankedPlayers,
  // Constants
  EMOTE_MAP,
  // Actions
  initBoard,
  loadBoard,
  clickBean,
  autoSkipTurn,
  sendEmote,
  sendChat,
  setChatOpenState,
  subscribeToGameEvents,
  reconnectGame,
  cleanupGame,
};

export type { EmoteType };
