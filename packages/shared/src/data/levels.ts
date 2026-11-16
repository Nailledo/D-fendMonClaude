export interface RosterEntry {
  type: string;
  /** première vague (1-based) où ce type peut apparaître */
  from: number;
  w: number;
}

export interface LevelDef {
  index: number;
  mapId: string;
  name: string;
  waves: number;
  startGold: number;
  budget0: number;
  growth: number;
  /** progression des PV par vague (sans augmenter les primes) : c'est elle qui crée la pression */
  hpRamp: number;
  /** intensité du bonus de PV multijoueur sur ce niveau (1 = table BALANCE.hpByPlayers telle quelle) */
  multiK?: number;
  roster: RosterEntry[];
  boss?: { type: string; escortBudget: number };
}

// hpRamp calibré avec `pnpm tune` (bot « diversifié », Vétéran, solo → ~10 vies restantes)
export const LEVELS: LevelDef[] = [
  {
    index: 0, mapId: 'pont', name: 'Le Pont d’Aubeclair', waves: 10, startGold: 300, budget0: 9, growth: 1.24, hpRamp: 0.25, multiK: 1.58,
    roster: [{ type: 'gobelin', from: 1, w: 3 }, { type: 'loup', from: 3, w: 2 }, { type: 'brute', from: 6, w: 1 }],
  },
  {
    index: 1, mapId: 'moulins', name: 'Les Moulins du Val', waves: 12, startGold: 320, budget0: 12, growth: 1.22, hpRamp: 0.1, multiK: 1.93,
    roster: [{ type: 'gobelin', from: 1, w: 3 }, { type: 'loup', from: 1, w: 2 }, { type: 'corbeau', from: 3, w: 1.5 }, { type: 'chaman', from: 5, w: 1 }, { type: 'brute', from: 4, w: 1 }],
  },
  {
    index: 2, mapId: 'clairiere', name: 'La Clairière de Grôlbak', waves: 14, startGold: 360, budget0: 14, growth: 1.2, hpRamp: 0.11, multiK: 0.83,
    roster: [{ type: 'gobelin', from: 1, w: 2 }, { type: 'loup', from: 1, w: 2 }, { type: 'brute', from: 2, w: 1.5 }, { type: 'chaman', from: 3, w: 1 }, { type: 'corbeau', from: 2, w: 1.2 }, { type: 'bouclier', from: 5, w: 1.2 }],
    boss: { type: 'grolbak', escortBudget: 40 },
  },
  {
    index: 3, mapId: 'lisiere', name: 'La Lisière de Brumenoire', waves: 14, startGold: 400, budget0: 18, growth: 1.19, hpRamp: 0.2, multiK: 1.27,
    roster: [{ type: 'noye', from: 1, w: 3 }, { type: 'crapaud', from: 2, w: 2 }, { type: 'gobelin', from: 1, w: 1 }, { type: 'sorciere', from: 4, w: 1 }, { type: 'limon', from: 6, w: 1.2 }, { type: 'brute', from: 3, w: 0.8 }],
  },
  {
    index: 4, mapId: 'antre', name: 'L’Antre de Mère Vasière', waves: 15, startGold: 450, budget0: 22, growth: 1.18, hpRamp: 0, multiK: 1.88,
    roster: [{ type: 'noye', from: 1, w: 2 }, { type: 'crapaud', from: 1, w: 1.5 }, { type: 'ver', from: 2, w: 1.2 }, { type: 'sorciere', from: 3, w: 1 }, { type: 'limon', from: 3, w: 1.2 }, { type: 'chauvesouris', from: 5, w: 1 }],
    boss: { type: 'vasiere', escortBudget: 70 },
  },
  {
    index: 5, mapId: 'plaines', name: 'Les Plaines de Cendre', waves: 15, startGold: 700, budget0: 26, growth: 1.18, hpRamp: 0, multiK: 0.35,
    roster: [{ type: 'diablotin', from: 1, w: 3 }, { type: 'cornu', from: 2, w: 1.5 }, { type: 'gargouille', from: 4, w: 1.2 }, { type: 'invocateur', from: 6, w: 1 }, { type: 'golem', from: 8, w: 0.8 }],
  },
  {
    index: 6, mapId: 'remparts', name: 'Les Remparts de la Citadelle', waves: 16, startGold: 800, budget0: 22.6, growth: 1.17, hpRamp: 0, multiK: 0.48,
    roster: [{ type: 'diablotin', from: 1, w: 2 }, { type: 'cornu', from: 1, w: 1.5 }, { type: 'gargouille', from: 2, w: 1.2 }, { type: 'invocateur', from: 3, w: 1 }, { type: 'golem', from: 5, w: 1 }, { type: 'chevalierinf', from: 6, w: 1.2 }, { type: 'sorciere', from: 4, w: 0.6 }],
  },
  {
    index: 7, mapId: 'trone', name: 'La Salle du Trône', waves: 16, startGold: 950, budget0: 34, growth: 1.17, hpRamp: 0.06, multiK: 0.97,
    roster: [{ type: 'diablotin', from: 1, w: 2 }, { type: 'cornu', from: 1, w: 1.5 }, { type: 'gargouille', from: 1, w: 1.2 }, { type: 'invocateur', from: 2, w: 1 }, { type: 'golem', from: 3, w: 1 }, { type: 'chevalierinf', from: 3, w: 1.2 }, { type: 'brute', from: 1, w: 0.5 }, { type: 'limon', from: 4, w: 0.6 }],
    boss: { type: 'kessin1', escortBudget: 110 },
  },
];

export const SURVIVAL_START_GOLD = 450;
