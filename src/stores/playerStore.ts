// ============================================================
// Player Session Store — No-auth player identity via localStorage
// ============================================================
import { createSignal } from "solid-js";

const SESSION_KEY = "bb_session_id";
const NICKNAME_KEY = "bb_nickname";
const ACTIVE_ROOM_KEY = "bb_active_room";

/** Generate a UUID v4 (modern browsers) */
function uuid(): string {
  return crypto.randomUUID();
}

// ── Bootstrap from localStorage ─────────────────────────────

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getSavedNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

// ── Reactive signals ────────────────────────────────────────

const [sessionId] = createSignal<string>(getOrCreateSessionId());
const [nickname, setNicknameSignal] = createSignal<string>(getSavedNickname());
const [activeRoomCode, setActiveRoomCodeSignal] = createSignal<string>(
  localStorage.getItem(ACTIVE_ROOM_KEY) ?? ""
);

/** Set nickname and persist to localStorage */
function setNickname(name: string) {
  const trimmed = name.trim().slice(0, 20); // max 20 chars
  localStorage.setItem(NICKNAME_KEY, trimmed);
  setNicknameSignal(trimmed);
}

/** Track which room the player is currently in */
function setActiveRoomCode(code: string) {
  if (code) {
    localStorage.setItem(ACTIVE_ROOM_KEY, code);
  } else {
    localStorage.removeItem(ACTIVE_ROOM_KEY);
  }
  setActiveRoomCodeSignal(code);
}

/** Check if player has valid identity */
function isReady(): boolean {
  return nickname().length >= 2;
}

export { sessionId, nickname, setNickname, isReady, activeRoomCode, setActiveRoomCode };
