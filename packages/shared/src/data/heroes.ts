import { DmgType, type HeroId } from '../types';

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

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  desc: string;
  hp: number;
  hpPerLevel: number;
  dmg: [number, number];
  dmgPerLevel: number;
  dmgType: DmgType;
  cooldown: number;
  armor: number;
  speed: number;
  regen: number;
  range: number; // 0 = mêlée uniquement
  passive: { name: string; desc: string };
  skills: [HeroSkillDef, HeroSkillDef, HeroSkillDef];
  color: number;
}

export const HEROES: Record<HeroId, HeroDef> = {
  samuel: {
    id: 'samuel', name: 'Samuel', title: 'Chevalier au grand cœur',
    desc: 'Brave, loyal et légèrement maladroit. Était parti chercher des petits fours quand la princesse a été enlevée.',
    hp: 240, hpPerLevel: 20, dmg: [12, 20], dmgPerLevel: 2.5, dmgType: DmgType.Phys, cooldown: 1, armor: 0.3, speed: 3, regen: 5, range: 0,
    passive: { name: 'Cœur vaillant', desc: 'Les soldats proches de Samuel subissent 15 % de dégâts en moins.' },
    skills: [
      { name: 'Charge héroïque', short: 'Charge', icon: 'charge', desc: 'Fonce vers le curseur, dans la limite de sa portée, et blesse tous les ennemis sur son passage.', cd: 12, unlock: 1, targeted: true, range: 7 },
      { name: 'Cri de ralliement', short: 'Ralliement', icon: 'rally', desc: 'Soigne les soldats proches et augmente leurs dégâts pendant 6 s.', cd: 20, unlock: 3, targeted: false },
      { name: 'Pour Ethan !', short: 'Pour Ethan', icon: 'ultSword', desc: 'Frappe titanesque en zone et bouclier sur les soldats autour.', cd: 60, unlock: 5, targeted: false },
    ],
    color: 0x3b82f6,
  },
  lyra: {
    id: 'lyra', name: 'Patoche', title: 'Archer de la forêt',
    desc: 'Ne rate jamais sa cible, sauf quand on lui parle pendant qu’il vise.',
    hp: 160, hpPerLevel: 13, dmg: [11, 17], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 0.75, armor: 0.1, speed: 3.3, regen: 4, range: 6.5,
    passive: { name: 'Œil perçant', desc: '20 % de chances d’infliger des dégâts doublés.' },
    skills: [
      { name: 'Flèche perçante', short: 'Perçante', icon: 'pierce', desc: 'Une flèche qui traverse tous les ennemis en ligne.', cd: 10, unlock: 1, targeted: true },
      { name: 'Pluie de flèches', short: 'Pluie', icon: 'rain', desc: 'Arrose une zone pendant 3 s.', cd: 18, unlock: 3, targeted: true },
      { name: 'Volée de l’aube', short: 'Volée', icon: 'dawn', desc: 'Une salve dorée qui frappe tous les ennemis à portée.', cd: 60, unlock: 5, targeted: false },
    ],
    color: 0x16a34a,
  },
  brom: {
    id: 'brom', name: 'Matéo', title: 'Forgeron nain',
    desc: 'A forgé son marteau lui-même. Puis son enclume. Puis un deuxième marteau, par sécurité.',
    hp: 320, hpPerLevel: 24, dmg: [10, 17], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 1.1, armor: 0.45, speed: 2.6, regen: 6, range: 0,
    passive: { name: 'Peau d’enclume', desc: 'Armure élevée, et se soigne plus vite.' },
    skills: [
      { name: 'Coup de marteau', short: 'Marteau', icon: 'hammer', desc: 'Frappe le sol et étourdit les ennemis autour.', cd: 12, unlock: 1, targeted: false },
      { name: 'Tourelle de forge', short: 'Tourelle', icon: 'turret', desc: 'Pose une tourelle temporaire qui tire sur les ennemis.', cd: 22, unlock: 3, targeted: true },
      { name: 'Forge ardente', short: 'Forge', icon: 'flame', desc: 'Transforme le sol en métal fondu pendant 5 s.', cd: 60, unlock: 5, targeted: true },
    ],
    color: 0xb45309,
  },
  nox: {
    id: 'nox', name: 'William', title: 'Nécromancien repenti',
    desc: 'Il a promis d’arrêter de réveiller les morts. Sauf pour les bonnes causes.',
    hp: 170, hpPerLevel: 14, dmg: [13, 21], dmgPerLevel: 2.2, dmgType: DmgType.Magic, cooldown: 1.2, armor: 0, speed: 3, regen: 4, range: 5.5,
    passive: { name: 'Vol de vie', desc: 'Récupère 20 % des dégâts infligés.' },
    skills: [
      { name: 'Os ranimés', short: 'Squelettes', icon: 'bones', desc: 'Invoque 2 squelettes près du curseur.', cd: 14, unlock: 1, targeted: true },
      { name: 'Drain de vie', short: 'Drain', icon: 'drain', desc: 'Aspire la vie des ennemis autour de lui.', cd: 16, unlock: 3, targeted: false },
      { name: 'Armée des morts', short: 'Armée', icon: 'army', desc: 'Invoque 6 squelettes au curseur.', cd: 60, unlock: 5, targeted: true },
    ],
    color: 0x7c3aed,
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
