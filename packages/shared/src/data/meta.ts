/**
 * Progression entre les parties, payée en étoiles :
 * - l'arbre de compétences : six branches de cinq rangs, achetés dans l'ordre ; bonus permanents,
 *   remboursables à tout moment (réinitialisation) ;
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
  heroHp: number;
  heroDmg: number;
  heroRespawn: number;
  heroXp: number;
  /** réduction des temps de recharge des compétences du héros */
  heroCd: number;
  /** réduction des temps de recharge des sorts */
  spellCd: number;
  meteorDmg: number;
  renfortHp: number;
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
    heroHp: 0, heroDmg: 0, heroRespawn: 0, heroXp: 0, heroCd: 0,
    spellCd: 0, meteorDmg: 0, renfortHp: 0, gold: 0, lives: 0,
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
    id: 'hero', name: 'Héros', color: '#1e88e5', icon: 'hero',
    ranks: [
      { name: 'Endurance', desc: 'Points de vie du héros +12 %.', fx: (p) => { p.heroHp += 0.12; } },
      { name: 'Bras armé', desc: 'Dégâts du héros +12 %.', fx: (p) => { p.heroDmg += 0.12; } },
      { name: 'Retour héroïque', desc: 'Le héros réapparaît 30 % plus vite.', fx: (p) => { p.heroRespawn += 0.3; } },
      { name: 'Expérience', desc: 'Le héros gagne 25 % d’expérience en plus.', fx: (p) => { p.heroXp += 0.25; } },
      { name: 'Légende', desc: 'Compétences du héros rechargées 15 % plus vite.', fx: (p) => { p.heroCd += 0.15; } },
    ],
  },
  {
    id: 'kingdom', name: 'Royaume', color: '#f9a825', icon: 'crown',
    ranks: [
      { name: 'Trésor royal', desc: '+40 or au début de chaque partie.', fx: (p) => { p.gold += 40; } },
      { name: 'Grimoire royal', desc: 'Sorts rechargés 12 % plus vite.', fx: (p) => { p.spellCd += 0.12; } },
      { name: 'Ciel ardent', desc: 'Météores +25 % de dégâts, renforts +30 % de points de vie.', fx: (p) => { p.meteorDmg += 0.25; p.renfortHp += 0.3; } },
      { name: 'Remparts', desc: '+2 vies au début de chaque partie (sauf Cauchemar).', fx: (p) => { p.lives += 2; } },
      { name: 'Âge d’or', desc: '+60 or au départ et sorts rechargés 12 % plus vite.', fx: (p) => { p.gold += 60; p.spellCd += 0.12; } },
    ],
  },
];

export const TREE_RANKS = 5;

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
