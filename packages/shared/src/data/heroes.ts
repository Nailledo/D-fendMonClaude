import type { HeroId } from '../types';

export interface HeroSkillDef {
  name: string;
  /** libellé court affiché sous l'icône (10 caractères au plus) */
  short: string;
  /** clé de l'icône côté client */
  icon: string;
  desc: string;
  cd: number;
  unlock: number; // niveau du héros
  /** la compétence se lance au curseur (sinon centrée sur le héros) */
  targeted: boolean;
  /** portée maximale depuis le héros (un point visé plus loin est ramené à cette distance) */
  range?: number;
}

/**
 * Apparence du héros (« skin ») : ses pouvoirs viennent de sa classe (voir data/classes).
 * Personnages sans nom : en partie, le héros porte le pseudo de celui qui le joue.
 */
export interface HeroDef {
  id: HeroId;
  /** ce qu'il est (affiché à la place d'un nom) */
  title: string;
  desc: string;
  color: number;
}

/**
 * Couleurs de peau au choix, valables pour tous les personnages (simple apparence, visible des autres joueurs).
 * La première est celle des modèles ; les autres teintent les sommets de peau (marqués par `pnpm models:skins`).
 */
export interface SkinTone { name: string; color: number }
export const SKIN_TONES: SkinTone[] = [
  { name: 'Claire', color: 0xe3ac88 },
  { name: 'Dorée', color: 0xd8a274 },
  { name: 'Hâlée', color: 0xbb8458 },
  { name: 'Mate', color: 0x9c6542 },
  { name: 'Brune', color: 0x744830 },
  { name: 'Ébène', color: 0x553323 },
];
/** couleur de peau moyenne des modèles d'origine (mesurée par `pnpm models:skins`) */
export const SKIN_BASE = 0xe3ac88;
/** Index de couleur de peau valide (0 = celle du modèle). */
export const skinIndex = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < SKIN_TONES.length ? (v as number) : 0);

export const HEROES: Record<HeroId, HeroDef> = {
  samuel: {
    id: 'samuel', title: 'Chevalier au grand cœur', color: 0x3b82f6,
    desc: 'Brave, loyal et légèrement maladroit. Était parti chercher des petits fours quand la princesse a été enlevée.',
  },
  lyra: {
    id: 'lyra', title: 'Rôdeur de la forêt', color: 0x16a34a,
    desc: 'Connaît chaque arbre de la forêt par son prénom. Les arbres, eux, l’appellent « le bruyant ».',
  },
  brom: {
    id: 'brom', title: 'Nain forgeron', color: 0xb45309,
    desc: 'A forgé son marteau lui-même. Puis son enclume. Puis un deuxième marteau, par sécurité.',
  },
  nox: {
    id: 'nox', title: 'Érudit des ombres', color: 0x7c3aed,
    desc: 'A lu tous les grimoires de la bibliothèque, y compris ceux qu’il ne fallait pas.',
  },
  ombre: {
    id: 'ombre', title: 'Lame écarlate', color: 0xc0262e,
    desc: 'Personne n’a jamais vu son visage. Pas même sa mère, qui trouve ça un peu vexant.',
  },
  paladin: {
    id: 'paladin', title: 'Paladin de l’aube', color: 0xf2b33d,
    desc: 'Son armure brille tellement qu’on le repère depuis l’autre bout du royaume. Les gobelins aussi, hélas.',
  },
  druide: {
    id: 'druide', title: 'Druide des bois', color: 0x5fae3e,
    desc: 'Parle aux cerfs, dort dans les chênes et refuse catégoriquement de couper ses bois.',
  },
  ours: {
    id: 'ours', title: 'Barbare des glaces', color: 0x8fd3ff,
    desc: 'A gagné sa fourrure à mains nues contre un ours blanc. L’ours raconte une autre version.',
  },
  brasier: {
    id: 'brasier', title: 'Mage du brasier', color: 0xff5a14,
    desc: 'A été renvoyée de trois écoles de magie. Les trois ont brûlé. Pure coïncidence, d’après elle.',
  },
};

export const HERO_MAX_LEVEL = 10;
export const HERO_XP = [0, 80, 200, 380, 620, 920, 1300, 1760, 2300, 2950];
export const HERO_RESPAWN_S = 15;
/** ennemis qu'un héros retient en plus de sa cible (il prend aussi leurs coups) */
export const HERO_EXTRA_HOLD = 2;

export interface SpellDef {
  id: string;
  name: string;
  desc: string;
  /** recharge (secondes) */
  cd: number;
  /** rayon de la zone visée (anneau de visée) ; 0 = sort immédiat, sans cible */
  radius: number;
  /** niveau de l'histoire à terminer pour l'obtenir ; -1 = disponible dès le début */
  unlock: number;
}

/**
 * Catalogue des sorts généraux. L'index sert d'identifiant réseau : on n'insère jamais au milieu.
 * Deux sorts au choix par partie (voir `sanitizeSpells`) ; les deux premiers sont ceux par défaut.
 */
export const SPELLS: SpellDef[] = [
  { id: 'meteor', name: 'Pluie de météores', desc: 'Trois météores s’écrasent sur la zone.', cd: 70, radius: 2.6, unlock: -1 },
  { id: 'renfort', name: 'Renforts', desc: 'Deux miliciens viennent bloquer les ennemis pendant 20 s.', cd: 16, radius: 1, unlock: -1 },
  { id: 'sables', name: 'Sables mouvants', desc: 'Un sable avale la zone pendant 8 s : les ennemis au sol sont ralentis de 75 % et subissent des dégâts.', cd: 45, radius: 3, unlock: 0 },
  { id: 'poison', name: 'Nuage de poison', desc: 'Un nuage toxique couvre la zone 8 s : de forts dégâts magiques sur la durée.', cd: 40, radius: 2.8, unlock: 1 },
  { id: 'soin', name: 'Soin du château', desc: 'Rend 2 vies au château et soigne tous vos alliés.', cd: 110, radius: 0, unlock: 2 },
  { id: 'blizzard', name: 'Blizzard', desc: 'Une tempête de glace ralentit de 60 % et blesse tous les ennemis de la zone pendant 6 s.', cd: 55, radius: 3, unlock: 3 },
  { id: 'malediction', name: 'Malédiction', desc: 'Les ennemis de la zone ralentissent et subissent 35 % de dégâts en plus pendant 9 s.', cd: 50, radius: 3, unlock: 4 },
  { id: 'benediction', name: 'Bénédiction', desc: 'Les tours de la zone tirent 40 % plus vite et font 20 % de dégâts en plus pendant 12 s.', cd: 75, radius: 4.5, unlock: 4 },
  { id: 'foudre', name: 'Chaîne d’éclairs', desc: 'La foudre frappe l’ennemi visé puis rebondit sur cinq autres.', cd: 45, radius: 2.5, unlock: 5 },
  { id: 'flammes', name: 'Mur de flammes', desc: 'Un mur de flammes brûle la zone 8 s et ralentit les ennemis qui le traversent.', cd: 50, radius: 2.6, unlock: 6 },
  { id: 'seisme', name: 'Séisme', desc: 'Le sol tremble : dégâts et étourdissement des ennemis au sol dans la zone.', cd: 60, radius: 3.4, unlock: 7 },
];

/** Sorts emportés par défaut (et quand le choix reçu est invalide). */
export const DEFAULT_SPELLS: [number, number] = [0, 1];

/** Sorts obtenus : ceux sans condition, plus ceux dont le niveau de l'histoire a été terminé. `stars[niveau]` = étoiles par difficulté. */
export function spellsUnlocked(stars: readonly (readonly number[] | undefined)[]): boolean[] {
  return SPELLS.map((s) => s.unlock < 0 || (stars[s.unlock] ?? []).some((n) => (n ?? 0) > 0));
}

/** Deux sorts distincts du catalogue ; sinon le choix par défaut. */
export function sanitizeSpells(raw: unknown): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) return [...DEFAULT_SPELLS];
  const a = Number(raw[0]), b = Number(raw[1]);
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n < SPELLS.length;
  return ok(a) && ok(b) && a !== b ? [a, b] : [...DEFAULT_SPELLS];
}
