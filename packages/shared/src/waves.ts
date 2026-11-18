import { ENEMIES, ENEMY_INDEX, TRAIT_BITS, type EnemyDef } from './data/enemies';
import type { LevelDef, RosterEntry } from './data/levels';
import { Rng, ipow } from './rng';
import type { Biome } from './types';

export interface WaveGroup {
  type: number;
  count: number;
  /** secondes entre deux apparitions */
  interval: number;
  path: number;
  /** secondes avant le début du groupe */
  delay: number;
  hpMul?: number;
  /** propriétés ajoutées aux ennemis du groupe (voir Trait) */
  traits?: number;
}

export interface Wave {
  groups: WaveGroup[];
  boss: boolean;
  mutation?: number;
}

function intervalFor(def: EnemyDef): number {
  if (def.boss) return 1;
  if (def.threat < 2) return 0.9;
  if (def.threat < 5) return 1.5;
  if (def.threat < 12) return 2.4;
  return 3.5;
}

function buildGroups(budget: number, roster: RosterEntry[], waveNo: number, activePaths: number[], rng: Rng, weightMul?: (d: EnemyDef) => number): WaveGroup[] {
  const avail = roster.filter((r) => r.from <= waveNo);
  if (avail.length === 0) return [];
  const nGroups = Math.min(avail.length, 1 + Math.floor(waveNo / 3), 4) + (activePaths.length > 1 ? 1 : 0);
  // le type tout juste débloqué est toujours présenté
  const fresh = avail.filter((r) => r.from === waveNo);
  const picks: RosterEntry[] = [...fresh];
  let guard = 0;
  while (picks.length < nGroups && guard++ < 50) {
    let total = 0;
    for (const r of avail) total += r.w * (weightMul ? weightMul(ENEMIES[ENEMY_INDEX[r.type]]) : 1);
    let x = rng.next() * total;
    for (const r of avail) {
      x -= r.w * (weightMul ? weightMul(ENEMIES[ENEMY_INDEX[r.type]]) : 1);
      if (x <= 0) { picks.push(r); break; }
    }
  }
  const groups: WaveGroup[] = [];
  const share = budget / picks.length;
  let delay = 0;
  picks.forEach((r, gi) => {
    const t = ENEMY_INDEX[r.type];
    const def = ENEMIES[t];
    const count = Math.max(1, Math.round(share / def.threat));
    const interval = intervalFor(def);
    groups.push({ type: t, count, interval, path: activePaths[gi % activePaths.length], delay });
    delay += Math.min(count * interval * 0.6, 8) + rng.range(0.5, 2.5);
  });
  return groups;
}

/**
 * Ajoute des propriétés (camouflé, plomb, régénérant) aux groupes d'une vague.
 * `from` : première vague de chaque propriété ; `chance` : probabilité par groupe et par propriété.
 * Tirage séparé : les vagues elles-mêmes ne changent pas.
 */
function addTraits(groups: WaveGroup[], wave: number, from: [number, number, number], chance: number, rng: Rng) {
  const cands = groups.filter((g) => !ENEMIES[g.type].boss);
  if (!cands.length) return;
  TRAIT_BITS.forEach((bit, i) => {
    const f = from[i];
    if (!f || wave < f) return;
    let any = false;
    // le plomb est plus rare, et réservé aux ennemis de taille moyenne (pas de golem en plomb)
    const lead = bit === 2;
    const pool = lead ? cands.filter((g) => ENEMIES[g.type].threat < 12) : cands;
    if (!pool.length) return;
    const ch = lead ? chance * 0.45 : chance;
    for (const g of pool) {
      const roll = rng.next();
      if (roll < ch) { g.traits = (g.traits ?? 0) | bit; any = true; }
    }
    // la vague où elle apparaît, la propriété est toujours présentée
    if (wave === f && !any) {
      const g = pool[Math.floor(rng.next() * pool.length)];
      g.traits = (g.traits ?? 0) | bit;
    }
  });
}

/**
 * Chapardeur : de temps en temps, un (puis deux) gobelin voleur se glisse dans la vague.
 * Tirage séparé : le reste de la vague ne change pas.
 */
function addThief(groups: WaveGroup[], wave: number, from: number, chance: number, active: number[], hpMul: number, rng: Rng) {
  if (wave < from || rng.next() >= chance) return;
  const last = groups.reduce((m, g) => Math.max(m, g.delay), 0);
  groups.push({
    type: ENEMY_INDEX.chapardeur, count: wave >= from + 6 && rng.next() < 0.4 ? 2 : 1, interval: 2.5,
    path: active[Math.floor(rng.next() * active.length)], delay: 3 + rng.next() * Math.max(2, last), hpMul,
  });
}

export function genStoryWaves(level: LevelDef, nPaths: number): Wave[] {
  const rng = new Rng(1000 + level.index * 7919);
  const paths = Array.from({ length: nPaths }, (_, i) => i);
  const waves: Wave[] = [];
  for (let w = 1; w <= level.waves; w++) {
    const budget = level.budget0 * ipow(level.growth, w - 1);
    // les chemins secondaires s'ouvrent à partir de la vague 2
    const active = w === 1 ? [0] : paths;
    const groups = buildGroups(budget, level.roster, w, active, rng);
    const hpMul = 1 + level.hpRamp * (w - 1);
    for (const g of groups) g.hpMul = hpMul;
    let boss = false;
    if (level.boss && w === level.waves) {
      boss = true;
      const escorts = buildGroups(level.boss.escortBudget, level.roster, w, active, rng);
      const last = groups.reduce((m, g) => Math.max(m, g.delay), 0);
      groups.push({ type: ENEMY_INDEX[level.boss.type], count: 1, interval: 1, path: 0, delay: last + 8 });
      for (const e of escorts) { e.delay += last + 12; e.hpMul = hpMul; groups.push(e); }
    }
    if (level.index >= 1 && !boss) addThief(groups, w, 3, 0.4, active, hpMul, new Rng(4242 + level.index * 613 + w * 97));
    if (level.traits) {
      const t = level.traits;
      addTraits(groups, w, [t.camo ?? 0, t.lead ?? 0, t.regrow ?? 0], t.chance ?? 0.3, new Rng(77 + level.index * 1009 + w * 31));
    }
    waves.push({ groups, boss });
  }
  return waves;
}

// ---------------- Survie ----------------

export interface Mutation {
  id: string;
  name: string;
  desc: string;
}

export const MUTATIONS: Mutation[] = [
  { id: 'rapides', name: 'Pas de course', desc: 'Les ennemis sont 25 % plus rapides.' },
  { id: 'volants', name: 'Ciel noir', desc: 'Beaucoup plus d’ennemis volants.' },
  { id: 'regen', name: 'Sang de troll', desc: 'Les ennemis régénèrent 1,5 % de leurs PV par seconde.' },
  { id: 'blindes', name: 'Forge ennemie', desc: '+25 % d’armure physique.' },
  { id: 'resistants', name: 'Amulettes', desc: '+25 % de résistance magique.' },
  { id: 'nombreux', name: 'Marée', desc: '+40 % d’ennemis, mais 20 % de PV en moins.' },
  { id: 'colosses', name: 'Colosses', desc: '+60 % de PV, 30 % d’ennemis en moins.' },
  { id: 'riches', name: 'Butin', desc: 'Les primes rapportent 30 % d’or en plus.' },
];
export const MUTATION_INDEX: Record<string, number> = Object.fromEntries(MUTATIONS.map((m, i) => [m.id, i]));

const BIOME_ROSTER: Record<Biome, RosterEntry[]> = {
  vallee: [
    { type: 'gobelin', from: 1, w: 3 }, { type: 'loup', from: 2, w: 2 }, { type: 'corbeau', from: 3, w: 1.3 }, { type: 'brute', from: 4, w: 1.2 },
    { type: 'chaman', from: 6, w: 1 }, { type: 'bouclier', from: 8, w: 1 }, { type: 'noye', from: 14, w: 1 }, { type: 'cornu', from: 20, w: 1 },
    { type: 'golem', from: 26, w: 0.7 }, { type: 'gargouille', from: 22, w: 0.8 }, { type: 'chevalierinf', from: 30, w: 0.8 },
  ],
  marais: [
    { type: 'noye', from: 1, w: 3 }, { type: 'crapaud', from: 2, w: 2 }, { type: 'gobelin', from: 1, w: 1 }, { type: 'sorciere', from: 4, w: 1 },
    { type: 'limon', from: 5, w: 1.1 }, { type: 'ver', from: 7, w: 1 }, { type: 'chauvesouris', from: 9, w: 0.9 }, { type: 'brute', from: 12, w: 0.8 },
    { type: 'invocateur', from: 20, w: 0.8 }, { type: 'golem', from: 26, w: 0.6 }, { type: 'chevalierinf', from: 30, w: 0.8 },
  ],
  cendre: [
    { type: 'diablotin', from: 1, w: 3 }, { type: 'cornu', from: 3, w: 1.4 }, { type: 'gargouille', from: 4, w: 1.1 }, { type: 'invocateur', from: 6, w: 1 },
    { type: 'golem', from: 9, w: 0.8 }, { type: 'chevalierinf', from: 11, w: 1 }, { type: 'sorciere', from: 14, w: 0.7 }, { type: 'ver', from: 18, w: 0.7 },
    { type: 'limon', from: 22, w: 0.7 },
  ],
};

const BIOME_BOSS: Record<Biome, string[]> = {
  vallee: ['grolbak', 'vasiere', 'kessin1'],
  marais: ['vasiere', 'grolbak', 'kessin1'],
  cendre: ['grolbak', 'kessin1', 'vasiere'],
};

// ---------------- Météo

/** Temps d'une vague : pluie (les feux faiblissent, le givre est renforcé) et nuit (les archers voient moins loin). */
export interface Weather { rain: boolean; night: boolean }

/** Chances de pluie et de nuit selon le monde : surtout du soleil ; le marais est pluvieux, la cendre ne connaît pas la pluie. */
export const WEATHER_ODDS: Record<Biome, { rain: number; night: number }> = {
  vallee: { rain: 0.16, night: 0.18 },
  marais: { rain: 0.34, night: 0.22 },
  cendre: { rain: 0, night: 0.26 },
};

/** Temps d'une vague (déterministe) ; la première vague est toujours ensoleillée, de jour. */
export function weatherFor(biome: Biome, seed: number, wave: number): Weather {
  if (wave <= 1) return { rain: false, night: false };
  const rng = new Rng((seed ^ Math.imul(wave, 0x27d4eb2d)) + 0x3c6ef372);
  const o = WEATHER_ODDS[biome];
  const rain = rng.next() < o.rain;
  const night = rng.next() < o.night;
  return { rain, night };
}

/** Mutation active pour une vague donnée (changent toutes les 5 vagues). */
export function mutationsFor(seed: number, wave: number): number[] {
  if (wave < 5) return [];
  const epoch = Math.floor(wave / 5);
  const rng = new Rng(seed ^ (epoch * 2654435761));
  const a = rng.int(0, MUTATIONS.length - 1);
  if (wave < 30) return [a];
  let b = rng.int(0, MUTATIONS.length - 2);
  if (b >= a) b++;
  return [a, b];
}

export function genSurvivalWave(biome: Biome, seed: number, wave: number, activePaths: number[]): Wave {
  const rng = new Rng(seed ^ Math.imul(wave, 0x9e3779b1));
  const muts = mutationsFor(seed, wave);
  const has = (id: string) => muts.includes(MUTATION_INDEX[id]);
  let budget = 12 * ipow(1.12, wave - 1) + 3 * wave;
  const flyMul = has('volants') ? 3 : 1;
  const groups = buildGroups(budget, BIOME_ROSTER[biome], wave, activePaths, rng, (d) => (d.flying ? flyMul : 1));
  // limiter le nombre d'ennemis : l'excédent devient des PV
  let total = 0;
  for (const g of groups) total += g.count;
  const cap = 70;
  let hpMul = 1;
  if (total > cap) {
    hpMul = total / cap;
    for (const g of groups) g.count = Math.max(1, Math.round(g.count / hpMul));
  }
  if (has('nombreux')) { for (const g of groups) g.count = Math.ceil(g.count * 1.4); hpMul *= 0.8; }
  if (has('colosses')) { for (const g of groups) g.count = Math.max(1, Math.round(g.count * 0.7)); hpMul *= 1.6; }
  for (const g of groups) g.hpMul = hpMul;
  let boss = false;
  if (wave % 10 === 0) {
    boss = true;
    const cycle = Math.floor(wave / 10) - 1;
    const id = BIOME_BOSS[biome][cycle % 3];
    const last = groups.reduce((m, g) => Math.max(m, g.delay), 0);
    groups.push({ type: ENEMY_INDEX[id], count: 1, interval: 1, path: activePaths[0], delay: last + 6, hpMul: 0.45 * ipow(1.4, cycle) });
  }
  budget = 0;
  if (!boss) addThief(groups, wave, 4, 0.3, activePaths, hpMul, new Rng((seed ^ Math.imul(wave, 0x2545f491)) + 0x51ed27));
  // propriétés : camouflés dès la vague 8, régénérants dès la 12, plomb dès la 16, de plus en plus fréquents
  addTraits(groups, wave, [8, 16, 12], Math.min(0.5, 0.2 + wave * 0.006), new Rng((seed ^ Math.imul(wave, 0x85ebca6b)) + 0x7f4a7c15));
  return { groups, boss, mutation: muts[muts.length - 1] };
}
