import { CLASSES, CORE_COST, EMPTY_BUILD, coreOpen, ITEMS, ITEM_MAX, RANK_COST, classNodes, nodeOpen, TREE, TREE_RANKS, buildCost, heroPoints, sanitizeBuild, treeCost, type HeroBuild } from '@dfend/shared';
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
/** Un rang de plus sur le nœud `i` de la branche `cls` (le premier achat fixe la classe). */
export function canBuyNode(cls: number, i: number): boolean {
  const b = heroBuild();
  return nodeOpen(b, cls, i) && heroPointsLeft() >= classNodes(CLASSES[cls])[i].cost;
}
export function buyNode(cls: number, i: number): boolean {
  if (!canBuyNode(cls, i)) return false;
  const b = heroBuild();
  const r = b.cls === cls ? [...b.r] : [...EMPTY_BUILD.r];
  r[i]++;
  progress.hero = { cls, r, core: b.core };
  saveProgress();
  return true;
}
/** Un rang de plus sur le fondamental `k` (une fois la classe choisie). */
export function canBuyCore(k: number): boolean {
  return coreOpen(heroBuild(), k) && heroPointsLeft() >= CORE_COST;
}
export function buyCore(k: number): boolean {
  if (!canBuyCore(k)) return false;
  const b = heroBuild();
  const core = [...b.core];
  core[k]++;
  progress.hero = { ...b, core };
  saveProgress();
  return true;
}
/** Réinitialisation gratuite : tous les points sont rendus, la classe est libérée. */
export function resetHero() {
  progress.hero = sanitizeBuild(EMPTY_BUILD);
  saveProgress();
}

/** Étoiles bonus (survie, victoire sur un niveau déjà parfait). */
export function addBonusStars(n: number) {
  if (n <= 0) return;
  progress.bonusStars += n;
  saveProgress();
}
