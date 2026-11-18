import { TREE, TREE_RETIRED, TREE_VERSION, sanitizeMeta, treeCost } from './data/meta';
import { DEFAULT_SPELLS, sanitizeSpells, spellsUnlocked } from './data/heroes';
import { EMPTY_BUILD, buildCost, heroPoints, sanitizeBuild, type HeroBuild } from './data/classes';

/**
 * Progression du joueur (campagne, atelier). Conservée dans le navigateur et, quand le joueur est
 * connecté à son compte sayk.fr, recopiée sur le service de comptes pour le suivre d'un appareil à
 * l'autre. Ce module ne dépend de rien : il nettoie une progression reçue et en fusionne deux.
 */
export interface Progress {
  unlocked: number;
  stars: number[][]; // [niveau][difficulté]
  seenPrologue: boolean;
  seen: string[]; // ennemis rencontrés
  finished: boolean;
  /** arbre de compétences : rangs achetés par branche */
  tree: number[];
  /** version de l'ordre des branches de l'arbre (voir TREE_VERSION) */
  treeV: number;
  /** objets de boutique en réserve (stock par objet) */
  items: number[];
  /** étoiles dépensées en boutique (non remboursables) */
  shopSpent: number;
  /** étoiles gagnées en plus des records (survie, victoires sur un niveau déjà parfait) */
  bonusStars: number;
  /** arbre du héros (classe, nœuds, entraînement), payé en points de héros */
  hero: HeroBuild;
  /** les deux sorts généraux choisis (index de SPELLS) ; les sorts s'obtiennent en terminant des niveaux */
  spells: [number, number];
}

export function emptyProgress(): Progress {
  return { unlocked: 0, stars: [], seenPrologue: false, seen: [], finished: false, tree: [], treeV: TREE_VERSION, items: [], shopSpent: 0, bonusStars: 0, hero: sanitizeBuild(EMPTY_BUILD), spells: [...DEFAULT_SPELLS] };
}

const MAX_LEVELS = 64;
const MAX_SEEN = 200;
const int = (v: unknown, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};

/** Progression lue d'une source non sûre (compte, ancienne version) : types et bornes garantis. */
export function sanitizeProgress(raw: unknown): Progress {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const stars = Array.isArray(p.stars) ? p.stars.slice(0, MAX_LEVELS) : [];
  const seen = Array.isArray(p.seen) ? p.seen.filter((s): s is string => typeof s === 'string' && /^[\w-]{1,32}$/.test(s)) : [];
  const meta = sanitizeMeta(p.tree, p.items);
  migrateTree(meta.tree, int(p.treeV, TREE_VERSION) || 1);
  return {
    unlocked: int(p.unlocked, MAX_LEVELS),
    stars: stars.map((l) => (Array.isArray(l) ? l.slice(0, 3).map((s) => int(s, 3)) : [])),
    seenPrologue: p.seenPrologue === true,
    seen: [...new Set(seen)].slice(0, MAX_SEEN),
    finished: p.finished === true,
    tree: meta.tree,
    treeV: TREE_VERSION,
    items: meta.items,
    shopSpent: int(p.shopSpent, 1e6),
    bonusStars: int(p.bonusStars, 1e6),
    hero: sanitizeBuild(p.hero),
    spells: sanitizeSpells(p.spells),
  };
}

/** Remet à zéro (étoiles rendues) les branches remplacées depuis la version `from` de l'arbre. */
export function migrateTree(tree: number[], from: number): boolean {
  let changed = false;
  for (let v = from + 1; v <= TREE_VERSION; v++) for (const b of TREE_RETIRED[v] ?? []) if (tree[b]) { tree[b] = 0; changed = true; }
  return changed;
}

/** Étoiles gagnées : meilleur résultat de chaque niveau dans chaque difficulté + étoiles bonus. */
export function progressEarned(p: Progress): number {
  let n = p.bonusStars;
  for (const l of p.stars) for (const s of l ?? []) n += s ?? 0;
  return n;
}

/** Progression vierge (jamais jouée) : rien à fusionner, l'autre côté fait foi. */
export function isFreshProgress(p: Progress): boolean {
  return p.unlocked === 0 && progressEarned(p) === 0 && p.seen.length === 0 && !p.seenPrologue && p.shopSpent === 0;
}

/**
 * Réunit la progression de cet appareil et celle du compte.
 * Ce qui se gagne (niveaux, étoiles, ennemis vus) ne se perd jamais : on garde le meilleur des deux.
 * Ce qui se dépense (arbre, objets, étoiles de boutique) vient du côté modifié le plus récemment,
 * pour ne pas créer d'objets ou de rangs que personne n'a payés.
 */
export function mergeProgress(local: Progress, remote: Progress, localAt: number, remoteAt: number): Progress {
  const a = sanitizeProgress(local);
  const b = sanitizeProgress(remote);
  if (isFreshProgress(a)) return b;
  if (isFreshProgress(b)) return a;

  const levels = Math.max(a.stars.length, b.stars.length);
  const stars: number[][] = [];
  for (let l = 0; l < levels; l++) {
    const la = a.stars[l] ?? [];
    const lb = b.stars[l] ?? [];
    const n = Math.max(la.length, lb.length);
    stars.push(Array.from({ length: n }, (_, d) => Math.max(la[d] ?? 0, lb[d] ?? 0)));
  }
  const spend = localAt >= remoteAt ? a : b;
  const out: Progress = {
    unlocked: Math.max(a.unlocked, b.unlocked),
    stars,
    seenPrologue: a.seenPrologue || b.seenPrologue,
    seen: [...new Set([...a.seen, ...b.seen])].slice(0, MAX_SEEN),
    finished: a.finished || b.finished,
    tree: [...spend.tree],
    treeV: TREE_VERSION,
    items: [...spend.items],
    shopSpent: spend.shopSpent,
    bonusStars: Math.max(a.bonusStars, b.bonusStars),
    hero: sanitizeBuild(spend.hero),
    spells: [...spend.spells],
  };
  // garde-fou : jamais de solde négatif (l'arbre se rembourse, la boutique non)
  if (progressEarned(out) - out.shopSpent - treeCost(out.tree) < 0) out.tree = TREE.map(() => 0);
  if (buildCost(out.hero) > heroPoints(out.stars)) out.hero = sanitizeBuild(EMPTY_BUILD);
  out.spells = usableSpells(out.spells, out.stars);
  return out;
}

/** Comparaison stable de deux progressions (pour savoir s'il faut renvoyer quelque chose). */
export function sameProgress(a: Progress, b: Progress): boolean {
  return JSON.stringify(sanitizeProgress(a)) === JSON.stringify(sanitizeProgress(b));
}


/** Le choix de sorts, ramené aux sorts obtenus : un sort pas encore gagné est remplacé par un sort par défaut libre. */
export function usableSpells(spells: readonly number[], stars: readonly (readonly number[] | undefined)[]): [number, number] {
  const open = spellsUnlocked(stars);
  const [a, b] = sanitizeSpells(spells);
  if (open[a] && open[b]) return [a, b];
  const keep = open[a] ? a : open[b] ? b : -1;
  const pool = open.map((o, i) => (o ? i : -1)).filter((i) => i >= 0 && i !== keep);
  return keep >= 0 ? [keep, pool[0]] : [pool[0], pool[1]];
}
