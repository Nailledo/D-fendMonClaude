import { computeScaling } from './balance';
import { ENEMIES } from './data/enemies';
import { LEVELS } from './data/levels';
import { MAPS } from './data/maps';
import type { GameConfig } from './types';
import { genStoryWaves, genSurvivalWave, mutationsFor, type Wave } from './waves';

/** Chemins ouverts pour une vague donnée (les chemins secondaires s'ouvrent au fil des vagues). */
export function activePathsFor(pathFrom: number[] | undefined, nPaths: number, wave: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < nPaths; i++) if (!pathFrom || (pathFrom[i] ?? 1) <= wave) res.push(i);
  return res.length ? res : [0];
}

/** Nombre d'ennemis d'un groupe une fois appliqué le multiplicateur de joueurs (même règle que la simulation). */
export function scaledCount(type: number, count: number, countMul: number): number {
  return ENEMIES[type].boss ? count : Math.max(1, Math.round(count * countMul));
}

export interface WavePreview {
  wave: number;
  boss: boolean;
  /** mutations actives (survie) */
  mutations: number[];
  /** ennemis par type, dans l'ordre d'arrivée */
  entries: { type: number; count: number }[];
}

const storyCache = new Map<string, Wave[]>();

/**
 * Contenu exact d'une vague, calculé comme le fait la simulation au moment où elle démarre.
 * Sert à l'aperçu affiché sur le bouton d'appel de vague.
 */
export function previewWave(cfg: GameConfig, wave: number, activePlayers: number): WavePreview | null {
  const def = MAPS[cfg.mapId];
  if (!def || wave < 1) return null;
  const nPaths = def.paths.length;
  const level = cfg.mode === 'story' ? LEVELS.find((l) => l.mapId === cfg.mapId) ?? null : null;
  let w: Wave | undefined;
  let mutations: number[] = [];
  if (level) {
    const key = `${level.index}:${nPaths}`;
    let all = storyCache.get(key);
    if (!all) storyCache.set(key, (all = genStoryWaves(level, nPaths)));
    w = all[wave - 1];
  } else {
    mutations = mutationsFor(cfg.seed, wave);
    w = genSurvivalWave(def.biome, cfg.seed, wave, activePathsFor(def.pathFrom, nPaths, wave));
  }
  if (!w) return null;
  const cm = computeScaling(activePlayers, cfg.difficulty, level?.multiK ?? 1).countMul;
  const entries: { type: number; count: number }[] = [];
  for (const g of [...w.groups].sort((a, b) => a.delay - b.delay)) {
    const n = scaledCount(g.type, g.count, cm);
    const e = entries.find((x) => x.type === g.type);
    if (e) e.count += n;
    else entries.push({ type: g.type, count: n });
  }
  return { wave, boss: w.boss, mutations, entries };
}
