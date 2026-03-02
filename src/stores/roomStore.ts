// ============================================================
// Room Store — Create / Join / Presence / Ready / Start Game
// Uses Supabase Realtime Presence + Broadcast
// ============================================================
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { supabase } from "../lib/supabase";
import { sessionId, nickname } from "./playerStore";
import {
  generateRoomCode,
  rollTurnOrder,
  normalizeRoomCode,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from "../lib/roomHelpers";
import type { GameRoom, Player } from "../types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Connection Status ───────────────────────────────────────

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";
const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>("connected");

// ── State ───────────────────────────────────────────────────

const [room, setRoom] = createSignal<GameRoom | null>(null);
const [players, setPlayers] = createStore<Player[]>([]);
const [error, setError] = createSignal<string>("");
const [loading, setLoading] = createSignal(false);
const [diceResults, setDiceResults] = createSignal<number[] | null>(null);

let channel: RealtimeChannel | null = null;
let _currentRoomId: string | null = null;

// ── Derived ─────────────────────────────────────────────────

function myPlayer(): Player | undefined {
  return players.find((p: Player) => p.session_id === sessionId());
}

function isHost(): boolean {
  return players.length > 0 && players[0].session_id === sessionId();
}

function allReady(): boolean {
  return players.length >= MIN_PLAYERS && players.every((p: Player) => p.is_ready);
}

function canStart(): boolean {
  return isHost() && allReady();
}

// ── Create Room ─────────────────────────────────────────────

async function createRoom(): Promise<string | null> {
  setLoading(true);
  setError("");

  const code = generateRoomCode();
  const player: Player = {
    session_id: sessionId(),
    name: nickname(),
    ip: "",
    score: 0,
    turn_order: 0,
    is_ready: false,
  };

  const { data, error: err } = await supabase
    .from("game_rooms")
    .insert({
      room_code: code,
      status: "waiting",
      players: [player],
      current_turn: 0,
      total_clicked: 0,
    })
    .select()
    .single();

  setLoading(false);

  if (err) {
    // Retry once on code collision
    if (err.code === "23505") return createRoom();
    setError("สร้างห้องไม่สำเร็จ: " + err.message);
    return null;
  }

  setRoom(data as GameRoom);
  setPlayers(data.players as Player[]);
  return code;
}

// ── Join Room ───────────────────────────────────────────────

async function joinRoom(rawCode: string): Promise<boolean> {
  setLoading(true);
  setError("");

  const code = normalizeRoomCode(rawCode);

  // 1. Fetch room
  const { data: roomData, error: fetchErr } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("room_code", code)
    .single();

  if (fetchErr || !roomData) {
    setLoading(false);
    setError("ไม่พบห้อง " + code);
    return false;
  }

  const r = roomData as GameRoom;

  // Check if already in room — allow rejoin regardless of status
  const existing = r.players.find((p) => p.session_id === sessionId());
  if (existing) {
    setRoom(r);
    setPlayers(r.players);
    setLoading(false);
    return true;
  }

  // New player: only allow joining rooms still in 'waiting' status
  if (r.status !== "waiting") {
    setLoading(false);
    setError("ห้องนี้เริ่มเกมไปแล้ว");
    return false;
  }

  // Check max players
  if (r.players.length >= MAX_PLAYERS) {
    setLoading(false);
    setError("ห้องเต็มแล้ว (สูงสุด " + MAX_PLAYERS + " คน)");
    return false;
  }

  // 2. Add player
  const newPlayer: Player = {
    session_id: sessionId(),
    name: nickname(),
    ip: "",
    score: 0,
    turn_order: r.players.length,
    is_ready: false,
  };

  const updatedPlayers = [...r.players, newPlayer];

  const { error: updateErr } = await supabase
    .from("game_rooms")
    .update({ players: updatedPlayers })
    .eq("id", r.id);

  if (updateErr) {
    setLoading(false);
    setError("เข้าห้องไม่สำเร็จ: " + updateErr.message);
    return false;
  }

  r.players = updatedPlayers;
  setRoom(r);
  setPlayers(updatedPlayers);
  setLoading(false);
  return true;
}

// ── Realtime: Subscribe to Room ─────────────────────────────

function subscribeToRoom(roomId: string) {
  // Cleanup previous channel
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  channel = supabase
    .channel(`room:${roomId}`, {
      config: { presence: { key: sessionId() } },
    });

  // Track presence (for showing who's online)
  channel.on("presence", { event: "sync" }, () => {
    // Presence sync — we use DB as source of truth, presence is visual only
  });

  // Listen to DB changes on this room
  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "game_rooms",
      filter: `id=eq.${roomId}`,
    },
    (payload: any) => {
      const updated = payload.new as GameRoom;
      setRoom(updated);
      setPlayers(updated.players);
    }
  );

  // Listen to broadcast events
  channel.on("broadcast", { event: "dice-roll" }, (payload: any) => {
    setDiceResults(payload.payload.results as number[]);
  });

  channel.on("broadcast", { event: "game-starting" }, () => {
    // Navigation will be handled by the Lobby component
  });

  channel.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED") {
      setConnectionStatus("connected");
      await channel!.track({
        session_id: sessionId(),
        name: nickname(),
        online_at: new Date().toISOString(),
      });
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      setConnectionStatus("disconnected");
    }
  });

  _currentRoomId = roomId;
}

// ── Toggle Ready ────────────────────────────────────────────

async function toggleReady() {
  const r = room();
  if (!r) return;

  const updated = r.players.map((p: Player) =>
    p.session_id === sessionId() ? { ...p, is_ready: !p.is_ready } : p
  );

  const { error: err } = await supabase
    .from("game_rooms")
    .update({ players: updated })
    .eq("id", r.id);

  if (err) {
    setError("อัปเดต Ready ไม่สำเร็จ");
    return;
  }

  setPlayers(updated);
}

// ── Start Game (Host only) ──────────────────────────────────

async function startGame() {
  const r = room();
  if (!r || !canStart()) return;

  setLoading(true);

  // 1. Roll dice for turn order
  const turnOrder = rollTurnOrder(r.players.length);
  const playersWithTurns = r.players.map((p: Player, i: number) => ({
    ...p,
    turn_order: turnOrder[i],
  }));

  // Sort by turn_order so current_turn=0 means the first player
  playersWithTurns.sort((a: Player, b: Player) => a.turn_order - b.turn_order);

  // 2. Broadcast dice results for animation
  if (channel) {
    await channel.send({
      type: "broadcast",
      event: "dice-roll",
      payload: { results: turnOrder },
    });
  }

  // 3. Update room status to "playing"
  const { error: err } = await supabase
    .from("game_rooms")
    .update({
      status: "playing",
      players: playersWithTurns,
      current_turn: 0,
    })
    .eq("id", r.id);

  if (err) {
    setLoading(false);
    setError("เริ่มเกมไม่สำเร็จ: " + err.message);
    return;
  }

  // 4. Broadcast game start
  if (channel) {
    await channel.send({
      type: "broadcast",
      event: "game-starting",
      payload: {},
    });
  }

  setLoading(false);
}

// ── Reconnect — re-fetch room + re-subscribe ───────────────

async function reconnect(): Promise<void> {
  const r = room();
  const roomId = _currentRoomId || r?.id;
  if (!roomId) return;

  setConnectionStatus("reconnecting");

  // Re-fetch latest room state from DB
  const { data, error: fetchErr } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchErr || !data) {
    setConnectionStatus("disconnected");
    setError("ไม่สามารถเชื่อมต่อห้องได้");
    return;
  }

  const updated = data as GameRoom;
  setRoom(updated);
  setPlayers(updated.players);

  // Re-subscribe channel
  subscribeToRoom(roomId);
}

// ── Room Expiry Check ───────────────────────────────────────

const ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function isRoomExpired(r: GameRoom): boolean {
  const created = new Date(r.created_at!).getTime();
  return Date.now() - created > ROOM_MAX_AGE_MS;
}

// ── Network & Visibility Listeners ──────────────────────────

function handleOnline() {
  if (_currentRoomId) reconnect();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible" && _currentRoomId) {
    reconnect();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", () => setConnectionStatus("disconnected"));
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

// ── Leave Room ──────────────────────────────────────────────

async function leaveRoom() {
  const r = room();
  if (!r) return;

  const updated = r.players.filter((p: Player) => p.session_id !== sessionId());

  if (updated.length === 0) {
    // Delete room if last player leaves
    await supabase.from("game_rooms").delete().eq("id", r.id);
  } else {
    await supabase
      .from("game_rooms")
      .update({ players: updated })
      .eq("id", r.id);
  }

  cleanup();
}

// ── Cleanup ─────────────────────────────────────────────────

function cleanup() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  _currentRoomId = null;
  setRoom(null);
  setPlayers([]);
  setError("");
  setDiceResults(null);
  setConnectionStatus("connected");
}

// ── Exports ─────────────────────────────────────────────────

export {
  room,
  players,
  error,
  loading,
  diceResults,
  connectionStatus,
  myPlayer,
  isHost,
  allReady,
  canStart,
  isRoomExpired,
  createRoom,
  joinRoom,
  subscribeToRoom,
  toggleReady,
  startGame,
  leaveRoom,
  reconnect,
  cleanup,
};
