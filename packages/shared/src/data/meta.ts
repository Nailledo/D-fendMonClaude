/**
 * Progression entre les parties, payée en étoiles :
 * - l'arbre de compétences : six branches de cinq rangs (tours, mines et campements, royaume), achetés
 *   dans l'ordre ; bonus permanents, remboursables à tout moment (réinitialisation) ;
 * - la boutique : objets à usage unique emportés dans les parties (or, vies, givre, bombe).
 *
 * La simulation ne lit que les rangs de l'arbre et le stock d'objets de chaque joueur (dans GameConfig) :
 * tout se rejoue à l'identique, et les valeurs reçues d'un client sont bornées par `sanitizeMeta`.
 */

/** Bonus cumulés d'un joueur (fractions : 0.1 = +10 %). Par famille de tour : archer, caserne, mage, artillerie, (mine, campement). */
export interface Perks {
  dmg: number[];
  range: number[];
  /** cadence de tir : le temps de recharge est divisé par (1 + rate) */
  rate: number[];
  splash: number;
  soldierHp: number;
  soldierDmg: number;
  /** armure ajoutée (valeur absolue, comme l'armure des soldats) */
  soldierArmor: number;
  /** réduction du temps de réapparition des soldats */
  soldierRespawn: number;
  /** or des mines en plus (fraction) */
  mineGold: number;
  /** bonus des campements (portée, cadence, dégâts des voisines) en plus (fraction) */
  campAura: number;
  /** rayon des campements en plus (fraction) */
  campRange: number;
  /** réduction des temps de recharge des sorts */
  spellCd: number;
  renfortHp: number;
  /** rang des renforts : 0 miliciens, 1 chevaliers, 2 paladins (voir RENFORT_TIERS) */
  renfortTier: number;
  /** renforts en plus à chaque sort, secondes de présence en plus */
  renfortCount: number;
  renfortDur: number;
  /** dégâts des sorts en plus (fraction) */
  spellDmg: number;
  /** rayon et durée des zones des sorts en plus (fraction) */
  spellArea: number;
  /** or de départ en plus */
  gold: number;
  /** vies en plus (hors mode à vie unique) */
  lives: number;
}

export function emptyPerks(): Perks {
  return {
    // une valeur par famille de tour (mine et campement compris, toujours nulles)
    dmg: [0, 0, 0, 0, 0, 0], range: [0, 0, 0, 0, 0, 0], rate: [0, 0, 0, 0, 0, 0], splash: 0,
    soldierHp: 0, soldierDmg: 0, soldierArmor: 0, soldierRespawn: 0,
    mineGold: 0, campAura: 0, campRange: 0,
    spellCd: 0, renfortHp: 0, renfortTier: 0, renfortCount: 0, renfortDur: 0, spellDmg: 0, spellArea: 0, gold: 0, lives: 0,
  };
}

type Fx = (p: Perks) => void;

export interface TreeRank {
  name: string;
  desc: string;
  fx: Fx;
}

export interface TreeBranch {
  id: string;
  name: string;
  /** couleur de la branche (interface) */
  color: string;
  /** clé d'icône côté client */
  icon: string;
  ranks: TreeRank[];
}

/** Coût en étoiles de chaque rang (identique pour toutes les branches). */
export const RANK_COST = [1, 1, 2, 2, 3];

const tower = (f: number, name: string, desc: string, dmg = 0, range = 0, rate = 0): TreeRank => ({
  name, desc, fx: (p) => { p.dmg[f] += dmg; p.range[f] += range; p.rate[f] += rate; },
});

export const TREE: TreeBranch[] = [
  {
    id: 'archer', name: 'Archers', color: '#4caf50', icon: 'fam0',
    ranks: [
      tower(0, 'Flèches affûtées', 'Dégâts des tours d’archers +10 %.', 0.1),
      tower(0, 'Œil de faucon', 'Portée des tours d’archers +8 %.', 0, 0.08),
      tower(0, 'Cordes tendues', 'Cadence des tours d’archers +10 %.', 0, 0, 0.1),
      tower(0, 'Pointes d’acier', 'Dégâts des tours d’archers +15 %.', 0.15),
      tower(0, 'Maîtres archers', 'Portée +8 % et cadence +10 %.', 0, 0.08, 0.1),
    ],
  },
  {
    id: 'barracks', name: 'Casernes', color: '#8d6e63', icon: 'fam1',
    ranks: [
      { name: 'Entraînement', desc: 'Points de vie des soldats +15 %.', fx: (p) => { p.soldierHp += 0.15; } },
      { name: 'Armures cloutées', desc: 'Armure des soldats +8.', fx: (p) => { p.soldierArmor += 0.08; } },
      { name: 'Relève rapide', desc: 'Les soldats tombés reviennent 25 % plus vite.', fx: (p) => { p.soldierRespawn += 0.25; } },
      { name: 'Lames forgées', desc: 'Dégâts des soldats +20 %.', fx: (p) => { p.soldierDmg += 0.2; } },
      { name: 'Vétérans', desc: 'Points de vie +20 % et dégâts +15 %.', fx: (p) => { p.soldierHp += 0.2; p.soldierDmg += 0.15; } },
    ],
  },
  {
    id: 'mage', name: 'Mages', color: '#7c4dff', icon: 'fam2',
    ranks: [
      tower(2, 'Grimoire usé', 'Dégâts des tours de mages +10 %.', 0.1),
      tower(2, 'Focalisation', 'Portée des tours de mages +8 %.', 0, 0.08),
      tower(2, 'Incantation rapide', 'Cadence des tours de mages +10 %.', 0, 0, 0.1),
      tower(2, 'Arcanes profondes', 'Dégâts des tours de mages +15 %.', 0.15),
      tower(2, 'Archimages', 'Dégâts +10 % et portée +8 %.', 0.1, 0.08),
    ],
  },
  {
    id: 'artillery', name: 'Artillerie', color: '#ef6c00', icon: 'fam3',
    ranks: [
      tower(3, 'Poudre fine', 'Dégâts de l’artillerie +10 %.', 0.1),
      { name: 'Grosses charges', desc: 'Rayon des explosions +12 %.', fx: (p) => { p.splash += 0.12; } },
      tower(3, 'Hausse réglée', 'Portée de l’artillerie +8 %.', 0, 0.08),
      tower(3, 'Servants aguerris', 'Cadence de l’artillerie +10 %.', 0, 0, 0.1),
      { name: 'Boulets de forge', desc: 'Dégâts +15 % et rayon des explosions +12 %.', fx: (p) => { p.dmg[3] += 0.15; p.splash += 0.12; } },
    ],
  },
  {
    id: 'works', name: 'Intendance', color: '#26a69a', icon: 'fam4',
    ranks: [
      { name: 'Filons riches', desc: 'Les mines rapportent 15 % d’or en plus.', fx: (p) => { p.mineGold += 0.15; } },
      { name: 'Piquets solides', desc: 'Rayon des campements +12 %.', fx: (p) => { p.campRange += 0.12; } },
      { name: 'Prospecteurs', desc: 'Les mines rapportent 20 % d’or en plus.', fx: (p) => { p.mineGold += 0.2; } },
      { name: 'Intendants', desc: 'Bonus des campements (portée, cadence, dégâts des tours voisines) +20 %.', fx: (p) => { p.campAura += 0.2; } },
      { name: 'Grands travaux', desc: 'Mines +15 % d’or ; campements +15 % de bonus et de rayon.', fx: (p) => { p.mineGold += 0.15; p.campAura += 0.15; p.campRange += 0.15; } },
    ],
  },
  {
    id: 'kingdom', name: 'Royaume', color: '#f9a825', icon: 'crown',
    ranks: [
      { name: 'Trésor royal', desc: '+40 or au début de chaque partie.', fx: (p) => { p.gold += 40; } },
      { name: 'Grimoire royal', desc: 'Sorts rechargés 12 % plus vite.', fx: (p) => { p.spellCd += 0.12; } },
      { name: 'Ciel ardent', desc: 'Dégâts de tous vos sorts +20 % et renforts +30 % de points de vie.', fx: (p) => { p.spellDmg += 0.2; p.renfortHp += 0.3; } },
      { name: 'Remparts', desc: '+2 vies au début de chaque partie (sauf Cauchemar).', fx: (p) => { p.lives += 2; } },
      { name: 'Âge d’or', desc: '+60 or au départ et sorts rechargés 12 % plus vite.', fx: (p) => { p.gold += 60; p.spellCd += 0.12; } },
    ],
  },
  {
    id: 'renforts', name: 'Renforts & sorts', color: '#5c6bc0', icon: 'army',
    ranks: [
      { name: 'Chevaliers', desc: 'Vos renforts deviennent des chevaliers : près de deux fois plus de PV, de meilleures armes et une armure.', fx: (p) => { p.renfortTier = Math.max(p.renfortTier, 1); } },
      { name: 'Magie de guerre', desc: 'Dégâts de tous vos sorts +15 % (météores, zones, foudre, séisme…).', fx: (p) => { p.spellDmg += 0.15; } },
      { name: 'Troisième lame', desc: 'Un renfort de plus à chaque appel, et ils restent 5 s de plus.', fx: (p) => { p.renfortCount += 1; p.renfortDur += 5; } },
      { name: 'Grimoire étendu', desc: 'Tous vos sorts de zone (météores compris) : rayon et durée +15 %.', fx: (p) => { p.spellArea += 0.15; } },
      { name: 'Paladins', desc: 'Vos renforts deviennent des paladins : très résistants, ils frappent fort et se soignent. Dégâts des sorts +10 %.', fx: (p) => { p.renfortTier = Math.max(p.renfortTier, 2); p.spellDmg += 0.1; } },
    ],
  },
];

/** Renforts appelés par le sort, selon le rang de la branche Renforts & sorts. `kind` : apparence (SoldierKind). */
export interface RenfortTier { name: string; unit: string; hp: number; dmg: [number, number]; armor: number; regen: number; kind: number }
export const RENFORT_TIERS: RenfortTier[] = [
  { name: 'Miliciens', unit: 'milicien', hp: 90, dmg: [3, 6], armor: 0.1, regen: 0, kind: 5 },
  { name: 'Chevaliers', unit: 'chevalier', hp: 170, dmg: [7, 11], armor: 0.35, regen: 0, kind: 2 },
  { name: 'Paladins', unit: 'paladin', hp: 280, dmg: [12, 18], armor: 0.5, regen: 6, kind: 3 },
];
export const RENFORT_COUNT = 2;
export const RENFORT_DUR_S = 20;

export const TREE_RANKS = 5;
/**
 * Version de l'ordre des branches. 2 : la branche Héros (indice 4) devient Intendance ;
 * les rangs d'une progression plus ancienne y sont remis à zéro (étoiles rendues).
 */
export const TREE_VERSION = 2;
export const TREE_RETIRED: Record<number, number[]> = { 2: [4] };

/** Étoiles investies dans un arbre (rangs par branche). */
export function treeCost(tree: readonly number[]): number {
  let n = 0;
  for (const r of tree) for (let k = 0; k < Math.min(r, TREE_RANKS); k++) n += RANK_COST[k];
  return n;
}

export function perksOf(tree: readonly number[] | undefined): Perks {
  const p = emptyPerks();
  if (!tree) return p;
  TREE.forEach((b, i) => {
    const r = Math.min(TREE_RANKS, tree[i] ?? 0);
    for (let k = 0; k < r; k++) b.ranks[k].fx(p);
  });
  return p;
}

// ---------------------------------------------------------------- boutique

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  /** prix en étoiles */
  price: number;
  /** se lance sur la carte (sinon effet immédiat) */
  targeted: boolean;
  /** rayon de la zone (objets ciblés) */
  radius: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'bourse', name: 'Bourse d’or', desc: '+150 or pour vous, tout de suite.', price: 2, targeted: false, radius: 0 },
  { id: 'potion', name: 'Potion de vie', desc: 'Rend 3 vies au château (sans dépasser le maximum).', price: 2, targeted: false, radius: 0 },
  { id: 'givre', name: 'Fiole de givre', desc: 'Gèle sur place les ennemis de la zone pendant 4 s.', price: 3, targeted: true, radius: 3 },
  { id: 'bombe', name: 'Bombe du nain', desc: 'Grosse explosion : 300 dégâts aux ennemis de la zone (volants compris).', price: 3, targeted: true, radius: 2.4 },
];

export const enum Item { Bourse = 0, Potion = 1, Givre = 2, Bombe = 3 }

/** Stock maximal d'un objet. */
export const ITEM_MAX = 9;
/** Délai entre deux objets d'un même joueur (secondes). */
export const ITEM_COOLDOWN_S = 1;

/** Rangs et stock reçus d'un client : entiers bornés, bonnes longueurs. */
export function sanitizeMeta(tree: unknown, items: unknown): { tree: number[]; items: number[] } {
  const int = (v: unknown, max: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };
  const t = Array.isArray(tree) ? tree : [];
  const it = Array.isArray(items) ? items : [];
  return { tree: TREE.map((_, i) => int(t[i], TREE_RANKS)), items: ITEMS.map((_, i) => int(it[i], ITEM_MAX)) };
}

// ---------------------------------------------------------------- étoiles gagnées

/** Étoiles de victoire en survie : une par tranche de 5 vagues tenues. */
export function survivalStars(waves: number): number {
  return Math.max(0, Math.floor(waves / 5));
}
