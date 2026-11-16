import type { Difficulty } from './types';

/**
 * Toutes les formules d'adaptation de la difficulté.
 * n = nombre de joueurs actifs (1 à 4).
 */
export const BALANCE = {
  hpPerPlayer: 0.45,
  countPerPlayer: 0.35,
  bossHpPerPlayer: 0.6,
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

export function computeScaling(nPlayers: number, diff: Difficulty): Scaling {
  const n = Math.max(1, Math.min(4, nPlayers));
  const b = BALANCE;
  return {
    n,
    hpMul: (1 + b.hpPerPlayer * (n - 1)) * b.diffHp[diff],
    countMul: 1 + b.countPerPlayer * (n - 1),
    bossHpMul: (1 + b.bossHpPerPlayer * (n - 1)) * b.diffHp[diff],
    startGoldMul: b.startGold[n - 1],
    bountyMul: b.bountyShare[n - 1] * b.diffBounty[diff],
    lives: b.diffLives[diff],
  };
}

export function starsFor(lives: number, maxLives: number): number {
  if (maxLives <= 1) return lives > 0 ? 3 : 0;
  if (lives >= 18) return 3;
  if (lives >= 6) return 2;
  return lives > 0 ? 1 : 0;
}
