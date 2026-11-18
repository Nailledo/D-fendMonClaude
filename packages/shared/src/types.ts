import type { HeroBuild } from './data/classes';
export type Family = 'archer' | 'barracks' | 'mage' | 'artillery' | 'mine' | 'camp';
/** Familles de tours : les quatre de combat, puis la mine (économie) et le campement (soutien). */
export const FAMILIES: Family[] = ['archer', 'barracks', 'mage', 'artillery', 'mine', 'camp'];
export const FAMILY_INDEX: Record<Family, number> = { archer: 0, barracks: 1, mage: 2, artillery: 3, mine: 4, camp: 5 };
/** Familles qui tirent : elles ont une priorité de ciblage. */
export const SHOOTERS: readonly number[] = [0, 2, 3];

/** Priorité de ciblage d'une tour. */
export const enum Prio { First = 0, Last = 1, Strong = 2, Close = 3 }
export const PRIO_NAMES = ['Premier', 'Dernier', 'Plus fort', 'Plus proche'];

export const enum DmgType {
  Phys = 0,
  Magic = 1,
  True = 2,
}

/** Apparences jouables (sans nom : le héros porte le pseudo de son joueur). L'ordre sert d'index réseau. */
export type HeroId = 'samuel' | 'lyra' | 'brom' | 'nox' | 'ombre' | 'paladin' | 'druide' | 'ours' | 'brasier';
export const HERO_IDS: HeroId[] = ['samuel', 'lyra', 'brom', 'nox', 'ombre', 'paladin', 'druide', 'ours', 'brasier'];

export type Biome = 'vallee' | 'marais' | 'cendre';
export type Mode = 'story' | 'survival';
export type Difficulty = 0 | 1 | 2; // Normal, Vétéran, Cauchemar
export const DIFFICULTY_NAMES = ['Normal', 'Vétéran', 'Cauchemar'];

export interface PlayerInfo {
  id: number; // 0..3
  name: string;
  hero: HeroId;
  /** rangs achetés dans chaque branche de l'arbre de compétences (voir data/meta) */
  tree?: number[];
  /** objets de boutique emportés (stock par objet) */
  items?: number[];
  /** arbre du héros : classe et nœuds (voir data/classes) */
  build?: HeroBuild;
  /** les deux sorts généraux emportés (index de SPELLS, distincts) ; défaut : météores et renforts */
  spells?: [number, number];
}

export interface GameConfig {
  mode: Mode;
  mapId: string;
  difficulty: Difficulty;
  players: PlayerInfo[];
  seed: number;
}

export type Command =
  | { k: 'build'; slot: number; fam: number }
  | { k: 'up'; tower: number }
  | { k: 'spec'; tower: number; s: 1 | 2 }
  | { k: 'skill'; tower: number; i: 0 | 1 }
  | { k: 'sell'; tower: number }
  /** priorité de ciblage (voir Prio) */
  | { k: 'prio'; tower: number; p: number }
  | { k: 'rally'; tower: number; x: number; z: number }
  | { k: 'hmove'; x: number; z: number }
  /** le héros prend un ennemi pour cible : au contact pour la mêlée, à portée de tir pour les héros à distance */
  | { k: 'hattack'; e: number }
  | { k: 'hskill'; i: 0 | 1 | 2; x: number; z: number }
  /** objet de boutique (x, z : point visé pour les objets ciblés) */
  | { k: 'item'; i: number; x: number; z: number }
  | { k: 'spell'; s: 0 | 1; x: number; z: number }
  | { k: 'wave' }
  | { k: 'speed'; v: 1 | 2 }
  | { k: 'gift'; to: number; amt: number };

export const enum GameState {
  Waiting = 0,
  Running = 1,
  Won = 2,
  Lost = 3,
}
