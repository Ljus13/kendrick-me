// ============================================================
// Database types matching Supabase schema
// Auto-use: import type { Bean, GameRoom, ... } from "~/types/database"
// ============================================================

/** beans_master row */
export interface Bean {
  id: string;
  flavor: string;
  flavor_th: string;
  points: number;
  img_hidden: string | null;
  img_revealed: string | null;
  created_at: string;
}

/** Player object stored inside game_rooms.players JSONB */
export interface Player {
  session_id: string;
  name: string;
  ip: string;
  score: number;
  turn_order: number;
  is_ready: boolean;
}

/** game_rooms row */
export interface GameRoom {
  id: string;
  room_code: string;
  status: "waiting" | "playing" | "finished";
  players: Player[];
  current_turn: number;
  total_clicked: number;
  bean_count: number; // 20, 30, 40, or 50
  created_at: string;
}

/** game_board row — dynamic grid based on room's bean_count */
export interface GameBoardSlot {
  id: string;
  room_id: string;
  slot_index: number;
  bean_id: string;
  is_revealed: boolean;
  revealed_by: string | null;
}

/** Enriched board slot with bean details (for UI rendering) */
export interface GameBoardSlotWithBean extends GameBoardSlot {
  bean: Bean;
}

/** global_leaderboard row — upsert by player_name */
export interface LeaderboardEntry {
  id: string;
  player_name: string;
  total_score: number;
  games_played: number;
  best_score: number | null;
  last_played: string;
  ip_address: string | null;
}

/** profiles row — linked to Supabase Auth (future premium features) */
export interface Profile {
  id: string; // = auth.users.id
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "player" | "admin";
  created_at: string;
}

/** Available bean count options when creating a room */
export const BEAN_COUNT_OPTIONS = [20, 30, 40, 50] as const;
export type BeanCountOption = (typeof BEAN_COUNT_OPTIONS)[number];

/** Grid layout config for each bean count */
export interface GridConfig {
  cols: number;
  rows: number;
  total: number;
}

export function getGridConfig(beanCount: number): GridConfig {
  switch (beanCount) {
    case 20: return { cols: 5, rows: 4, total: 20 };
    case 30: return { cols: 6, rows: 5, total: 30 };
    case 40: return { cols: 8, rows: 5, total: 40 };
    case 50: return { cols: 10, rows: 5, total: 50 };
    default: return { cols: 5, rows: 4, total: 20 };
  }
}

/** Get max players allowed for a given bean count */
export function getMaxPlayers(beanCount: number): number {
  return beanCount === 40 ? 6 : 4;
}

/** Absolute minimum/maximum player constants */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS_ABSOLUTE = 6;

/** Supabase Realtime broadcast payloads */
export interface BroadcastPayloads {
  "bean-revealed": {
    slot_index: number;
    bean_id: string;
    revealed_by: string;
    flavor: string;
    points: number;
  };
  "turn-changed": {
    current_turn: number;
    next_player_session_id: string;
  };
  "game-ended": {
    rankings: Array<{ name: string; score: number; rank: number }>;
  };
  "emote": {
    from: string;
    type: "laugh" | "scream" | "shake" | "cry";
  };
}
