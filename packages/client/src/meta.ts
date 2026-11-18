import { COMMON_COST, COMMON_RANKS, ITEMS, ITEM_MAX, NODE_COST, RANK_COST, TREE, TREE_RANKS, buildCost, heroPoints, sanitizeBuild, treeCost, type HeroBuild } from '@dfend/shared';
import { progress, saveProgress } from './state.svelte';

/**
 * Portefeuille d'étoiles et achats de l'atelier (arbre de compétences, boutique).
 * Étoiles gagnées = meilleur résultat de chaque niveau dans chaque difficulté + étoiles bonus
 * (survie, victoires sur un niveau déjà parfait). L'arbre se rembourse ; la boutique non.
 */

export function earnedStars(): number {
  let n = progress.bonusStars;
  for (const l of progress.stars) for (const s of l ?? []) n += s ?? 0;
  return n;
}

export function rank(b: number): number {
  return progress.tree[b] ?? 0;
}

export function availableStars(): number {
  return earnedStars() - treeCost(progress.tree) - progress.shopSpent;
}

export function stock(i: number): number {
  return progress.items[i] ?? 0;
}

/** Prochain rang d'une branche : achetable ? */
export function canBuyRank(b: number): boolean {
  const r = rank(b);
  return r < TREE_RANKS && availableStars() >= RANK_COST[r];
}

export function buyRank(b: number): boolean {
  if (!canBuyRank(b)) return false;
  for (let i = progress.tree.length; i < TREE.length; i++) progress.tree[i] = 0;
  progress.tree[b] = rank(b) + 1;
  saveProgress();
  return true;
}

/** Rend toutes les étoiles de l'arbre. */
export function resetTree() {
  progress.tree = TREE.map(() => 0);
  saveProgress();
}

export function canBuyItem(i: number): boolean {
  return stock(i) < ITEM_MAX && availableStars() >= ITEMS[i].price;
}

export function buyItem(i: number): boolean {
  if (!canBuyItem(i)) return false;
  for (let k = progress.items.length; k < ITEMS.length; k++) progress.items[k] = 0;
  progress.items[i] = stock(i) + 1;
  progress.shopSpent += ITEMS[i].price;
  saveProgress();
  return true;
}

/** Objet utilisé en partie (confirmé par la simulation). */
export function consumeItem(i: number) {
  if (stock(i) <= 0) return;
  progress.items[i] = stock(i) - 1;
  saveProgress();
}

/** Ce que le joueur emporte dans une partie. */
export function loadout(): { tree: number[]; items: number[]; build: HeroBuild } {
  return { tree: TREE.map((_, b) => rank(b)), items: ITEMS.map((_, i) => stock(i)), build: heroBuild() };
}

// ------------------------------------------------------------ arbre du héros

export function heroBuild(): HeroBuild {
  return sanitizeBuild(progress.hero);
}
export function heroPointsTotal(): number {
  return heroPoints(progress.stars);
}
export function heroPointsLeft(): number {
  return heroPointsTotal() - buildCost(heroBuild());
}
/** Achète le prochain nœud de la chaîne de la classe `cls` (vocation si aucune classe). */
export function canBuyNode(cls: number): boolean {
  const b = heroBuild();
  if (b.cls !== cls && b.nodes > 0) return false;
  const n = b.cls === cls ? b.nodes : 0;
  return n < NODE_COST.length && heroPointsLeft() >= NODE_COST[n];
}
export function buyNode(cls: number): boolean {
  if (!canBuyNode(cls)) return false;
  const b = heroBuild();
  progress.hero = { cls, nodes: (b.cls === cls ? b.nodes : 0) + 1, common: b.common };
  saveProgress();
  return true;
}
export function canBuyCommon(): boolean {
  return heroBuild().common < COMMON_RANKS && heroPointsLeft() >= COMMON_COST;
}
export function buyCommon(): boolean {
  if (!canBuyCommon()) return false;
  const b = heroBuild();
  progress.hero = { ...b, common: b.common + 1 };
  saveProgress();
  return true;
}
/** Réinitialisation gratuite : tous les points sont rendus. */
export function resetHero() {
  progress.hero = { cls: 0, nodes: 0, common: 0 };
  saveProgress();
}

/** Étoiles bonus (survie, victoire sur un niveau déjà parfait). */
export function addBonusStars(n: number) {
  if (n <= 0) return;
  progress.bonusStars += n;
  saveProgress();
}
