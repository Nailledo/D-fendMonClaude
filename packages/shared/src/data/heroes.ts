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

export const SPELLS = [
  { id: 'meteor', name: 'Pluie de météores', desc: 'Trois météores s’écrasent sur la zone.', cd: 70 },
  { id: 'renfort', name: 'Renforts', desc: 'Deux miliciens viennent bloquer les ennemis pendant 20 s.', cd: 16 },
];
