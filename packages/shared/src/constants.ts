/** Fréquence de simulation (ticks par seconde). */
export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
/** Échelle des positions encodées en int16 dans le protocole. */
export const POS_SCALE = 64;
export const MAX_PLAYERS = 4;
/** Délai de grâce pour la reconnexion (secondes). */
export const RECONNECT_GRACE_S = 90;
/** Longueur des codes de salon (32 symboles : 32⁶ ≈ 1 milliard de codes). */
export const ROOM_CODE_LEN = 6;
/** Durée pendant laquelle une revente rembourse 100 % (annulation). */
export const UNDO_SELL_S = 3;
export const SELL_RATIO = 0.6;
export const PATH_HALF_WIDTH = 1.25;
export const PLAYER_COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xeab308];
export const PLAYER_COLOR_NAMES = ['Bleu', 'Rouge', 'Vert', 'Or'];

export const sec = (s: number) => Math.round(s * TICK_RATE);
