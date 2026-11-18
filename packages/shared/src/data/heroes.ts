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

/** Apparence du héros (« skin ») : ses pouvoirs viennent de sa classe (voir data/classes). */
export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  desc: string;
  color: number;
}

export const HEROES: Record<HeroId, HeroDef> = {
  samuel: {
    id: 'samuel', name: 'Samuel', title: 'Chevalier au grand cœur', color: 0x3b82f6,
    desc: 'Brave, loyal et légèrement maladroit. Était parti chercher des petits fours quand la princesse a été enlevée.',
  },
  lyra: {
    id: 'lyra', name: 'Patoche', title: 'Rôdeur de la forêt', color: 0x16a34a,
    desc: 'Connaît chaque arbre de la forêt par son prénom. Les arbres, eux, l’appellent « le bruyant ».',
  },
  brom: {
    id: 'brom', name: 'Matéo', title: 'Nain forgeron', color: 0xb45309,
    desc: 'A forgé son marteau lui-même. Puis son enclume. Puis un deuxième marteau, par sécurité.',
  },
  nox: {
    id: 'nox', name: 'William', title: 'Érudit des ombres', color: 0x7c3aed,
    desc: 'A lu tous les grimoires de la bibliothèque, y compris ceux qu’il ne fallait pas.',
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
