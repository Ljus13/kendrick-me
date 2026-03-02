// ============================================================
// Player Session Store — No-auth player identity via localStorage
// ============================================================
import { createSignal } from "solid-js";

const SESSION_KEY = "bb_session_id";
const NICKNAME_KEY = "bb_nickname";

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

/** Set nickname and persist to localStorage */
function setNickname(name: string) {
  const trimmed = name.trim().slice(0, 20); // max 20 chars
  localStorage.setItem(NICKNAME_KEY, trimmed);
  setNicknameSignal(trimmed);
}

/** Check if player has valid identity */
function isReady(): boolean {
  return nickname().length >= 2;
}

export { sessionId, nickname, setNickname, isReady };
