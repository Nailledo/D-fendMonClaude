import type { Difficulty } from './types';

/**
 * Toutes les formules d'adaptation de la difficulté.
 * n = nombre de joueurs actifs (1 à 4).
 */
export const BALANCE = {
  /** multiplicateur de PV selon le nombre de joueurs (calibré par tools/tune-players.ts) */
  hpByPlayers: [1, 1.78, 2.28, 2.56],
  countPerPlayer: 0.3,
  bossHpPerPlayer: 0.4,
  startGold: [1, 0.7, 0.6, 0.55],
  bountyShare: [1, 0.62, 0.48, 0.4],
  diffHp: [0.8, 1, 1.35],
  diffBounty: [1.1, 1, 0.9],
  diffLives: [20, 20, 1],
  /** délai entre deux vagues (s) */
  waveGap: 20,
  survivalWaveGap: 16,
  /** bonus d'or par seconde restante quand on appelle une vague en avance */
  earlyGoldPerSec: 1.5,
  earlySpellCdPerSec: 0.4,
};

export interface Scaling {
  n: number;
  hpMul: number;
  countMul: number;
  bossHpMul: number;
  startGoldMul: number;
  bountyMul: number;
  lives: number;
}

export function computeScaling(nPlayers: number, diff: Difficulty, multiK = 1): Scaling {
  const n = Math.max(1, Math.min(4, nPlayers));
  const b = BALANCE;
  return {
    n,
    hpMul: (1 + (b.hpByPlayers[n - 1] - 1) * multiK) * b.diffHp[diff],
    countMul: 1 + b.countPerPlayer * (n - 1),
    bossHpMul: (1 + b.bossHpPerPlayer * (n - 1)) * b.diffHp[diff],
    startGoldMul: b.startGold[n - 1],
    bountyMul: b.bountyShare[n - 1] * b.diffBounty[diff],
    lives: b.diffLives[diff],
  };
}

/** Or touché par CHAQUE joueur actif quand la vague est appelée avec `secondsLeft` secondes d'avance. */
export function earlyCallBonus(secondsLeft: number, activePlayers: number): number {
  const n = Math.max(1, Math.min(4, activePlayers));
  return Math.floor(secondsLeft * BALANCE.earlyGoldPerSec * BALANCE.bountyShare[n - 1]);
}

export function starsFor(lives: number, maxLives: number): number {
  if (maxLives <= 1) return lives > 0 ? 3 : 0;
  if (lives >= 18) return 3;
  if (lives >= 6) return 2;
  return lives > 0 ? 1 : 0;
}
