import { DmgType, type Family } from '../types';

export type ProjKind = 'arrow' | 'bolt' | 'frost' | 'arcane' | 'shell' | 'fireshell' | 'tesla' | 'none';
export const PROJ_KINDS: ProjKind[] = ['arrow', 'bolt', 'frost', 'arcane', 'shell', 'fireshell', 'tesla', 'none'];

/** Types visuels de soldats. */
export const enum SoldierKind {
  Milicien = 0,
  Soldat = 1,
  Chevalier = 2,
  Garde = 3,
  Rodeur = 4,
  Renfort = 5,
  Squelette = 6,
  Tourelle = 7,
}

export interface SoldierDef {
  hp: number;
  dmg: [number, number];
  armor: number;
  cooldown: number;
  respawn: number;
  regen: number;
  kind: SoldierKind;
  count: number;
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  costs: [number, number, number];
  values: [number, number, number];
}

export interface TowerLevel {
  name: string;
  cost: number;
  range: number;
  cooldown: number;
  dmg: [number, number];
  dmgType: DmgType;
  proj: ProjKind;
  hitsAir: boolean;
  /** vitesse du projectile (unités/s) */
  projSpeed: number;
  splash?: number;
  burst?: number;
  slow?: [number, number];
  chain?: number;
  burn?: [number, number];
  soldiers?: SoldierDef;
  skills?: [SkillDef, SkillDef];
  desc: string;
  /** mine : or versé à son propriétaire au début de chaque vague */
  income?: number;
  /** campement : bonus donnés aux tours voisines (rayon = `range`) */
  aura?: { range: number; rate: number };
  /** révèle les ennemis camouflés dans sa portée */
  detect?: boolean;
}

export const LEVEL_SPEC_A = 3;
export const LEVEL_SPEC_B = 4;

const P = DmgType.Phys;
const M = DmgType.Magic;

/** Bâtiment sans tir (mine, campement). */
const building = (name: string, cost: number, range: number, desc: string, extra: Partial<TowerLevel>): TowerLevel => ({
  name, cost, range, cooldown: 0, dmg: [0, 0], dmgType: P, proj: 'none', hitsAir: false, projSpeed: 0, desc, ...extra,
});

export const TOWERS: Record<Family, TowerLevel[]> = {
  archer: [
    { name: 'Tour d’archers', cost: 70, range: 6.5, cooldown: 0.9, dmg: [4, 7], dmgType: P, proj: 'arrow', hitsAir: true, projSpeed: 18, desc: 'Tirs rapides, touche les volants.' },
    { name: 'Poste d’archers', cost: 95, range: 7, cooldown: 0.7, dmg: [7, 11], dmgType: P, proj: 'arrow', hitsAir: true, projSpeed: 19, desc: 'Des archers mieux payés, donc plus motivés.' },
    { name: 'Bastion d’archers', cost: 135, range: 7.5, cooldown: 0.6, dmg: [11, 16], dmgType: P, proj: 'arrow', hitsAir: true, projSpeed: 20, desc: 'Ils ne ratent jamais. Enfin, presque.' },
    {
      name: 'Tireurs d’élite', cost: 230, range: 9.5, cooldown: 1.5, dmg: [38, 58], dmgType: P, proj: 'arrow', hitsAir: true, projSpeed: 30,
      desc: 'Très longue portée, gros dégâts.',
      skills: [
        { id: 'mortel', name: 'Tir mortel', desc: 'Chance d’abattre instantanément un ennemi (hors boss).', costs: [200, 200, 200], values: [0.05, 0.09, 0.13] },
        { id: 'faucon', name: 'Œil de faucon', desc: 'Augmente la portée.', costs: [150, 150, 150], values: [0.9, 1.8, 2.7] },
      ],
    },
    {
      name: 'Arbalétriers à répétition', cost: 230, range: 7.5, cooldown: 1.0, dmg: [10, 15], dmgType: P, proj: 'arrow', hitsAir: true, projSpeed: 24, burst: 3,
      desc: 'Rafales de trois carreaux.',
      skills: [
        { id: 'poison', name: 'Carreaux empoisonnés', desc: 'Empoisonne la cible (dégâts par seconde, 4 s).', costs: [150, 150, 150], values: [5, 10, 15] },
        { id: 'rafale', name: 'Pluie de carreaux', desc: 'Toutes les 8 s, tire sur plusieurs ennemis.', costs: [200, 200, 200], values: [5, 8, 11] },
      ],
    },
  ],
  barracks: [
    { name: 'Caserne de milice', cost: 70, range: 4.5, cooldown: 0, dmg: [0, 0], dmgType: P, proj: 'none', hitsAir: false, projSpeed: 0, desc: 'Trois miliciens bloquent les ennemis au sol.', soldiers: { count: 3, hp: 55, dmg: [1, 3], armor: 0, cooldown: 1, respawn: 10, regen: 4, kind: SoldierKind.Milicien } },
    { name: 'Caserne de soldats', cost: 95, range: 4.5, cooldown: 0, dmg: [0, 0], dmgType: P, proj: 'none', hitsAir: false, projSpeed: 0, desc: 'Des soldats entraînés et un peu d’armure.', soldiers: { count: 3, hp: 100, dmg: [3, 6], armor: 0.15, cooldown: 1, respawn: 10, regen: 7, kind: SoldierKind.Soldat } },
    { name: 'Caserne de chevaliers', cost: 130, range: 4.5, cooldown: 0, dmg: [0, 0], dmgType: P, proj: 'none', hitsAir: false, projSpeed: 0, desc: 'Des chevaliers en armure complète.', soldiers: { count: 3, hp: 150, dmg: [6, 10], armor: 0.3, cooldown: 1, respawn: 10, regen: 10, kind: SoldierKind.Chevalier } },
    {
      name: 'Gardes royaux', cost: 230, range: 5, cooldown: 0, dmg: [0, 0], dmgType: P, proj: 'none', hitsAir: false, projSpeed: 0,
      desc: 'Des murs de métal sur pattes.',
      soldiers: { count: 3, hp: 280, dmg: [8, 14], armor: 0.5, cooldown: 1, respawn: 12, regen: 16, kind: SoldierKind.Garde },
      skills: [
        { id: 'bouclier', name: 'Bouclier sacré', desc: 'Armure et régénération accrues.', costs: [150, 150, 150], values: [0.1, 0.2, 0.3] },
        { id: 'provoc', name: 'Provocation', desc: 'Chaque garde peut retenir plus d’ennemis.', costs: [200, 200, 200], values: [1, 2, 3] },
      ],
    },
    {
      name: 'Rôdeurs', cost: 230, range: 5, cooldown: 0, dmg: [0, 0], dmgType: P, proj: 'none', hitsAir: false, projSpeed: 0,
      desc: 'Des combattants agiles et redoutables.',
      soldiers: { count: 3, hp: 170, dmg: [18, 28], armor: 0.2, cooldown: 0.9, respawn: 10, regen: 10, kind: SoldierKind.Rodeur },
      skills: [
        { id: 'bond', name: 'Bond', desc: 'Un rôdeur bondit sur l’ennemi le plus robuste et le frappe.', costs: [200, 200, 200], values: [70, 120, 170] },
        { id: 'lames', name: 'Lames jumelles', desc: 'Chance de frapper deux fois.', costs: [150, 150, 150], values: [0.15, 0.3, 0.45] },
      ],
    },
  ],
  mage: [
    { name: 'Tour de mage', cost: 100, range: 6, cooldown: 1.5, dmg: [9, 17], dmgType: M, proj: 'bolt', hitsAir: true, projSpeed: 14, desc: 'Dégâts magiques qui ignorent l’armure.' },
    { name: 'Tour d’adepte', cost: 135, range: 6.5, cooldown: 1.5, dmg: [18, 32], dmgType: M, proj: 'bolt', hitsAir: true, projSpeed: 15, desc: 'Plus de magie, plus de fumée violette.' },
    { name: 'Tour d’enchanteur', cost: 205, range: 7, cooldown: 1.5, dmg: [30, 52], dmgType: M, proj: 'bolt', hitsAir: true, projSpeed: 16, desc: 'Un enchanteur qui a lu tous les grimoires.' },
    {
      name: 'Arcaniste', cost: 300, range: 7.5, cooldown: 2, dmg: [75, 125], dmgType: M, proj: 'arcane', hitsAir: true, projSpeed: 40,
      desc: 'Rayon arcanique dévastateur.',
      skills: [
        { id: 'desint', name: 'Désintégration', desc: 'Désintègre un ennemi (hors boss) à intervalle régulier.', costs: [250, 200, 200], values: [20, 16, 12] },
        { id: 'teleport', name: 'Téléportation', desc: 'Renvoie des ennemis en arrière sur le chemin.', costs: [175, 175, 175], values: [2, 3, 4] },
      ],
    },
    {
      name: 'Sorcier du givre', cost: 300, range: 7, cooldown: 1.4, dmg: [36, 56], dmgType: M, proj: 'frost', hitsAir: true, projSpeed: 16, slow: [0.45, 2],
      desc: 'Ralentit tout ce qu’il touche.',
      skills: [
        { id: 'blizzard', name: 'Blizzard', desc: 'Gèle une zone d’ennemis.', costs: [200, 200, 200], values: [1.5, 2, 2.5] },
        { id: 'percant', name: 'Givre perçant', desc: 'Réduit l’armure des cibles.', costs: [150, 150, 150], values: [0.15, 0.25, 0.35] },
      ],
    },
  ],
  artillery: [
    { name: 'Artillerie naine', cost: 105, range: 6, cooldown: 2.6, dmg: [8, 16], dmgType: P, proj: 'shell', hitsAir: false, projSpeed: 9, splash: 1.8, desc: 'Dégâts de zone, uniquement au sol.' },
    { name: 'Artillerie lourde', cost: 185, range: 6.5, cooldown: 2.6, dmg: [18, 34], dmgType: P, proj: 'shell', hitsAir: false, projSpeed: 9.5, splash: 1.9, desc: 'Plus gros, plus bruyant.' },
    { name: 'Grand obusier', cost: 270, range: 7, cooldown: 2.6, dmg: [30, 52], dmgType: P, proj: 'shell', hitsAir: false, projSpeed: 10, splash: 2.0, desc: 'Le sol tremble à chaque tir.' },
    {
      name: 'Mortier à flammes', cost: 350, range: 7.5, cooldown: 3, dmg: [48, 78], dmgType: P, proj: 'fireshell', hitsAir: false, projSpeed: 10, splash: 2.3, burn: [10, 3],
      desc: 'Laisse un sol en feu.',
      skills: [
        { id: 'napalm', name: 'Napalm', desc: 'Le feu au sol brûle beaucoup plus fort.', costs: [175, 175, 175], values: [10, 18, 26] },
        { id: 'frag', name: 'Bombe à fragmentation', desc: 'Toutes les 10 s, une pluie de bombinettes.', costs: [225, 200, 200], values: [3, 5, 7] },
      ],
    },
    {
      name: 'Canon tesla', cost: 350, range: 6.5, cooldown: 2.2, dmg: [36, 64], dmgType: M, proj: 'tesla', hitsAir: true, projSpeed: 0, chain: 2,
      desc: 'Éclairs en chaîne, touche aussi les volants.',
      skills: [
        { id: 'surcharge', name: 'Surcharge', desc: 'Les éclairs rebondissent sur plus de cibles.', costs: [200, 200, 200], values: [1, 2, 3] },
        { id: 'statique', name: 'Champ statique', desc: 'Électrocute en continu les ennemis proches.', costs: [175, 175, 175], values: [6, 11, 16] },
      ],
    },
  ],
  mine: [
    building('Mine de cuivre', 110, 0, 'Rapporte de l’or au début de chaque vague. Ne se défend pas.', { income: 20 }),
    building('Mine de fer', 120, 0, 'Des galeries plus profondes, des mineurs plus nombreux.', { income: 38 }),
    building('Mine d’argent', 160, 0, 'Le filon brille. Les mineurs aussi.', { income: 60 }),
    building('Mine d’or', 250, 0, 'Une fortune à chaque vague.', {
      income: 100,
      skills: [
        { id: 'filon', name: 'Filon profond', desc: 'Or supplémentaire à chaque vague.', costs: [150, 150, 150], values: [20, 40, 60] },
        { id: 'coffre', name: 'Coffre-fort', desc: 'À chaque vague, intérêts sur votre or (80 au plus).', costs: [150, 150, 150], values: [0.03, 0.05, 0.07] },
      ],
    }),
    building('Ferme royale', 250, 0, 'Nourrit le royaume : de l’or, et de quoi réparer les murs.', {
      income: 75,
      skills: [
        { id: 'grenier', name: 'Grenier', desc: 'Rend une vie au château toutes les 3, 2 puis 1 vague(s).', costs: [175, 175, 175], values: [3, 2, 1] },
        { id: 'marche', name: 'Jour de marché', desc: 'Chaque allié touche aussi de l’or à chaque vague.', costs: [125, 125, 125], values: [15, 30, 45] },
      ],
    }),
  ],
  camp: [
    building('Campement', 90, 4.5, 'Les tours voisines tirent plus loin et plus vite.', { aura: { range: 0.06, rate: 0.1 } }),
    building('Camp fortifié', 110, 4.8, 'Des tentes plus solides, des encouragements plus forts.', { aura: { range: 0.08, rate: 0.14 } }),
    building('Camp militaire', 150, 5, 'Intendance, forge et cantine : tout le monde tire mieux.', { aura: { range: 0.1, rate: 0.18 } }),
    building('Tour de guet', 220, 6, 'Repère les ennemis camouflés autour d’elle et guide les tirs.', {
      aura: { range: 0.12, rate: 0.18 }, detect: true,
      skills: [
        { id: 'marque', name: 'Marquage', desc: 'Les ennemis dans sa zone subissent plus de dégâts.', costs: [150, 150, 150], values: [0.08, 0.15, 0.22] },
        { id: 'longuevue', name: 'Longue-vue', desc: 'Portée des tours voisines encore augmentée.', costs: [125, 125, 125], values: [0.05, 0.1, 0.15] },
      ],
    }),
    building('Tente de commandement', 220, 5.5, 'Un général qui crie très fort : cadence de tir très accrue.', {
      aura: { range: 0.1, rate: 0.28 },
      skills: [
        { id: 'tambours', name: 'Tambours de guerre', desc: 'Cadence des tours voisines encore augmentée.', costs: [150, 150, 150], values: [0.08, 0.16, 0.24] },
        { id: 'banniere', name: 'Bannière royale', desc: 'Dégâts des tours et des soldats voisins augmentés.', costs: [175, 175, 175], values: [0.1, 0.18, 0.26] },
      ],
    }),
  ],
};

/** Bonus d'un campement (niveau, rangs de compétences) : portée, cadence et dégâts des tours voisines. */
export function campAura(level: number, sk: readonly [number, number] | readonly number[]): { r: number; range: number; rate: number; dmg: number; mark: number } {
  const l = TOWERS.camp[level];
  const a = l.aura ?? { range: 0, rate: 0 };
  const out = { r: l.range, range: a.range, rate: a.rate, dmg: 0, mark: 0 };
  if (l.skills) {
    const v = (i: number) => (sk[i] > 0 ? l.skills![i].values[sk[i] - 1] : 0);
    if (level === 3) { out.mark = v(0); out.range += v(1); }
    else { out.rate += v(0); out.dmg = v(1); }
  }
  return out;
}

/** Or versé par une mine au début d'une vague (hors intérêts, grenier et marché). */
export function mineIncome(level: number, sk: readonly [number, number] | readonly number[]): number {
  const l = TOWERS.mine[level];
  let g = l.income ?? 0;
  if (level === 3 && sk[0] > 0) g += l.skills![0].values[sk[0] - 1];
  return g;
}

/** Coût total investi pour atteindre un niveau donné (sans compétences). */
export function investedCost(fam: Family, level: number): number {
  const t = TOWERS[fam];
  let c = 0;
  for (let i = 0; i <= Math.min(level, 2); i++) c += t[i].cost;
  if (level >= 3) c += t[level].cost;
  return c;
}

export function upgradeCost(fam: Family, level: number, spec?: 1 | 2): number | null {
  if (level < 2) return TOWERS[fam][level + 1].cost;
  if (level === 2 && spec) return TOWERS[fam][2 + spec].cost;
  return null;
}
