import type { Biome } from '../types';

export interface EnemyAbilities {
  heal?: { pct: number; radius: number; cd: number };
  regen?: number;
  stunTowers?: { range: number; cd: number; dur: number };
  kamikaze?: { dmg: number; radius: number };
  split?: { type: string; count: number };
  burrow?: { up: number; down: number };
  summon?: { type: string; count: number; cd: number };
  shield?: { radius: number; reduce: number };
  enrage?: { threshold: number; speedMul: number };
  /** Identifiant de l'ennemi en lequel il se transforme à 0 PV (boss à phases). */
  nextPhase?: string;
  /** Attaque de zone sur les soldats. */
  cleave?: number;
  /**
   * Voleur : arrivé à la fraction `at` du chemin, vole `pct` de l'or du joueur le plus riche (au plus `max`)
   * puis repart en arrière, plus vite (`flee`). Tué avant de s'échapper, il rend l'or avec `bonus` en plus.
   */
  thief?: { at: number; pct: number; max: number; flee: number; bonus: number };
}

/**
 * Propriétés qu'une vague peut ajouter à n'importe quel ennemi (champ de bits) :
 * - camouflé : invisible aux tours et aux soldats tant qu'il n'est pas près d'une tour de mages, d'une tour de guet
 *   ou d'un héros ; les explosions et les sorts le touchent quand même ;
 * - cuirassé de plomb : les flèches, les lames et tous les dégâts physiques non explosifs ricochent ;
 * - régénérant : récupère vite ses PV s'il n'a pas été blessé depuis un moment (le poison et le feu l'en empêchent).
 */
export const enum Trait { Camo = 1, Lead = 2, Regrow = 4 }
export const TRAIT_BITS = [1, 2, 4] as const;
export const TRAITS = [
  { id: 'camo', name: 'Camouflé', short: 'Camouflé', desc: 'Invisible aux tours et aux soldats, sauf près d’une tour de mages, d’une tour de guet ou d’un héros. Les explosions et les sorts le touchent quand même.' },
  { id: 'lead', name: 'Cuirassé de plomb', short: 'Plomb', desc: 'Les flèches, les lames et tous les dégâts physiques non explosifs ricochent : seuls la magie, les explosions et les sorts l’entament.' },
  { id: 'regrow', name: 'Régénérant', short: 'Régénérant', desc: 'Récupère 6 % de ses PV par seconde s’il n’a pas été blessé depuis 1,5 s. Le poison et le feu bloquent la régénération.' },
];
/** PV d'un ennemi doté de la propriété (camouflé, plomb, régénérant), en fraction de ses PV normaux. */
export const TRAIT_HP = [0.8, 0.85, 0.75];
export function traitHp(traits: number): number {
  return (traits & 1 ? TRAIT_HP[0] : 1) * (traits & 2 ? TRAIT_HP[1] : 1) * (traits & 4 ? TRAIT_HP[2] : 1);
}
/** Part des dégâts physiques non explosifs qui passe le plomb. */
export const LEAD_PHYS = 0.15;
/** Rayon de détection des camouflés autour d'un héros. */
export const HERO_DETECT = 2.6;
/** Régénération d'un ennemi régénérant (fraction des PV max par seconde) et délai sans blessure. */
export const REGROW_RATE = 0.06;
export const REGROW_DELAY_S = 1.5;

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  biome: Biome;
  hp: number;
  speed: number;
  armor: number;
  mres: number;
  dmg: [number, number];
  atkCd: number;
  bounty: number;
  lives: number;
  threat: number;
  flying?: boolean;
  boss?: boolean;
  /** n'apparaît que par invocation/division */
  spawnOnly?: boolean;
  size: number;
  ab: EnemyAbilities;
}

export const ENEMIES: EnemyDef[] = [
  // --- Vallée d'Aubeclair ---
  { id: 'gobelin', name: 'Gobelin', desc: 'Petit, vert, bruyant. Vient en grand nombre et vole les petites cuillères.', biome: 'vallee', hp: 26, speed: 1.6, armor: 0, mres: 0, dmg: [1, 3], atkCd: 1, bounty: 4, lives: 1, threat: 1, size: 0.75, ab: {} },
  { id: 'loup', name: 'Loup des collines', desc: 'Très rapide. Ne s’arrête que pour mordre des mollets.', biome: 'vallee', hp: 34, speed: 3.0, armor: 0, mres: 0, dmg: [2, 4], atkCd: 1, bounty: 6, lives: 1, threat: 1.7, size: 0.8, ab: {} },
  { id: 'brute', name: 'Brute orque', desc: 'Armure épaisse. Les flèches rebondissent, la magie beaucoup moins.', biome: 'vallee', hp: 170, speed: 1.1, armor: 0.5, mres: 0, dmg: [8, 14], atkCd: 1.2, bounty: 20, lives: 1, threat: 6.5, size: 1.15, ab: {} },
  { id: 'chaman', name: 'Chaman gobelin', desc: 'Soigne ses compagnons en agitant un os de poulet.', biome: 'vallee', hp: 75, speed: 1.4, armor: 0, mres: 0.3, dmg: [2, 4], atkCd: 1, bounty: 14, lives: 1, threat: 4, size: 0.8, ab: { heal: { pct: 0.15, radius: 3, cd: 4 } } },
  { id: 'corbeau', name: 'Corbeau de guerre', desc: 'Vole au-dessus des soldats. Seuls archers, mages et tesla l’atteignent.', biome: 'vallee', hp: 42, speed: 2.0, armor: 0, mres: 0, dmg: [0, 0], atkCd: 1, bounty: 8, lives: 1, threat: 2.2, flying: true, size: 0.8, ab: {} },
  { id: 'bouclier', name: 'Porte-bouclier', desc: 'Protège ses voisins : ils subissent 30 % de dégâts en moins.', biome: 'vallee', hp: 130, speed: 1.2, armor: 0.3, mres: 0, dmg: [4, 8], atkCd: 1, bounty: 16, lives: 1, threat: 5, size: 1, ab: { shield: { radius: 2.5, reduce: 0.3 } } },
  { id: 'chapardeur', name: 'Chapardeur', desc: 'Gobelin filou : il court jusqu’à vos coffres, vole de l’or et repart en sens inverse. Rattrapez-le : il rend tout, avec un bonus.', biome: 'vallee', hp: 70, speed: 2.6, armor: 0, mres: 0.1, dmg: [0, 0], atkCd: 1, bounty: 8, lives: 1, threat: 3, size: 0.8, ab: { thief: { at: 0.62, pct: 0.15, max: 150, flee: 1.25, bonus: 0.5 } } },
  // --- Marais de Brumenoire ---
  { id: 'noye', name: 'Noyé', desc: 'Se régénère en permanence. Sent très fort la vase.', biome: 'marais', hp: 95, speed: 1.3, armor: 0, mres: 0, dmg: [4, 7], atkCd: 1, bounty: 9, lives: 1, threat: 3, size: 0.95, ab: { regen: 3 } },
  { id: 'sorciere', name: 'Sorcière des marais', desc: 'Étourdit vos tours. Résiste fortement à la magie.', biome: 'marais', hp: 115, speed: 1.4, armor: 0, mres: 0.8, dmg: [3, 6], atkCd: 1, bounty: 22, lives: 1, threat: 7, size: 0.9, ab: { stunTowers: { range: 6, cd: 8, dur: 3 } } },
  { id: 'crapaud', name: 'Crapaud-bombe', desc: 'Explose au contact des soldats. Ne pas caresser.', biome: 'marais', hp: 60, speed: 2.2, armor: 0, mres: 0, dmg: [0, 0], atkCd: 1, bounty: 7, lives: 1, threat: 2.5, size: 0.8, ab: { kamikaze: { dmg: 45, radius: 1.6 } } },
  { id: 'limon', name: 'Grand limon', desc: 'Se divise en trois petits limons à sa mort.', biome: 'marais', hp: 190, speed: 1.0, armor: 0, mres: 0.2, dmg: [5, 9], atkCd: 1.2, bounty: 10, lives: 2, threat: 6.5, size: 1.1, ab: { split: { type: 'petitlimon', count: 3 } } },
  { id: 'petitlimon', name: 'Petit limon', desc: 'Le même, en plus petit et en plus agaçant.', biome: 'marais', hp: 48, speed: 1.6, armor: 0, mres: 0.2, dmg: [2, 4], atkCd: 1, bounty: 3, lives: 1, threat: 1.5, spawnOnly: true, size: 0.6, ab: {} },
  { id: 'ver', name: 'Ver des vases', desc: 'Creuse sous terre : invisible et impossible à bloquer par moments.', biome: 'marais', hp: 150, speed: 1.5, armor: 0.2, mres: 0, dmg: [5, 9], atkCd: 1, bounty: 15, lives: 1, threat: 5.5, size: 1, ab: { burrow: { up: 5, down: 3 } } },
  { id: 'chauvesouris', name: 'Chauve-souris porteuse', desc: 'Volante. Largue des noyés sur le chemin.', biome: 'marais', hp: 130, speed: 1.5, armor: 0, mres: 0, dmg: [0, 0], atkCd: 1, bounty: 18, lives: 1, threat: 7, flying: true, size: 1.1, ab: { summon: { type: 'noye', count: 1, cd: 6 } } },
  // --- Terres de Cendre ---
  { id: 'diablotin', name: 'Diablotin', desc: 'Rapide et ricanant. Résiste un peu à la magie.', biome: 'cendre', hp: 72, speed: 2.4, armor: 0, mres: 0.3, dmg: [3, 6], atkCd: 0.8, bounty: 6, lives: 1, threat: 2.2, size: 0.7, ab: {} },
  { id: 'cornu', name: 'Démon cornu', desc: 'Devient enragé et fonce quand il est blessé.', biome: 'cendre', hp: 320, speed: 1.3, armor: 0.3, mres: 0, dmg: [10, 18], atkCd: 1, bounty: 25, lives: 2, threat: 10, size: 1.2, ab: { enrage: { threshold: 0.5, speedMul: 1.8 } } },
  { id: 'golem', name: 'Golem de lave', desc: 'Énorme, lent, quasiment immunisé aux armes. Utilisez la magie !', biome: 'cendre', hp: 760, speed: 0.75, armor: 0.8, mres: 0, dmg: [30, 50], atkCd: 1.6, bounty: 50, lives: 3, threat: 23, size: 1.6, ab: { cleave: 1.5 } },
  { id: 'invocateur', name: 'Invocateur démoniaque', desc: 'Fait apparaître des diablotins en continu.', biome: 'cendre', hp: 230, speed: 1.1, armor: 0, mres: 0.5, dmg: [4, 8], atkCd: 1, bounty: 30, lives: 1, threat: 11, size: 1, ab: { summon: { type: 'diablotin', count: 1, cd: 8 } } },
  { id: 'gargouille', name: 'Gargouille', desc: 'Volante et blindée. Un vrai casse-tête.', biome: 'cendre', hp: 210, speed: 1.6, armor: 0.5, mres: 0, dmg: [0, 0], atkCd: 1, bounty: 22, lives: 1, threat: 8.5, flying: true, size: 1.1, ab: {} },
  { id: 'chevalierinf', name: 'Chevalier infernal', desc: 'Résiste à tout. Il faut juste taper plus fort.', biome: 'cendre', hp: 470, speed: 1.4, armor: 0.5, mres: 0.5, dmg: [14, 24], atkCd: 1, bounty: 40, lives: 2, threat: 17, size: 1.25, ab: {} },
  // --- Boss ---
  { id: 'grolbak', name: 'Grôlbak, chef gobelin', desc: 'Le plus gros des gobelins. Il a mangé les autres chefs.', biome: 'vallee', hp: 2600, speed: 0.85, armor: 0.3, mres: 0, dmg: [50, 80], atkCd: 1.5, bounty: 300, lives: 10, threat: 90, boss: true, size: 2.2, ab: { summon: { type: 'gobelin', count: 3, cd: 8 }, cleave: 2 } },
  { id: 'vasiere', name: 'Mère Vasière', desc: 'Reine du marais. Elle se régénère et paralyse vos défenses.', biome: 'marais', hp: 4000, speed: 0.7, armor: 0, mres: 0.5, dmg: [60, 90], atkCd: 1.6, bounty: 450, lives: 15, threat: 160, boss: true, size: 2.5, ab: { regen: 12, stunTowers: { range: 8, cd: 10, dur: 3 }, summon: { type: 'noye', count: 2, cd: 9 }, cleave: 2 } },
  { id: 'kessin1', name: 'Kessin, le démon', desc: 'Il a enlevé la princesse Ethan. Il le regrettera.', biome: 'cendre', hp: 2600, speed: 0.75, armor: 0.3, mres: 0.3, dmg: [60, 90], atkCd: 1.4, bounty: 300, lives: 20, threat: 150, boss: true, size: 2.4, ab: { summon: { type: 'diablotin', count: 3, cd: 7 }, stunTowers: { range: 7, cd: 9, dur: 2.5 }, nextPhase: 'kessin2', cleave: 2 } },
  { id: 'kessin2', name: 'Kessin ailé', desc: 'Kessin déploie ses ailes. Seules les tours anti-aériennes peuvent l’atteindre.', biome: 'cendre', hp: 2200, speed: 1.2, armor: 0, mres: 0.3, dmg: [0, 0], atkCd: 1, bounty: 300, lives: 20, threat: 120, boss: true, flying: true, spawnOnly: true, size: 2.4, ab: { summon: { type: 'gargouille', count: 1, cd: 6 }, nextPhase: 'kessin3' } },
  { id: 'kessin3', name: 'Kessin, forme véritable', desc: 'Sa forme ultime. Énorme, enragé, et franchement de mauvaise humeur.', biome: 'cendre', hp: 4000, speed: 0.7, armor: 0.5, mres: 0.3, dmg: [90, 130], atkCd: 1.4, bounty: 800, lives: 20, threat: 220, boss: true, spawnOnly: true, size: 3, ab: { enrage: { threshold: 0.4, speedMul: 1.6 }, summon: { type: 'cornu', count: 1, cd: 10 }, cleave: 2.5 } },
];

// Économie cohérente entre biomes : la prime suit la menace (hors boss).
for (const e of ENEMIES) if (!e.boss) e.bounty = Math.max(3, Math.round(e.threat * 3.6));

export const ENEMY_INDEX: Record<string, number> = Object.fromEntries(ENEMIES.map((e, i) => [e.id, i]));
export function enemyDef(id: string): EnemyDef {
  const i = ENEMY_INDEX[id];
  if (i === undefined) throw new Error('Ennemi inconnu : ' + id);
  return ENEMIES[i];
}

/** Phase d'un boss (0 = la première) et nombre de phases de sa chaîne de transformations. */
export function bossPhase(type: number): { phase: number; phases: number } {
  const id = ENEMIES[type]?.id;
  let root = type;
  for (let guard = 0; guard < 8; guard++) {
    const prev = ENEMIES.findIndex((d) => d.ab.nextPhase === ENEMIES[root].id);
    if (prev < 0) break;
    root = prev;
  }
  let phase = 0, phases = 0;
  for (let t = root, guard = 0; t >= 0 && guard < 8; guard++) {
    if (ENEMIES[t].id === id) phase = phases;
    phases++;
    const n = ENEMIES[t].ab.nextPhase;
    t = n ? ENEMY_INDEX[n] : -1;
  }
  return { phase, phases };
}
