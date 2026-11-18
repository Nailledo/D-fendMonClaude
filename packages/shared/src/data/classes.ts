import { DmgType } from '../types';
import type { HeroSkillDef } from './heroes';

/**
 * Classes du héros. L'apparence (Samuel, Patoche, Matéo, William) est un simple « skin » ;
 * les statistiques, les compétences et les passifs viennent de la classe choisie dans l'arbre du héros.
 *
 * Sans vocation, le héros est un Aventurier : deux compétences simples, pas d'ultime.
 * Chaque classe est une chaîne de cinq nœuds, achetés dans l'ordre avec les points de héros :
 *   Vocation (1) → passif (1) → compétence (2) → passif (2) → ultime (3)
 * plus une branche commune « Entraînement » (3 rangs à 1 point). Un seul choix de classe à la fois ;
 * l'arbre se réinitialise gratuitement. Les points viennent des niveaux de l'histoire réussis.
 */

/** Style d'arme et d'animation : 1 épée, 2 arc, 3 marteau, 4 bâton. */
export type WeaponStyle = 1 | 2 | 3 | 4;

export interface ClassSkill extends HeroSkillDef {
  id: string;
}

export interface ClassPassive {
  id: string;
  name: string;
  desc: string;
}

export interface ClassDef {
  id: string;
  name: string;
  /** rôle en deux mots (carte de l'arbre) */
  role: string;
  desc: string;
  style: WeaponStyle;
  color: number;
  hp: number;
  hpPerLevel: number;
  dmg: [number, number];
  dmgPerLevel: number;
  dmgType: DmgType;
  cooldown: number;
  armor: number;
  speed: number;
  regen: number;
  /** 0 = mêlée */
  range: number;
  /** compétence A, compétence B, ultime */
  skills: [ClassSkill, ClassSkill, ClassSkill] | [ClassSkill, ClassSkill];
  passives: [ClassPassive, ClassPassive] | [];
}

const sk = (id: string, name: string, short: string, icon: string, desc: string, cd: number, unlock: number, targeted: boolean, range?: number): ClassSkill =>
  ({ id, name, short, icon, desc, cd, unlock, targeted, range });

export const CLASSES: ClassDef[] = [
  {
    id: 'aventurier', name: 'Aventurier', role: 'Sans vocation', style: 1, color: 0x8d6e63,
    desc: 'Un peu de tout, beaucoup de courage. Choisissez une vocation dans l’arbre du héros pour le spécialiser.',
    hp: 220, hpPerLevel: 18, dmg: [11, 18], dmgPerLevel: 2.2, dmgType: DmgType.Phys, cooldown: 1, armor: 0.2, speed: 3, regen: 5, range: 0,
    skills: [
      sk('coup', 'Coup puissant', 'Coup', 'strike', 'Frappe les ennemis autour de lui.', 10, 1, false),
      sk('souffle', 'Second souffle', 'Souffle', 'breath', 'Récupère 35 % de ses PV.', 25, 3, false),
    ],
    passives: [],
  },
  {
    id: 'epeiste', name: 'Épéiste', role: 'Mêlée, dégâts', style: 1, color: 0x3b82f6,
    desc: 'Une lame, un panache, et beaucoup trop de confiance en soi.',
    hp: 240, hpPerLevel: 20, dmg: [13, 21], dmgPerLevel: 2.6, dmgType: DmgType.Phys, cooldown: 0.9, armor: 0.3, speed: 3.1, regen: 5, range: 0,
    skills: [
      sk('charge', 'Charge héroïque', 'Charge', 'charge', 'Fonce vers le curseur, dans la limite de sa portée, et blesse tous les ennemis sur son passage.', 12, 1, true, 7),
      sk('tourbillon', 'Tourbillon', 'Tourbillon', 'spin', 'Tournoie en frappant trois fois tous les ennemis autour de lui.', 14, 3, false),
      sk('ethan', 'Pour Ethan !', 'Pour Ethan', 'ultSword', 'Frappe titanesque en zone et bouclier sur les soldats autour.', 60, 5, false),
    ],
    passives: [
      { id: 'affute', name: 'Lame affûtée', desc: '+20 % de dégâts.' },
      { id: 'riposte', name: 'Riposte', desc: '20 % de chances d’infliger des dégâts doublés.' },
    ],
  },
  {
    id: 'gardien', name: 'Gardien', role: 'Tank, soutien', style: 3, color: 0x64748b,
    desc: 'Un mur avec des bras. Les ennemis s’y cassent les dents, les soldats s’y abritent.',
    hp: 330, hpPerLevel: 26, dmg: [10, 16], dmgPerLevel: 1.8, dmgType: DmgType.Phys, cooldown: 1.1, armor: 0.45, speed: 2.6, regen: 6, range: 0,
    skills: [
      sk('marteau', 'Coup de marteau', 'Marteau', 'hammer', 'Frappe le sol et étourdit les ennemis autour.', 12, 1, false),
      sk('ralliement', 'Cri de ralliement', 'Ralliement', 'rally', 'Soigne les soldats proches et augmente leurs dégâts pendant 6 s.', 20, 3, false),
      sk('rempart', 'Rempart', 'Rempart', 'bulwark', 'Bouclier massif sur lui et les soldats proches ; les ennemis autour sont étourdis.', 60, 5, false),
    ],
    passives: [
      { id: 'enclume', name: 'Peau d’enclume', desc: '+15 % d’armure et régénération plus rapide.' },
      { id: 'vaillant', name: 'Cœur vaillant', desc: 'Les soldats proches subissent 15 % de dégâts en moins.' },
    ],
  },
  {
    id: 'archer', name: 'Archer', role: 'Distance, volants', style: 2, color: 0x16a34a,
    desc: 'Ne rate jamais sa cible, sauf quand on lui parle pendant qu’il vise.',
    hp: 165, hpPerLevel: 13, dmg: [11, 17], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 0.75, armor: 0.1, speed: 3.3, regen: 4, range: 6.5,
    skills: [
      sk('perce', 'Flèche perçante', 'Perçante', 'pierce', 'Une flèche qui traverse tous les ennemis en ligne.', 10, 1, true),
      sk('pluie', 'Pluie de flèches', 'Pluie', 'rain', 'Arrose une zone pendant 3 s.', 18, 3, true),
      sk('aube', 'Volée de l’aube', 'Volée', 'dawn', 'Une salve dorée qui frappe tous les ennemis à portée.', 60, 5, false),
    ],
    passives: [
      { id: 'oeil', name: 'Œil perçant', desc: '20 % de chances d’infliger des dégâts doublés.' },
      { id: 'portee', name: 'Longue-vue', desc: '+1,5 de portée de tir.' },
    ],
  },
  {
    id: 'mage', name: 'Mage', role: 'Magie, zone', style: 4, color: 0x9333ea,
    desc: 'Lit dans les étoiles, parle aux flammes et voit ce qui se cache.',
    hp: 165, hpPerLevel: 13, dmg: [14, 22], dmgPerLevel: 2.4, dmgType: DmgType.Magic, cooldown: 1.2, armor: 0.05, speed: 3, regen: 4, range: 5.5,
    skills: [
      sk('boule', 'Boule de feu', 'Feu', 'fireball', 'Explose au point visé : dégâts magiques en zone, même sur le plomb.', 10, 1, true, 8),
      sk('nova', 'Nova de givre', 'Givre', 'nova', 'Gèle les ennemis autour de lui pendant 2 s.', 18, 3, false),
      sk('meteore', 'Météore', 'Météore', 'meteor', 'Un rocher en flammes s’écrase sur la zone visée.', 60, 5, true),
    ],
    passives: [
      { id: 'clairvoyance', name: 'Clairvoyance', desc: 'Repère les camouflés de bien plus loin.' },
      { id: 'arcanes', name: 'Arcanes', desc: '+20 % de dégâts.' },
    ],
  },
  {
    id: 'necro', name: 'Nécromancien', role: 'Invocations', style: 4, color: 0x7c3aed,
    desc: 'Il a promis d’arrêter de réveiller les morts. Sauf pour les bonnes causes.',
    hp: 170, hpPerLevel: 14, dmg: [13, 21], dmgPerLevel: 2.2, dmgType: DmgType.Magic, cooldown: 1.2, armor: 0, speed: 3, regen: 4, range: 5.5,
    skills: [
      sk('os', 'Os ranimés', 'Squelettes', 'bones', 'Invoque 2 squelettes près du curseur.', 14, 1, true),
      sk('drain', 'Drain de vie', 'Drain', 'drain', 'Aspire la vie des ennemis autour de lui.', 16, 3, false),
      sk('armee', 'Armée des morts', 'Armée', 'army', 'Invoque 6 squelettes au curseur.', 60, 5, true),
    ],
    passives: [
      { id: 'vampire', name: 'Vol de vie', desc: 'Récupère 20 % des dégâts infligés.' },
      { id: 'ossements', name: 'Os solides', desc: 'Squelettes : +40 % de PV, 4 s de plus.' },
    ],
  },
  {
    id: 'alchimiste', name: 'Alchimiste', role: 'Zone, explosifs', style: 4, color: 0x0d9488,
    desc: 'Lance des fioles. Certaines soignent. La plupart explosent.',
    hp: 185, hpPerLevel: 15, dmg: [10, 16], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 1.1, armor: 0.1, speed: 3, regen: 5, range: 5,
    skills: [
      sk('acide', 'Flasque d’acide', 'Acide', 'acid', 'Une flaque d’acide ronge et ralentit les ennemis pendant 4 s.', 12, 1, true, 7),
      sk('elixir', 'Élixir', 'Élixir', 'elixir', 'Soigne le héros et les soldats proches, et renforce leurs coups 6 s.', 20, 3, false),
      sk('transmutation', 'Transmutation', 'Transmut.', 'transmute', 'Énorme explosion au point visé ; chaque ennemi touché rapporte 3 or.', 60, 5, true),
    ],
    passives: [
      { id: 'instable', name: 'Mélange instable', desc: 'Ses fioles explosent en petite zone (efficaces contre le plomb).' },
      { id: 'vigueur', name: 'Potion de vigueur', desc: '+10 % de PV, régénération doublée.' },
    ],
  },
  {
    id: 'ingenieur', name: 'Ingénieur', role: 'Tourelles, explosifs', style: 3, color: 0xb45309,
    desc: 'A forgé son marteau lui-même. Puis son enclume. Puis un deuxième marteau, par sécurité.',
    hp: 270, hpPerLevel: 21, dmg: [10, 16], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 1.05, armor: 0.35, speed: 2.8, regen: 5, range: 0,
    skills: [
      sk('tourelle', 'Tourelle de forge', 'Tourelle', 'turret', 'Pose une tourelle temporaire qui tire sur les ennemis.', 20, 1, true),
      sk('bombe', 'Bombe', 'Bombe', 'bomb', 'Lance une bombe : dégâts explosifs en zone et ennemis sonnés.', 14, 3, true, 7),
      sk('forge', 'Forge ardente', 'Forge', 'flame', 'Transforme le sol en métal fondu pendant 5 s.', 60, 5, true),
    ],
    passives: [
      { id: 'mecanique', name: 'Mécanique fine', desc: 'Tourelles : +40 % de PV et de dégâts.' },
      { id: 'blindage', name: 'Blindage', desc: '+15 % d’armure et de PV.' },
    ],
  },
];

export const CLASS_AVENTURIER = 0;

/** Arbre du héros : classe choisie (1..7, 0 = aucune), nœuds achetés dans sa chaîne, rangs d'entraînement. */
export interface HeroBuild {
  cls: number;
  nodes: number;
  common: number;
}

/** Coût des nœuds d'une chaîne de classe, dans l'ordre. */
export const NODE_COST = [1, 1, 2, 2, 3];
export const COMMON_RANKS = 3;
export const COMMON_COST = 1;
/** Entraînement : bonus par rang */
export const COMMON_HP = 0.08;
export const COMMON_DMG = 0.05;
/** Niveaux du héros (en partie) qui débloquent les compétences A, B et l'ultime. */
export const SKILL_UNLOCK = [1, 3, 5];

export const EMPTY_BUILD: HeroBuild = { cls: 0, nodes: 0, common: 0 };

/** Libellés des nœuds d'une chaîne (passifs et compétences selon la classe). */
export function chainNodes(c: ClassDef): { kind: 'vocation' | 'passive' | 'skill' | 'ult'; name: string; desc: string; cost: number }[] {
  if (!c.passives.length || c.skills.length < 3) return [];
  const [a, b, u] = c.skills as [ClassSkill, ClassSkill, ClassSkill];
  const [p1, p2] = c.passives as [ClassPassive, ClassPassive];
  return [
    { kind: 'vocation', name: `Vocation : ${c.name}`, desc: `Statistiques de ${c.name.toLowerCase()} et compétence « ${a.name} » : ${a.desc}`, cost: NODE_COST[0] },
    { kind: 'passive', name: p1.name, desc: p1.desc, cost: NODE_COST[1] },
    { kind: 'skill', name: b.name, desc: b.desc, cost: NODE_COST[2] },
    { kind: 'passive', name: p2.name, desc: p2.desc, cost: NODE_COST[3] },
    { kind: 'ult', name: u.name, desc: u.desc, cost: NODE_COST[4] },
  ];
}

export function sanitizeBuild(b: unknown): HeroBuild {
  const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
  const int = (v: unknown, max: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };
  const cls = int(o.cls, CLASSES.length - 1);
  return { cls, nodes: cls ? int(o.nodes, NODE_COST.length) : 0, common: int(o.common, COMMON_RANKS) };
}

export function buildCost(b: HeroBuild): number {
  let n = b.common * COMMON_COST;
  for (let k = 0; k < Math.min(b.nodes, NODE_COST.length); k++) n += NODE_COST[k];
  return n;
}

/** Points de héros gagnés : un par niveau de l'histoire réussi, un de plus s'il l'a été en Vétéran ou Cauchemar. */
export function heroPoints(stars: readonly (readonly number[] | undefined)[]): number {
  let n = 0;
  for (const s of stars) {
    if (!s) continue;
    if (s.some((v) => v > 0)) n++;
    if ((s[1] ?? 0) > 0 || (s[2] ?? 0) > 0) n++;
  }
  return n;
}

/** Classe active : l'Aventurier tant que la vocation n'est pas achetée. */
export function classOf(b: HeroBuild | undefined): ClassDef {
  return b && b.cls > 0 && b.nodes > 0 ? CLASSES[b.cls] ?? CLASSES[0] : CLASSES[0];
}

/** Compétences des trois emplacements (null : emplacement vide). */
export function heroSkills(b: HeroBuild | undefined): (ClassSkill | null)[] {
  const base = CLASSES[0].skills;
  const c = classOf(b);
  const n = c === CLASSES[0] ? 0 : b!.nodes;
  return [n >= 1 ? c.skills[0] : base[0], n >= 3 ? c.skills[1] : base[1], n >= 5 ? c.skills[2] ?? null : null];
}

/** Passifs acquis (identifiants). */
export function heroPassives(b: HeroBuild | undefined): string[] {
  const c = classOf(b);
  if (c === CLASSES[0]) return [];
  const out: string[] = [];
  if (b!.nodes >= 2) out.push(c.passives[0]!.id);
  if (b!.nodes >= 4) out.push(c.passives[1]!.id);
  return out;
}
