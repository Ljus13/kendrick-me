// ============================================================
// Room Store — Create / Join / Presence / Ready / Start Game
// Uses Supabase Realtime Presence + Broadcast
// ============================================================
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { supabase } from "../lib/supabase";
import { sessionId, nickname, setActiveRoomCode, clientIP } from "./playerStore";
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

// ── Online Players (Presence-based) ─────────────────────────

const [onlinePlayers, setOnlinePlayers] = createSignal<Set<string>>(new Set());

// ── Host Disconnect Timer ───────────────────────────────────

const HOST_TRANSFER_DELAY = 2 * 60 * 1000; // 2 minutes
let hostDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
const [hostDisconnectedAt, setHostDisconnectedAt] = createSignal<number | null>(null);

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

  // Check duplicate name across all active rooms
  const nameConflict = await checkNameConflict(nickname(), sessionId());
  if (nameConflict) {
    setLoading(false);
    setError("มีการใช้งานชื่อ \"" + nickname() + "\" อยู่แล้ว โปรดใช้ชื่ออื่น");
    return null;
  }

  const code = generateRoomCode();
  const player: Player = {
    session_id: sessionId(),
    name: nickname(),
    ip: clientIP(),
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
  setActiveRoomCode(code);
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
    setActiveRoomCode(code);
    setLoading(false);
    return true;
  }

  // Check duplicate name across all active rooms (different IP)
  const nameConflict = await checkNameConflict(nickname(), sessionId());
  if (nameConflict) {
    setLoading(false);
    setError("มีการใช้งานชื่อ \"" + nickname() + "\" อยู่แล้ว โปรดใช้ชื่ออื่น");
    return false;
  }

  // New player: check if already in ANOTHER room (prevent multi-room)
  const { data: otherRooms } = await supabase
    .from("game_rooms")
    .select("id, room_code, players, status")
    .in("status", ["waiting", "playing"]);

  if (otherRooms) {
    const otherRoom = otherRooms.find(
      (or: any) => or.room_code !== code && 
        (or.players as Player[]).some((p: Player) => p.session_id === sessionId())
    );
    if (otherRoom) {
      // Auto-leave the other room first
      const otherPlayers = (otherRoom.players as Player[]).filter(
        (p: Player) => p.session_id !== sessionId()
      );
      if (otherPlayers.length === 0) {
        await supabase.from("game_board").delete().eq("room_id", otherRoom.id);
        await supabase.from("game_rooms").delete().eq("id", otherRoom.id);
      } else {
        await supabase.from("game_rooms")
          .update({ players: otherPlayers })
          .eq("id", otherRoom.id);
      }
    }
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
    ip: clientIP(),
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
  setActiveRoomCode(code);
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
    const state = channel!.presenceState();
    const ids = new Set<string>();
    for (const presences of Object.values(state)) {
      for (const p of presences as any[]) {
        if (p.session_id) ids.add(p.session_id as string);
      }
    }
    setOnlinePlayers(ids);
  });

  // Detect player join (cancel host timer if host returns)
  channel.on("presence", { event: "join" }, ({ newPresences }: any) => {
    for (const p of newPresences) {
      const r = room();
      if (r && r.players[0]?.session_id === p.session_id && hostDisconnectTimer) {
        clearTimeout(hostDisconnectTimer);
        hostDisconnectTimer = null;
        setHostDisconnectedAt(null);
      }
    }
  });

  // Detect player leave (start host timer if host left)
  channel.on("presence", { event: "leave" }, ({ leftPresences }: any) => {
    for (const p of leftPresences) {
      handlePlayerLeavePresence(p.session_id as string);
    }
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

// ── Host Disconnect Detection ───────────────────────────────

function handlePlayerLeavePresence(leftSessionId: string) {
  const r = room();
  if (!r || r.status !== "playing") return;

  // Check if the host left
  if (r.players[0]?.session_id === leftSessionId) {
    if (!hostDisconnectTimer) {
      setHostDisconnectedAt(Date.now());
      hostDisconnectTimer = setTimeout(() => {
        transferHost();
      }, HOST_TRANSFER_DELAY);
    }
  }
}

/** Transfer host role to a random online player after 2-min timeout */
async function transferHost() {
  const r = room();
  if (!r) return;

  const online = onlinePlayers();

  // Only the first online player executes the actual DB write
  const sorted = [...r.players].sort((a: Player, b: Player) => a.turn_order - b.turn_order);
  const firstOnline = sorted.find((p) => online.has(p.session_id));
  if (!firstOnline || firstOnline.session_id !== sessionId()) {
    hostDisconnectTimer = null;
    setHostDisconnectedAt(null);
    return;
  }

  const onlineOthers = r.players.filter(
    (p) => p.session_id !== r.players[0].session_id && online.has(p.session_id)
  );

  if (onlineOthers.length === 0) return;

  // Random pick
  const newHost = onlineOthers[Math.floor(Math.random() * onlineOthers.length)];

  // Reorder: put new host first, keep others in same relative order
  const rest = r.players.filter((p) => p.session_id !== newHost.session_id);
  const reordered = [newHost, ...rest];

  await supabase
    .from("game_rooms")
    .update({ players: reordered })
    .eq("id", r.id);

  hostDisconnectTimer = null;
  setHostDisconnectedAt(null);
}

// ── End Game Early ──────────────────────────────────────────

async function endGameEarly() {
  const r = room();
  if (!r || r.status === "finished") return;

  await supabase
    .from("game_rooms")
    .update({ status: "finished" })
    .eq("id", r.id);
}

// ── Name & IP Conflict Checks ───────────────────────────────

/** Check if the name is used by another session in any active room */
async function checkNameConflict(name: string, mySessionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("game_rooms")
    .select("players")
    .in("status", ["waiting", "playing"]);

  if (!data) return false;

  for (const rm of data) {
    const roomPlayers = rm.players as Player[];
    for (const p of roomPlayers) {
      if (p.name === name && p.session_id !== mySessionId) {
        return true;
      }
    }
  }
  return false;
}

/** Check if the same IP (different session) is in an active room */
export interface IPConflictResult {
  found: boolean;
  roomCode?: string;
  playerName?: string;
  sessionId?: string;
}

async function checkIPConflict(ip: string, mySessionId: string): Promise<IPConflictResult> {
  if (!ip) return { found: false };

  const { data } = await supabase
    .from("game_rooms")
    .select("room_code, players")
    .in("status", ["waiting", "playing"]);

  if (!data) return { found: false };

  for (const rm of data) {
    const roomPlayers = rm.players as Player[];
    for (const p of roomPlayers) {
      if (p.ip === ip && p.session_id !== mySessionId) {
        return {
          found: true,
          roomCode: rm.room_code as string,
          playerName: p.name,
          sessionId: p.session_id,
        };
      }
    }
  }
  return { found: false };
}

/** Take over an existing session (same device, different browser) */
async function takeOverSession(roomCode: string, oldSessionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (!data) return false;

  const r = data as GameRoom;
  const updatedPlayers = r.players.map((p: Player) =>
    p.session_id === oldSessionId
      ? { ...p, session_id: sessionId(), name: nickname(), ip: clientIP() }
      : p
  );

  const { error: updateErr } = await supabase
    .from("game_rooms")
    .update({ players: updatedPlayers })
    .eq("id", r.id);

  if (updateErr) return false;

  r.players = updatedPlayers;
  setRoom(r);
  setPlayers(updatedPlayers);
  setActiveRoomCode(roomCode);
  return true;
}

// ── Leave Room ──────────────────────────────────────────────

async function leaveRoom() {
  const r = room();
  if (!r) return;

  const updated = r.players.filter((p: Player) => p.session_id !== sessionId());

  if (updated.length === 0) {
    // Delete room if last player leaves
    await supabase.from("game_board").delete().eq("room_id", r.id);
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
  if (hostDisconnectTimer) {
    clearTimeout(hostDisconnectTimer);
    hostDisconnectTimer = null;
  }
  _currentRoomId = null;
  setRoom(null);
  setPlayers([]);
  setError("");
  setDiceResults(null);
  setConnectionStatus("connected");
  setActiveRoomCode("");
  setOnlinePlayers(new Set<string>());
  setHostDisconnectedAt(null);
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
  onlinePlayers,
  hostDisconnectedAt,
  createRoom,
  joinRoom,
  subscribeToRoom,
  toggleReady,
  startGame,
  leaveRoom,
  reconnect,
  cleanup,
  checkNameConflict,
  checkIPConflict,
  takeOverSession,
  endGameEarly,
  transferHost,
};
