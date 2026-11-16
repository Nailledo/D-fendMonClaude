import type { Biome } from '../types';

export interface MapDef {
  id: string;
  name: string;
  biome: Biome;
  /** demi-largeur / demi-hauteur de la zone jouable */
  hw: number;
  hh: number;
  paths: [number, number][][];
  /** vague (1-based) à partir de laquelle chaque chemin est utilisé */
  pathFrom?: number[];
  slotCount: number;
  heroSpawn?: [number, number];
  /** décor : étendues d'eau / lave [x, z, rayon] */
  pools?: [number, number, number][];
}

const common = { hw: 24, hh: 16 };

export const MAPS: Record<string, MapDef> = {
  pont: {
    id: 'pont', name: 'Le Pont d’Aubeclair', biome: 'vallee', ...common, slotCount: 14,
    paths: [[[-29, -6], [-18, -8], [-10, -3], [-12, 5], [-4, 9], [4, 4], [6, -5], [14, -8], [18, 0], [14, 7], [20, 11], [29, 10]]],
    pools: [[-1, -8, 3.2], [-19, 9, 2.5]],
  },
  moulins: {
    id: 'moulins', name: 'Les Moulins du Val', biome: 'vallee', ...common, slotCount: 16,
    paths: [
      [[-29, -10], [-16, -10], [-8, -5], [0, -6], [6, -1], [12, 4], [18, 2], [29, 3]],
      [[-29, 9], [-18, 10], [-10, 5], [-2, 7], [6, -1], [12, 4], [18, 2], [29, 3]],
    ],
    pools: [[16, -10, 3]],
  },
  clairiere: {
    id: 'clairiere', name: 'La Clairière de Grôlbak', biome: 'vallee', ...common, slotCount: 16,
    paths: [
      [[-14, -20], [-12, -10], [-16, -2], [-8, 3], [0, 0], [2, 7], [10, 9], [16, 5], [22, 9], [29, 8]],
      [[14, -20], [12, -11], [4, -8], [0, 0], [2, 7], [10, 9], [16, 5], [22, 9], [29, 8]],
    ],
    pools: [[-20, 10, 3]],
  },
  lisiere: {
    id: 'lisiere', name: 'La Lisière de Brumenoire', biome: 'marais', ...common, slotCount: 18,
    paths: [[[29, -12], [16, -12], [8, -8], [12, -2], [4, 3], [-6, 0], [-10, -7], [-18, -5], [-16, 4], [-10, 10], [0, 11], [8, 13], [12, 20]]],
    pools: [[-2, -9, 3.5], [20, 4, 4], [-21, 13, 2.5]],
  },
  antre: {
    id: 'antre', name: 'L’Antre de Mère Vasière', biome: 'marais', ...common, slotCount: 18,
    paths: [
      [[-29, -8], [-18, -9], [-10, -3], [-2, -2], [-4, 5], [2, 9], [10, 8], [16, 12], [18, 20]],
      [[0, -20], [2, -10], [-2, -2], [-4, 5], [2, 9], [10, 8], [16, 12], [18, 20]],
      [[29, -6], [18, -8], [13, -2], [14, 4], [10, 8], [16, 12], [18, 20]],
    ],
    pools: [[-16, 8, 4], [8, -12, 3]],
  },
  plaines: {
    id: 'plaines', name: 'Les Plaines de Cendre', biome: 'cendre', ...common, slotCount: 18,
    paths: [
      [[-29, -11], [-16, -12], [-8, -7], [-12, 0], [-4, 3], [4, -2], [10, -9], [18, -6], [20, 2], [29, 3]],
      [[-29, 12], [-18, 9], [-8, 12], [0, 9], [8, 10], [14, 6], [20, 2], [29, 3]],
    ],
    pools: [[0, -12, 2.8], [-20, 2, 2.6]],
  },
  remparts: {
    id: 'remparts', name: 'Les Remparts de la Citadelle', biome: 'cendre', ...common, slotCount: 18,
    paths: [
      [[-29, 8], [-18, 11], [-10, 6], [-14, -2], [-6, -6], [0, -2], [6, -6], [4, -14], [3, -20]],
      [[29, 9], [18, 12], [11, 6], [14, -2], [6, -6], [4, -14], [3, -20]],
    ],
    pools: [[0, 8, 3], [-20, -10, 3]],
  },
  trone: {
    id: 'trone', name: 'La Salle du Trône', biome: 'cendre', ...common, slotCount: 20,
    paths: [
      [[-29, -12], [-16, -11], [-12, -3], [-4, -6], [3, 0], [10, -3], [16, 3], [22, 6], [29, 5]],
      [[-29, 12], [-18, 11], [-10, 6], [-2, 8], [3, 0], [10, -3], [16, 3], [22, 6], [29, 5]],
      [[8, -20], [9, -11], [4, -5], [3, 0], [10, -3], [16, 3], [22, 6], [29, 5]],
    ],
    pools: [[-20, 0, 3], [16, -11, 2.6]],
  },
  // --- Survie ---
  carrefour: {
    id: 'carrefour', name: 'Le Carrefour des Vents', biome: 'vallee', ...common, slotCount: 20, pathFrom: [1, 6, 12],
    paths: [
      [[-29, 0], [-18, -2], [-10, 2], [-2, 0], [6, 1], [14, -3], [20, 0], [29, 0]],
      [[-6, -20], [-8, -10], [-2, -6], [6, 1], [14, -3], [20, 0], [29, 0]],
      [[-6, 20], [-10, 11], [-2, 7], [6, 1], [14, -3], [20, 0], [29, 0]],
    ],
    pools: [[-18, -11, 3], [16, 10, 3.5]],
  },
  brumes: {
    id: 'brumes', name: 'Les Brumes Éternelles', biome: 'marais', ...common, slotCount: 20, pathFrom: [1, 5, 11],
    paths: [
      [[29, -10], [16, -12], [8, -5], [0, -8], [-8, -3], [-14, 2], [-29, 1]],
      [[29, 10], [16, 12], [8, 6], [0, 8], [-8, 4], [-14, 2], [-29, 1]],
      [[12, -20], [11, -12], [8, -5], [0, -8], [-8, -3], [-14, 2], [-29, 1]],
    ],
    pools: [[18, 0, 3.5], [-6, -13, 2.6], [-18, 11, 3]],
  },
  fournaise: {
    id: 'fournaise', name: 'La Fournaise', biome: 'cendre', ...common, slotCount: 22, pathFrom: [1, 1, 8, 14],
    paths: [
      [[-29, -10], [-16, -8], [-8, -12], [0, -7], [8, -2], [16, 0], [29, 0]],
      [[-29, 10], [-16, 8], [-8, 12], [0, 7], [8, 2], [16, 0], [29, 0]],
      [[-4, -20], [-2, -12], [0, -7], [8, -2], [16, 0], [29, 0]],
      [[-4, 20], [-2, 12], [0, 7], [8, 2], [16, 0], [29, 0]],
    ],
    pools: [[-18, 0, 3.2], [16, -10, 2.6], [16, 10, 2.6]],
  },
};

export const SURVIVAL_MAPS = ['carrefour', 'brumes', 'fournaise'];
