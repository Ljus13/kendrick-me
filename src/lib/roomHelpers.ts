// ============================================================
// Room helper utilities — code generation, dice roll, etc.
// ============================================================

/**
 * Generate a room code like "BB-8899"
 * Format: BB-XXXX where X = random digit
 */
export function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000); // 4-digit
  return `BB-${num}`;
}

/**
 * Virtual dice roll — assign random turn_order to each player.
 * Returns a shuffled array of indices [0, 1, 2, …n-1]
 */
export function rollTurnOrder(playerCount: number): number[] {
  const order = Array.from({ length: playerCount }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Minimum players per room (constant) */
export const MIN_PLAYERS = 2;

/**
 * @deprecated Use getMaxPlayers(beanCount) from ~/types/database instead.
 * Kept for backward-compat; defaults to 4.
 */
export const MAX_PLAYERS = 4;

/** Validate room code format */
export function isValidRoomCode(code: string): boolean {
  return /^BB-\d{4}$/.test(code.toUpperCase().trim());
}

/** Normalize room code (uppercase + trim) */
export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().trim();
}
