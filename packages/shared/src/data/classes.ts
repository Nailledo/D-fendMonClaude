import { DmgType } from '../types';
import type { HeroSkillDef } from './heroes';

/**
 * Arbre du héros.
 *
 * Tous les héros commencent identiques (l'Aventurier : mêmes statistiques, Coup puissant et Second souffle).
 * L'apparence (Samuel, Patoche, Matéo, William) n'est qu'un « skin ».
 *
 * L'arbre est un graphe radial :
 * - au centre, le **cœur** : six nœuds communs (PV, dégâts, cadence, récupération, recharge, expérience) ;
 * - autour, **six branches de classe**. Acheter la racine d'une branche (« Vocation ») fixe la classe :
 *   les autres branches se verrouillent jusqu'à la réinitialisation (gratuite).
 * - chaque branche se divise en deux **voies** de cinq nœuds (compétence → statistique → passif → statistique → passif).
 *   Les deux compétences de voie occupent le même emplacement : en apprendre une ferme l'autre voie.
 * - l'**ultime** couronne la branche ; il s'ouvre depuis le 4e nœud de l'une ou l'autre voie.
 *
 * Indices des nœuds d'une branche : 0 racine, 1-5 voie gauche, 6-10 voie droite, 11 ultime.
 */

/** Style d'animation : 1 épée, 2 arc, 3 marteau, 4 bâton. */
export type WeaponStyle = 1 | 2 | 3 | 4;

export interface ClassSkill extends HeroSkillDef {
  id: string;
}

/** Statistiques que les nœuds font progresser (par rang). */
export type StatKind = 'hp' | 'dmg' | 'rate' | 'armor' | 'regen' | 'cd' | 'range' | 'speed' | 'skill' | 'summon' | 'xp';

export const STAT_LABEL: Record<StatKind, (v: number) => string> = {
  hp: (v) => `+${Math.round(v * 100)} % de PV`,
  dmg: (v) => `+${Math.round(v * 100)} % de dégâts`,
  rate: (v) => `+${Math.round(v * 100)} % de cadence d’attaque`,
  armor: (v) => `+${Math.round(v * 100)} % d’armure`,
  regen: (v) => `+${Math.round(v * 100)} % de régénération`,
  cd: (v) => `−${Math.round(v * 100)} % de recharge des compétences`,
  range: (v) => `+${String(v).replace('.', ',')} de portée`,
  speed: (v) => `+${Math.round(v * 100)} % de vitesse de déplacement`,
  skill: (v) => `+${Math.round(v * 100)} % de dégâts des compétences`,
  summon: (v) => `+${Math.round(v * 100)} % de PV et de dégâts des invocations et tourelles`,
  xp: (v) => `+${Math.round(v * 100)} % d’expérience`,
};

export type TreeNode =
  | { kind: 'root'; name: string; desc: string; cost: number; ranks: 1 }
  | { kind: 'stat'; name: string; stat: StatKind; per: number; cost: number; ranks: number; icon: string }
  | { kind: 'passive'; id: string; name: string; desc: string; cost: number; ranks: 1; icon: string }
  | { kind: 'skill'; skill: ClassSkill; cost: number; ranks: 1 }
  | { kind: 'ult'; skill: ClassSkill; cost: number; ranks: 1 };

export interface ClassPath {
  name: string;
  desc: string;
  /** compétence, stat, passif, stat, passif */
  nodes: [TreeNode, TreeNode, TreeNode, TreeNode, TreeNode];
}

export interface ClassDef {
  id: string;
  name: string;
  role: string;
  desc: string;
  /** animation */
  style: WeaponStyle;
  /** arme tenue (modèle) : 1 épée longue, 2 arc, 3 marteau et bouclier, 4 bâton à orbe, 5 bâton à crâne, 6 lance-fioles, 7 épée courte */
  weapon: number;
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
  /** compétence de la racine */
  a: ClassSkill;
  paths: [ClassPath, ClassPath];
  ult: ClassSkill;
}

const sk = (id: string, name: string, short: string, icon: string, desc: string, cd: number, targeted: boolean, range?: number): ClassSkill =>
  ({ id, name, short, icon, desc, cd, unlock: 1, targeted, range });
const stat = (name: string, s: StatKind, per: number, icon: string): TreeNode => ({ kind: 'stat', name, stat: s, per, cost: 1, ranks: 3, icon });
const pas = (id: string, name: string, desc: string, icon: string): TreeNode => ({ kind: 'passive', id, name, desc, cost: 2, ranks: 1, icon });
const skn = (s: ClassSkill): TreeNode => ({ kind: 'skill', skill: s, cost: 2, ranks: 1 });

/** L'Aventurier : le héros sans vocation (identique pour tous au départ). */
export const AVENTURIER = {
  name: 'Aventurier', role: 'Sans vocation', style: 1 as WeaponStyle, weapon: 7, color: 0x8d6e63,
  desc: 'Un peu de tout, beaucoup de courage. Choisissez une branche de l’arbre du héros pour le spécialiser.',
  hp: 230, hpPerLevel: 19, dmg: [12, 19] as [number, number], dmgPerLevel: 2.3, dmgType: DmgType.Phys, cooldown: 1, armor: 0.25, speed: 3, regen: 5, range: 0,
  skills: [
    sk('coup', 'Coup puissant', 'Coup', 'strike', 'Frappe les ennemis autour de lui.', 10, false),
    sk('souffle', 'Second souffle', 'Souffle', 'breath', 'Récupère 35 % de ses PV.', 25, false),
    sk('elan', 'Élan héroïque', 'Élan', 'ultSword', 'Frappe large autour de lui ; lui et les soldats proches se couvrent d’un bouclier.', 60, false),
  ] as [ClassSkill, ClassSkill, ClassSkill],
};

export const CLASSES: ClassDef[] = [
  {
    id: 'epeiste', name: 'Épéiste', role: 'Mêlée, dégâts', style: 1, weapon: 1, color: 0x3b82f6,
    desc: 'Une lame, un panache, et beaucoup trop de confiance en soi.',
    hp: 245, hpPerLevel: 20, dmg: [13, 21], dmgPerLevel: 2.6, dmgType: DmgType.Phys, cooldown: 0.9, armor: 0.3, speed: 3.1, regen: 5, range: 0,
    a: sk('charge', 'Charge héroïque', 'Charge', 'charge', 'Fonce vers le curseur, dans la limite de sa portée, et blesse tous les ennemis sur son passage.', 12, true, 7),
    paths: [
      { name: 'Duelliste', desc: 'Coups critiques et frappes tournoyantes.', nodes: [
        skn(sk('tourbillon', 'Tourbillon', 'Tourbillon', 'spin', 'Tournoie en frappant trois fois tous les ennemis autour de lui.', 14, false)),
        stat('Fil de la lame', 'dmg', 0.06, 'strike'),
        pas('riposte', 'Riposte', '20 % de chances d’infliger des dégâts doublés.', 'crit'),
        stat('Danse des lames', 'rate', 0.06, 'fast'),
        pas('execution', 'Exécution', 'Ses coups critiques infligent le triple des dégâts.', 'skull'),
      ] },
      { name: 'Chevalier', desc: 'Mène les soldats au combat.', nodes: [
        skn(sk('ralliement', 'Cri de ralliement', 'Ralliement', 'rally', 'Soigne les soldats proches et augmente leurs dégâts pendant 6 s.', 20, false)),
        stat('Cotte de mailles', 'hp', 0.08, 'heart'),
        pas('vaillant', 'Cœur vaillant', 'Les soldats proches subissent 15 % de dégâts en moins.', 'shield'),
        stat('Armure de plates', 'armor', 0.05, 'shield'),
        pas('inspiration', 'Inspiration', 'Les soldats proches infligent 25 % de dégâts en plus.', 'flag'),
      ] },
    ],
    ult: sk('ethan', 'Pour Ethan !', 'Pour Ethan', 'ultSword', 'Frappe titanesque en zone et bouclier sur les soldats autour.', 60, false),
  },
  {
    id: 'gardien', name: 'Gardien', role: 'Tank, protection', style: 3, weapon: 3, color: 0x64748b,
    desc: 'Un mur avec des bras. Les ennemis s’y cassent les dents, les soldats s’y abritent.',
    hp: 330, hpPerLevel: 26, dmg: [10, 16], dmgPerLevel: 1.8, dmgType: DmgType.Phys, cooldown: 1.1, armor: 0.45, speed: 2.6, regen: 6, range: 0,
    a: sk('marteau', 'Coup de marteau', 'Marteau', 'hammer', 'Frappe le sol et étourdit les ennemis autour.', 12, false),
    paths: [
      { name: 'Bastion', desc: 'Encaisse tout, renvoie les coups.', nodes: [
        skn(sk('defi', 'Défi', 'Défi', 'roar', 'Étourdit les ennemis autour et se couvre d’un bouclier.', 16, false)),
        stat('Peau épaisse', 'armor', 0.05, 'shield'),
        pas('enclume', 'Peau d’enclume', '+15 % d’armure et régénération plus rapide.', 'shield'),
        stat('Carrure', 'hp', 0.08, 'heart'),
        pas('epines', 'Épines', 'Renvoie 25 % des dégâts de mêlée reçus.', 'thorns'),
      ] },
      { name: 'Protecteur', desc: 'Garde les soldats en vie.', nodes: [
        skn(sk('egide', 'Égide', 'Égide', 'bulwark', 'Bouclier sur lui et les soldats proches.', 18, false)),
        stat('Second souffle', 'regen', 0.3, 'breath'),
        pas('garde', 'Garde rapprochée', 'Les soldats proches subissent 20 % de dégâts en moins.', 'shield'),
        stat('Vigilance', 'cd', 0.05, 'clock'),
        pas('soin', 'Présence apaisante', 'Les soldats proches régénèrent 2 % de leurs PV par seconde.', 'breath'),
      ] },
    ],
    ult: sk('rempart', 'Rempart', 'Rempart', 'bulwark', 'Bouclier massif sur lui et les soldats proches ; les ennemis autour sont étourdis.', 60, false),
  },
  {
    id: 'archer', name: 'Archer', role: 'Distance, volants', style: 2, weapon: 2, color: 0x16a34a,
    desc: 'Ne rate jamais sa cible, sauf quand on lui parle pendant qu’il vise.',
    hp: 165, hpPerLevel: 13, dmg: [11, 17], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 0.75, armor: 0.1, speed: 3.3, regen: 4, range: 6.5,
    a: sk('perce', 'Flèche perçante', 'Perçante', 'pierce', 'Une flèche qui traverse tous les ennemis en ligne.', 10, true),
    paths: [
      { name: 'Tireur d’élite', desc: 'Un tir, un ennemi en moins.', nodes: [
        skn(sk('visee', 'Tir ajusté', 'Ajusté', 'target', 'Un tir dévastateur sur le point visé.', 12, true, 10)),
        stat('Pointes acérées', 'dmg', 0.06, 'pierce'),
        pas('oeil', 'Œil perçant', '20 % de chances d’infliger des dégâts doublés.', 'eye'),
        stat('Longue-vue', 'range', 0.4, 'eye'),
        pas('tirmortel', 'Tir mortel', '6 % de chances que ses flèches tuent net un ennemi (hors boss).', 'skull'),
      ] },
      { name: 'Pisteur', desc: 'Des flèches partout, tout le temps.', nodes: [
        skn(sk('pluie', 'Pluie de flèches', 'Pluie', 'rain', 'Arrose une zone pendant 3 s.', 18, true)),
        stat('Corde tendue', 'rate', 0.06, 'fast'),
        pas('multi', 'Double tir', 'Chaque tir frappe aussi un second ennemi.', 'pierce'),
        stat('Pas léger', 'speed', 0.06, 'fast'),
        pas('portee', 'Vue de faucon', '+1,5 de portée de tir.', 'eye'),
      ] },
    ],
    ult: sk('aube', 'Volée de l’aube', 'Volée', 'dawn', 'Une salve dorée qui frappe tous les ennemis à portée.', 60, false),
  },
  {
    id: 'mage', name: 'Mage', role: 'Magie, zone, détection', style: 4, weapon: 4, color: 0x9333ea,
    desc: 'Lit dans les étoiles, parle aux flammes et voit ce qui se cache.',
    hp: 165, hpPerLevel: 13, dmg: [14, 22], dmgPerLevel: 2.4, dmgType: DmgType.Magic, cooldown: 1.2, armor: 0.05, speed: 3, regen: 4, range: 5.5,
    a: sk('boule', 'Boule de feu', 'Feu', 'fireball', 'Explose au point visé : dégâts magiques en zone, même sur le plomb.', 10, true, 8),
    paths: [
      { name: 'Pyromancien', desc: 'Tout brûle, tôt ou tard.', nodes: [
        skn(sk('flammes', 'Mur de flammes', 'Flammes', 'flame', 'Embrase une zone pendant 4 s.', 16, true, 8)),
        stat('Flamme vive', 'skill', 0.08, 'flame'),
        pas('brulure', 'Brûlure', 'Ses attaques enflamment les ennemis (dégâts pendant 4 s).', 'flame'),
        stat('Arcanes', 'dmg', 0.06, 'orb'),
        pas('clairvoyance', 'Clairvoyance', 'Repère les camouflés de bien plus loin.', 'eye'),
      ] },
      { name: 'Cryomancien', desc: 'Le froid qui fige et protège.', nodes: [
        skn(sk('nova', 'Nova de givre', 'Givre', 'nova', 'Gèle les ennemis autour de lui pendant 2 s.', 18, false)),
        stat('Concentration', 'cd', 0.05, 'clock'),
        pas('givre', 'Toucher glacé', 'Ses attaques ralentissent les ennemis de 30 %.', 'snow'),
        stat('Armure de givre', 'hp', 0.08, 'snow'),
        pas('focalisation', 'Focalisation', 'Recharge des compétences réduite de 20 %.', 'clock'),
      ] },
    ],
    ult: sk('meteore', 'Météore', 'Météore', 'meteor', 'Un rocher en flammes s’écrase sur la zone visée.', 60, true),
  },
  {
    id: 'necro', name: 'Nécromancien', role: 'Invocations, vol de vie', style: 4, weapon: 5, color: 0x7c3aed,
    desc: 'A promis d’arrêter de réveiller les morts. Sauf pour les bonnes causes.',
    hp: 170, hpPerLevel: 14, dmg: [13, 21], dmgPerLevel: 2.2, dmgType: DmgType.Magic, cooldown: 1.2, armor: 0, speed: 3, regen: 4, range: 5.5,
    a: sk('os', 'Os ranimés', 'Squelettes', 'bones', 'Invoque 2 squelettes près du curseur.', 14, true),
    paths: [
      { name: 'Faucheur', desc: 'Vit de la vie des autres.', nodes: [
        skn(sk('drain', 'Drain de vie', 'Drain', 'drain', 'Aspire la vie des ennemis autour de lui.', 16, false)),
        stat('Malédiction', 'dmg', 0.06, 'skull'),
        pas('vampire', 'Vol de vie', 'Récupère 20 % des dégâts infligés.', 'drain'),
        stat('Sang froid', 'hp', 0.08, 'heart'),
        pas('moisson', 'Moisson', 'Chaque ennemi tué par le héros lui rend 6 % de ses PV.', 'skull'),
      ] },
      { name: 'Maître des os', desc: 'Une armée qui ne meurt jamais vraiment.', nodes: [
        skn(sk('golem', 'Colosse d’os', 'Colosse', 'army', 'Assemble un colosse d’os très résistant au curseur.', 22, true)),
        stat('Os durcis', 'summon', 0.1, 'bones'),
        pas('ossements', 'Os solides', 'Invocations : +40 % de PV et 4 s de plus.', 'bones'),
        stat('Rituel', 'cd', 0.05, 'clock'),
        pas('legion', 'Légion', 'Os ranimés invoque 3 squelettes, l’Armée des morts 8.', 'army'),
      ] },
    ],
    ult: sk('armee', 'Armée des morts', 'Armée', 'army', 'Invoque 6 squelettes au curseur.', 60, true),
  },
  {
    id: 'artificier', name: 'Artificier', role: 'Explosifs, tourelles', style: 4, weapon: 6, color: 0x0d9488,
    desc: 'Mi-alchimiste, mi-ingénieur. Lance des fioles, pose des tourelles, et recule toujours d’un pas avant.',
    hp: 200, hpPerLevel: 17, dmg: [10, 16], dmgPerLevel: 2, dmgType: DmgType.Phys, cooldown: 1.1, armor: 0.2, speed: 2.9, regen: 5, range: 5,
    a: sk('bombe', 'Bombe', 'Bombe', 'bomb', 'Lance une bombe : dégâts explosifs en zone et ennemis sonnés.', 12, true, 7),
    paths: [
      { name: 'Alchimiste', desc: 'Acides, élixirs et fioles instables.', nodes: [
        skn(sk('acide', 'Flasque d’acide', 'Acide', 'acid', 'Une flaque d’acide ronge et ralentit les ennemis pendant 4 s.', 12, true, 7)),
        stat('Mélanges', 'skill', 0.08, 'acid'),
        pas('instable', 'Mélange instable', 'Ses fioles explosent en petite zone (efficaces contre le plomb).', 'bomb'),
        stat('Potion de vigueur', 'regen', 0.3, 'elixir'),
        pas('catalyse', 'Catalyse', 'Bombe et acide : zone +30 % ; l’acide dure 2 s de plus.', 'acid'),
      ] },
      { name: 'Ingénieur', desc: 'Des tourelles, encore des tourelles.', nodes: [
        skn(sk('tourelle', 'Tourelle de forge', 'Tourelle', 'turret', 'Pose une tourelle temporaire qui tire sur les ennemis.', 20, true)),
        stat('Plans d’atelier', 'summon', 0.1, 'turret'),
        pas('mecanique', 'Mécanique fine', 'Tourelles : +40 % de PV et de dégâts.', 'turret'),
        stat('Blindage', 'armor', 0.05, 'shield'),
        pas('forge', 'Forge portative', 'Les tourelles durent 8 s de plus et enflamment le sol à leur arrivée.', 'flame'),
      ] },
    ],
    ult: sk('transmutation', 'Transmutation', 'Transmut.', 'transmute', 'Énorme explosion au point visé ; chaque ennemi touché rapporte 3 or.', 60, true),
  },
];

/** Le cœur : nœuds communs à toutes les classes (sans prérequis). */
export const CORE: { name: string; stat: StatKind; per: number; icon: string }[] = [
  { name: 'Vigueur', stat: 'hp', per: 0.06, icon: 'heart' },
  { name: 'Force', stat: 'dmg', per: 0.05, icon: 'strike' },
  { name: 'Vivacité', stat: 'rate', per: 0.05, icon: 'fast' },
  { name: 'Récupération', stat: 'regen', per: 0.25, icon: 'breath' },
  { name: 'Concentration', stat: 'cd', per: 0.04, icon: 'clock' },
  { name: 'Savoir', stat: 'xp', per: 0.1, icon: 'book' },
];
export const CORE_RANKS = 3;
export const CORE_COST = 1;

/** Nœuds d'une branche, dans l'ordre des indices (0 racine, 1-5 gauche, 6-10 droite, 11 ultime). */
export function classNodes(c: ClassDef): TreeNode[] {
  return [
    { kind: 'root', name: `Vocation : ${c.name}`, desc: `Le héros devient ${c.name.toLowerCase()} : ses statistiques changent et il apprend « ${c.a.name} » (${c.a.desc.charAt(0).toLowerCase() + c.a.desc.slice(1)})`, cost: 1, ranks: 1 },
    ...c.paths[0].nodes,
    ...c.paths[1].nodes,
    { kind: 'ult', skill: c.ult, cost: 3, ranks: 1 },
  ];
}
export const NODE_COUNT = 12;
/** niveau du héros (en partie) requis pour chaque emplacement de compétence */
export const SKILL_UNLOCK = [1, 3, 5];
export const ULT_NODE = 11;
/** compétences de voie (même emplacement, s'excluent) */
export const PATH_SKILL = [1, 6];

/** Prérequis d'un nœud (un seul suffit). */
export function nodeReqs(i: number): number[] {
  if (i === 0) return [];
  if (i === 1 || i === 6) return [0];
  if (i === ULT_NODE) return [4, 9];
  return [i - 1];
}

/** Arbre du héros : branche choisie (-1 : aucune), rangs des 12 nœuds de la branche, rangs des 6 nœuds du cœur. */
export interface HeroBuild {
  cls: number;
  r: number[];
  core: number[];
}

export const EMPTY_BUILD: HeroBuild = { cls: -1, r: Array(NODE_COUNT).fill(0), core: Array(CORE.length).fill(0) };

/** Un nœud de la branche peut-il recevoir un rang de plus (prérequis, exclusivité, maximum) ? Sans tenir compte des points. */
export function nodeOpen(b: HeroBuild, cls: number, i: number): boolean {
  if (b.cls >= 0 && b.cls !== cls) return false;
  const nodes = classNodes(CLASSES[cls]);
  const r = b.cls === cls ? b.r : EMPTY_BUILD.r;
  if (r[i] >= nodes[i].ranks) return false;
  const reqs = nodeReqs(i);
  if (reqs.length && !reqs.some((q) => r[q] > 0)) return false;
  // compétences de voie exclusives : l'une ferme l'autre
  const o = PATH_SKILL.indexOf(i);
  if (o >= 0 && r[PATH_SKILL[1 - o]] > 0) return false;
  return true;
}

/** Arbre reçu d'une source non sûre : rangs bornés, prérequis et exclusivités respectés (sinon coupés). */
export function sanitizeBuild(raw: unknown): HeroBuild {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, max: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };
  const coreIn = Array.isArray(o.core) ? o.core : [];
  const core = CORE.map((_, i) => int(coreIn[i], CORE_RANKS));
  const cls = Number.isInteger(o.cls) && (o.cls as number) >= 0 && (o.cls as number) < CLASSES.length ? (o.cls as number) : -1;
  if (cls < 0 || !Array.isArray(o.r)) return { cls: -1, r: Array(NODE_COUNT).fill(0), core };
  const nodes = classNodes(CLASSES[cls]);
  const want = nodes.map((n, i) => int((o.r as unknown[])[i], n.ranks));
  // on reconstruit dans un ordre qui respecte les prérequis
  const b: HeroBuild = { cls, r: Array(NODE_COUNT).fill(0), core };
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const i of order) {
    for (let k = 0; k < want[i]; k++) if (nodeOpen(b, cls, i)) b.r[i]++;
  }
  if (!b.r[0]) return { cls: -1, r: Array(NODE_COUNT).fill(0), core };
  return b;
}

export function buildCost(b: HeroBuild): number {
  let n = 0;
  for (const r of b.core) n += r * CORE_COST;
  if (b.cls >= 0) classNodes(CLASSES[b.cls]).forEach((nd, i) => (n += (b.r[i] ?? 0) * nd.cost));
  return n;
}

/**
 * Points de héros gagnés dans l'histoire, par niveau : 1 pour la première victoire, +1 en Vétéran, +1 en Cauchemar,
 * et +1 par difficulté terminée avec 3 étoiles (6 au plus par niveau).
 */
export function heroPoints(stars: readonly (readonly number[] | undefined)[]): number {
  let n = 0;
  for (const s of stars) {
    if (!s) continue;
    if (s.some((v) => v > 0)) n++;
    if ((s[1] ?? 0) > 0) n++;
    if ((s[2] ?? 0) > 0) n++;
    for (const v of s) if (v >= 3) n++;
  }
  return n;
}

/** Définition de combat du héros : l'Aventurier, ou la classe choisie. */
export function classOf(b: HeroBuild | undefined): ClassDef | null {
  return b && b.cls >= 0 && b.r[0] > 0 ? CLASSES[b.cls] ?? null : null;
}

/**
 * Compétences apprises, résumées en un octet (pour l'instantané réseau) :
 * bit 0 racine, bit 1 compétence de la voie gauche, bit 2 de la voie droite, bit 3 ultime.
 */
export function buildKit(b: HeroBuild): number {
  if (!classOf(b)) return 0;
  return (b.r[0] > 0 ? 1 : 0) | (b.r[PATH_SKILL[0]] > 0 ? 2 : 0) | (b.r[PATH_SKILL[1]] > 0 ? 4 : 0) | (b.r[ULT_NODE] > 0 ? 8 : 0);
}

/** Compétences des trois emplacements, d'après la classe (-1 : aucune) et le kit : celles de l'Aventurier tant que la classe n'a pas mieux. */
export function kitSkills(cls: number, kit: number): (ClassSkill | null)[] {
  const c = cls >= 0 ? CLASSES[cls] : null;
  if (!c || !(kit & 1)) return [...AVENTURIER.skills];
  const b = kit & 2 ? (c.paths[0].nodes[0] as { skill: ClassSkill }).skill : kit & 4 ? (c.paths[1].nodes[0] as { skill: ClassSkill }).skill : AVENTURIER.skills[1];
  return [c.a, b, kit & 8 ? c.ult : AVENTURIER.skills[2]];
}

export function heroSkills(b: HeroBuild | undefined): (ClassSkill | null)[] {
  return b ? kitSkills(b.cls, buildKit(b)) : kitSkills(-1, 0);
}

/** Passifs acquis (identifiants). */
export function heroPassives(b: HeroBuild | undefined): string[] {
  const c = classOf(b);
  if (!c || !b) return [];
  const out: string[] = [];
  classNodes(c).forEach((n, i) => { if (n.kind === 'passive' && b.r[i] > 0) out.push(n.id); });
  return out;
}

/** Bonus cumulés des nœuds de statistiques (branche et cœur). */
export function heroStatBonus(b: HeroBuild | undefined): Record<StatKind, number> {
  const out: Record<StatKind, number> = { hp: 0, dmg: 0, rate: 0, armor: 0, regen: 0, cd: 0, range: 0, speed: 0, skill: 0, summon: 0, xp: 0 };
  if (!b) return out;
  CORE.forEach((n, i) => (out[n.stat] += n.per * (b.core[i] ?? 0)));
  const c = classOf(b);
  if (c) classNodes(c).forEach((n, i) => { if (n.kind === 'stat') out[n.stat] += n.per * (b.r[i] ?? 0); });
  return out;
}

/** Arme et animation (Aventurier compris). */
export function classLook(cls: number): { style: WeaponStyle; weapon: number; color: number; name: string } {
  const c = cls >= 0 ? CLASSES[cls] : null;
  return c ? { style: c.style, weapon: c.weapon, color: c.color, name: c.name } : { style: AVENTURIER.style, weapon: AVENTURIER.weapon, color: AVENTURIER.color, name: AVENTURIER.name };
}
