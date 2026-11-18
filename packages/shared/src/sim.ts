import { BALANCE, computeScaling, earlyCallBonus, starsFor, type Scaling } from './balance';
import { DT, SELL_RATIO, TICK_RATE, UNDO_SELL_S, sec } from './constants';
import { ENEMIES, ENEMY_INDEX, HERO_DETECT, LEAD_PHYS, REGROW_DELAY_S, REGROW_RATE, Trait, traitHp, type EnemyDef } from './data/enemies';
import { CAMP_CD_S, MERC, POUDRE_DMG, POUDRE_R, PROP_INFO, PropKind, SECRETS } from './data/props';
import { ITEMS, ITEM_COOLDOWN_S, ITEM_MAX, Item, RENFORT_COUNT, RENFORT_DUR_S, RENFORT_TIERS, perksOf, type Perks } from './data/meta';
import { HEROES, HERO_EXTRA_HOLD, HERO_MAX_LEVEL, HERO_RESPAWN_S, HERO_XP, SPELLS, sanitizeSpells, type HeroDef } from './data/heroes';
import { AVENTURIER, SKILL_UNLOCK, buildKit, classOf, heroPassives, heroSkills, heroStatBonus, sanitizeBuild, type ClassDef, type ClassSkill, type HeroBuild, type StatKind } from './data/classes';
import { LEVELS, SURVIVAL_START_GOLD, type LevelDef } from './data/levels';
import { LEVEL_SPEC_A, PROJ_KINDS, SoldierKind, TOWERS, campAura, mineIncome, type TowerLevel } from './data/towers';
import { buildRuntimeMap, type RuntimeMap } from './mapgen';
import { activePathsFor, scaledCount } from './preview';
import { Rng } from './rng';
import { DmgType, FAMILIES, GameState, Prio, SHOOTERS, type Command, type Family, type GameConfig } from './types';
import { MUTATION_INDEX, genStoryWaves, genSurvivalWave, mutationsFor, weatherFor, type Wave } from './waves';

// ---------------------------------------------------------------- Événements

export const enum Ev {
  Fire = 1, // kind, srcType, srcId, targetId, tx, tz, flight
  Impact = 2, // kind, x, z, radius*10
  Death = 3, // enemyId, type, x, z
  Leak = 4, // enemyId, lives
  Build = 5, // towerId, slot
  Sell = 6, // slot, owner
  Upgrade = 7, // towerId, payeur, propriétaire
  Spell = 8, // emplacement, joueur, x, z, sort (index de SPELLS)
  HeroSkill = 9, // owner, skill, x, z, x2, z2
  Dmg = 10, // enemyId, amount, flags (1 crit, 2 instakill)
  WaveStart = 11, // wave, boss, mutation (255 = aucune)
  LevelUp = 12, // owner, level
  Stun = 13, // towerId, ticks
  Teleport = 14, // enemyId, x, z
  BossPhase = 15, // enemyId, newType
  UnitDeath = 16, // x, z
  Heal = 17, // x, z
  Chain = 18, // towerId, n, x0, z0, x1, z1, ...
  Gift = 19, // from, to, amount
  Spawn = 20, // enemyId, x, z
  HeroDeath = 21, // owner
  GameEnd = 22, // won
  Skill = 23, // towerId, skillIndex (déclenchement de compétence de tour)
  Item = 24, // owner, objet, x, z (objet de boutique utilisé)
  Income = 25, // towerId, or, vies (revenu d'une mine au début d'une vague)
  Steal = 26, // enemyId, victime, or (un chapardeur vole de l'or et s'enfuit)
  Recover = 27, // victime, or rendu (bonus compris), x, z (chapardeur rattrapé)
  Escape = 28, // enemyId, victime, or (chapardeur enfui avec son butin)
  Adapt = 29, // type de dégâts appris (0 physique, 1 magie), résistance (%)
  Prop = 30, // élément de carte, joueur, état (tonneau : 1 ; secret : clics, 255 trouvé), valeur (touchés, or)
}

export const enum Impact {
  Shell = 0, FireShell = 1, Meteor = 2, Frost = 3, Arcane = 4, Kamikaze = 5, Hammer = 6, Holy = 7,
  Drain = 8, Lava = 9, ArrowRain = 10, Dawn = 11, Charge = 12, Summon = 13, Turret = 14, Bolt = 15,
  Arrow = 16, Frag = 17, Teleport = 18, Rally = 19,
  // zones durables des compétences de route : rayon ×10 + durée (s) ×1000
  Cyclone = 20, Blizzard = 21, Plague = 22, Trap = 23, Net = 24, Curse = 25, Quake = 26, Wave = 27, Sanctuary = 28, Blades = 29,
}

/** Types de tirs (Fire.kind) : indices de PROJ_KINDS puis extras. */
export const FIRE_HERO_ARROW = 8;
export const FIRE_HERO_BOLT = 9;
export const FIRE_TURRET = 10;
export const FIRE_METEOR = 11;
export const FIRE_FRAG = 12;
export const FIRE_SKULL = 13;

export const enum Src { Tower = 0, Hero = 1, Unit = 2, Sky = 3 }

// ---------------------------------------------------------------- Entités

export interface Enemy {
  id: number;
  type: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  hpScale: number;
  path: number;
  dist: number;
  lane: number;
  x: number;
  z: number;
  armor: number;
  mres: number;
  slowMul: number;
  slowT: number;
  stunT: number;
  poisonDps: number;
  poisonT: number;
  burnDps: number;
  burnT: number;
  shred: number;
  shredT: number;
  /** malédiction : dégâts subis en plus (Prison du temps, Malédiction) */
  curse: number;
  curseT: number;
  blockers: Unit[];
  fighting: boolean;
  atkT: number;
  abT: number;
  ab2T: number;
  ab3T: number;
  burrowed: boolean;
  burrowT: number;
  flying: boolean;
  shielded: boolean;
  dead: boolean;
  hitBy: number; // dernier joueur à l'avoir touché
  /** propriétés de vague (voir Trait) */
  traits: number;
  /** camouflé repéré ce tick (mage, tour de guet ou héros proche) */
  revealed: boolean;
  /** ticks restants avant que la régénération (propriété) reprenne */
  quietT: number;
  /** dégâts subis en plus (Marquage d'une tour de guet) */
  marked: number;
  /** chapardeur : or volé, joueur volé, en fuite (il remonte le chemin) */
  loot: number;
  victim: number;
  fleeing: boolean;
}

export interface Unit {
  id: number;
  kind: number; // SoldierKind ou HERO_UNIT
  owner: number;
  tower: Tower | null;
  hero: Hero | null;
  idx: number;
  x: number;
  z: number;
  hx: number;
  hz: number;
  hp: number;
  maxHp: number;
  armor: number;
  dmgMin: number;
  dmgMax: number;
  cdTicks: number;
  cdT: number;
  regen: number;
  speed: number;
  target: Enemy | null;
  /** cible imposée par le joueur (héros) : poursuivie jusqu'à sa mort ou un nouvel ordre */
  focus: Enemy | null;
  extra: Enemy[];
  dead: boolean;
  respawnT: number;
  life: number;
  buffT: number;
  shield: number;
  range: number;
  rangedType: DmgType;
  moving: boolean;
  fighting: boolean;
}

export const HERO_UNIT = 100;

export interface Tower {
  id: number;
  slot: number;
  owner: number;
  fam: Family;
  fi: number;
  level: number;
  sk: [number, number];
  cdT: number;
  burstLeft: number;
  burstT: number;
  stunT: number;
  aim: Enemy | null;
  rallyX: number;
  rallyZ: number;
  units: Unit[];
  invested: number;
  /** or payé par chaque joueur (id → montant) : remboursé à chacun pendant la préparation */
  paid: Record<number, number>;
  lastBuy: number;
  /** joueur qui a payé le dernier achat (le remboursement intégral ne vaut que pour ses propres achats) */
  lastBuyer: number;
  s1T: number;
  s2T: number;
  x: number;
  z: number;
  /** priorité de ciblage (voir Prio) */
  prio: number;
  /** bonus du meilleur campement voisin (recalculés à chaque tick) */
  auraRange: number;
  auraRate: number;
  auraDmg: number;
}

export type HeroBase = Pick<ClassDef, 'hp' | 'hpPerLevel' | 'dmg' | 'dmgPerLevel' | 'dmgType' | 'cooldown' | 'armor' | 'speed' | 'regen' | 'range'>;

export interface Hero {
  owner: number;
  /** apparence */
  def: HeroDef;
  /** classe (null : Aventurier, sans vocation) */
  cls: ClassDef | null;
  /** statistiques de base (classe ou Aventurier) */
  base: HeroBase;
  build: HeroBuild;
  /** compétences apprises (octet de l'instantané) */
  kit: number;
  /** bonus des nœuds de statistiques */
  bonus: Record<StatKind, number>;
  skills: (ClassSkill | null)[];
  /** passifs acquis */
  pas: Set<string>;
  u: Unit;
  level: number;
  xp: number;
  cds: [number, number, number];
}

interface Proj {
  kind: number;
  tower: Tower | null;
  owner: number;
  target: Enemy | null;
  tx: number;
  tz: number;
  t: number;
  dmg: number;
  dtype: DmgType;
  splash: number;
  air: boolean;
  slowF: number;
  slowT: number;
  poison: number;
  burn: number;
  burnT: number;
  shred: number;
  mortel: number;
  heroXp: Hero | null;
}

interface Zone {
  kind: number;
  x: number;
  z: number;
  r: number;
  t: number;
  dps: number;
  dtype: DmgType;
  owner: number;
  air: boolean;
  slow: number;
}

interface SpawnEntry {
  tick: number;
  type: number;
  path: number;
  hpMul: number;
  lane: number;
  traits: number;
}

export interface PlayerState {
  id: number;
  name: string;
  gold: number;
  active: boolean;
  connected: boolean;
  speedVote: 1 | 2;
  spellCd: [number, number];
  /** sorts généraux emportés (index de SPELLS) : emplacement 0 et 1 */
  spells: [number, number];
  kills: number;
  damage: number;
  goldEarned: number;
  /** objets de boutique restants (stock par objet) */
  items: number[];
  /** délai avant le prochain objet (ticks) */
  itemCd: number;
}

/** Météo : dégâts du feu sous la pluie, bonus du givre sous la pluie, portée des archers la nuit, rayon d'une torche. */
/** secret trouvé (état d'un élément de carte) */
export const PROP_FOUND = 255;
export const RAIN_FIRE = 0.5;
export const RAIN_FROST = 1.3;
export const NIGHT_RANGE = 0.78;
export const TORCH_R = 3.4;

/** Kessin s'adapte : premier niveau d'histoire concerné (terres de Cendre), première vague en survie, seuil, pas, plafond, oubli. */
export const ADAPT_LEVEL = 5;
export const ADAPT_FROM = 6;
export const ADAPT_SHARE = 0.58;
export const ADAPT_STEP = 0.05;
export const ADAPT_MAX = 0.2;
export const ADAPT_DECAY = 0.05;
/** part de la résistance apprise qui devient une faiblesse face à l'autre type de dégâts */
export const ADAPT_WEAK = 0.5;

const SOLDIER_SPEED = 2.6;
const FORMATION: [number, number][] = [[0, -0.75], [0.7, 0.45], [-0.7, 0.45], [0, 1.1], [1.2, -0.4], [-1.2, -0.4]];


const tmp = { x: 0, z: 0 };

function clampNum(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------- Simulation

export class Sim {
  readonly cfg: GameConfig;
  readonly map: RuntimeMap;
  readonly rng: Rng;
  readonly level: LevelDef | null;
  scaling: Scaling;
  tick = 0;
  state: GameState = GameState.Waiting;
  lives: number;
  maxLives: number;
  waveIdx = 0;
  totalWaves: number;
  nextWaveT = -1;
  mutations: number[] = [];
  /**
   * Kessin s'adapte : résistance acquise par les ennemis aux dégâts physiques [0] et magiques [1],
   * selon le type le plus utilisé à la vague précédente. `adaptDmg` : dégâts de la vague en cours par type.
   */
  adapt: [number, number] = [0, 0];
  /** météo de la vague en cours (voir weatherFor) */
  rain = false;
  night = false;
  adaptDmg: [number, number] = [0, 0];
  /**
   * Carte interactive, par élément de map.props : rechargement (ticks) et état — tonneau : 1 déjà sauté ; secret : clics reçus, PROP_FOUND une fois trouvé.
   */
  propCd: number[];
  propState: number[];
  players: PlayerState[];
  towers: Tower[] = [];
  towerBySlot: (Tower | null)[];
  enemies: Enemy[] = [];
  units: Unit[] = [];
  heroes: Hero[] = [];
  projs: Proj[] = [];
  zones: Zone[] = [];
  /** bénédictions actives : bonus de cadence et de dégâts aux tours de la zone */
  blessings: { x: number; z: number; r: number; t: number; rate: number; dmg: number }[] = [];
  private inCombustion = false;
  spawnQ: SpawnEntry[] = [];
  events: number[][] = [];
  private storyWaves: Wave[] = [];
  private nextId = 1;
  private waveSpawning = false;
  /** bonus de l'arbre de compétences, par joueur */
  private perkMap = new Map<number, Perks>();
  private static NO_PERKS = perksOf(undefined);

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    const n = cfg.players.length;
    this.map = buildRuntimeMap(cfg.mapId, n);
    this.level = cfg.mode === 'story' ? LEVELS.find((l) => l.mapId === cfg.mapId) ?? null : null;
    this.scaling = computeScaling(n, cfg.difficulty, this.level?.multiK ?? 1);
    if (this.level) {
      this.storyWaves = genStoryWaves(this.level, this.map.paths.length);
      this.totalWaves = this.storyWaves.length;
    } else this.totalWaves = 0;
    for (const p of cfg.players) this.perkMap.set(p.id, perksOf(p.tree));
    this.lives = this.maxLives = this.scaling.lives;
    // remparts : vies en plus (le meilleur bonus de l'équipe), sauf en mode à vie unique
    if (this.maxLives > 1) {
      const extra = Math.max(0, ...cfg.players.map((p) => this.perk(p.id).lives));
      this.lives = this.maxLives = this.maxLives + extra;
    }
    this.towerBySlot = this.map.slots.map(() => null);
    this.propCd = this.map.props.map(() => 0);
    this.propState = this.map.props.map(() => 0);
    const startGold = Math.round((this.level ? this.level.startGold : SURVIVAL_START_GOLD) * this.scaling.startGoldMul);
    this.players = cfg.players.map((p) => ({
      id: p.id, name: p.name, gold: startGold + this.perk(p.id).gold, active: true, connected: true, speedVote: 1 as 1 | 2,
      spellCd: [0, 0] as [number, number], spells: sanitizeSpells(p.spells), kills: 0, damage: 0, goldEarned: 0,
      items: ITEMS.map((_, i) => Math.max(0, Math.min(ITEM_MAX, Math.floor(Number(p.items?.[i] ?? 0))) || 0)), itemCd: 0,
    }));
    const sp = this.map.heroSpawn;
    cfg.players.forEach((p, i) => {
      const def = HEROES[p.hero] ?? HEROES.samuel;
      const build = sanitizeBuild(p.build);
      const cls = classOf(build);
      const base: HeroBase = cls ?? AVENTURIER;
      const pas = new Set(heroPassives(build));
      const bonus = heroStatBonus(build);
      const armor = Math.min(0.75, base.armor + bonus.armor + (pas.has('enclume') ? 0.15 : 0));
      const regen = base.regen * (1 + bonus.regen) * (pas.has('enclume') ? 1.6 : 1);
      const ox = (i % 2 === 0 ? -1 : 1) * 0.9 * (i < 2 ? 1 : 2);
      const u = this.newUnit(HERO_UNIT, p.id, sp.x + ox, sp.z + (i >= 2 ? 1 : 0), base.hp, base.dmg[0], base.dmg[1], armor, base.cooldown / (1 + bonus.rate), regen, null, -1);
      u.speed = base.speed * (1 + bonus.speed);
      u.range = base.range > 0 ? base.range + bonus.range + (pas.has('portee') ? 1.5 : 0) : 0;
      u.rangedType = base.dmgType;
      const h: Hero = { owner: p.id, def, cls, base, build, kit: buildKit(build), bonus, skills: heroSkills(build), pas, u, level: 1, xp: 0, cds: [0, 0, 0] };
      u.hero = h;
      this.heroStats(h);
      u.hp = u.maxHp;
      this.heroes.push(h);
    });
  }

  // ------------------------------------------------------------ collisions des unités

  /** obstacles fixes (mares, décor solide) : x, z, rayon (marge du corps comprise) */
  private solidsCache: number[] | null = null;
  private tmpGoal = { x: 0, z: 0 };
  private solids(): number[] {
    if (!this.solidsCache) {
      const c: number[] = [];
      for (const [px, pz, r] of this.map.def.pools ?? []) c.push(px, pz, r + 0.3);
      for (const o of this.map.obstacles) c.push(o.x, o.z, o.r + 0.28);
      for (const p of this.map.props) c.push(p.x, p.z, (p.kind === PropKind.Camp ? 1.1 : 0.4) + 0.28);
      this.solidsCache = c;
    }
    return this.solidsCache;
  }

  /** Appelle f(x, z, r) pour chaque obstacle : fixes, puis tours construites. */
  private eachSolid(f: (cx: number, cz: number, r: number) => void) {
    const c = this.solids();
    for (let i = 0; i < c.length; i += 3) f(c[i], c[i + 1], c[i + 2]);
    for (const t of this.towers) f(t.x, t.z, 1.05);
  }

  /** Ramène un point hors des obstacles (sur leur bord) ; renvoie vrai s'il a bougé. */
  private pushOut(p: { x: number; z: number }) {
    let moved = false;
    for (let pass = 0; pass < 2; pass++) {
      this.eachSolid((cx, cz, r) => {
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        const d = Math.sqrt(d2);
        if (d < 1e-4) { p.x = cx + r; moved = true; return; }
        p.x = cx + (dx / d) * (r + 0.01);
        p.z = cz + (dz / d) * (r + 0.01);
        moved = true;
      });
    }
    return moved;
  }

  /**
   * Point de pose d'une invocation (tourelle, squelette, piège, renforts) : hors des obstacles,
   * des tours et des emplacements, avec une marge `r` (l'encombrement de l'objet posé).
   * Un point tombé dans un bâtiment est ramené juste à côté.
   */
  placeOut(p: { x: number; z: number }, r = 0.55) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      const out = (cx: number, cz: number, rr: number) => {
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) return;
        const d = Math.sqrt(d2);
        if (d < 1e-4) { p.z = cz + rr; moved = true; return; }
        p.x = cx + (dx / d) * (rr + 0.01);
        p.z = cz + (dz / d) * (rr + 0.01);
        moved = true;
      };
      const c = this.solids();
      for (let i = 0; i < c.length; i += 3) out(c[i], c[i + 1], c[i + 2] + r);
      for (const sl of this.map.slots) out(sl.x, sl.z, 1.05 + r);
      if (!moved) break;
    }
    return p;
  }

  /**
   * Pas de déplacement d'une unité vers (gx, gz) en contournant les obstacles :
   * si un obstacle barre la route dans le pas suivant, on longe son bord du côté le plus proche de la direction voulue.
   */
  private walk(u: Unit, gx: number, gz: number, step: number): boolean {
    let dx = gx - u.x, dz = gz - u.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= step) {
      u.x = gx; u.z = gz;
      this.pushOut(u);
      return true;
    }
    dx /= d; dz /= d;
    // obstacle le plus proche devant, à portée d'un pas et demi
    let bx = 0, bz = 0, br = 0, bp = Infinity;
    this.eachSolid((cx, cz, r) => {
      const vx = cx - u.x, vz = cz - u.z;
      const proj = vx * dx + vz * dz;
      if (proj <= 0 || proj > r + step * 1.5 + 0.3 || proj > d + r) return;
      const perp = vx * dz - vz * dx;
      if (perp * perp >= r * r || proj >= bp) return;
      bp = proj; bx = cx; bz = cz; br = r;
    });
    if (bp < Infinity) {
      const vx = bx - u.x, vz = bz - u.z, vl = Math.sqrt(vx * vx + vz * vz) || 1;
      // deux tangentes possibles : on garde celle qui suit le mieux la direction voulue
      let tx = -vz / vl, tz = vx / vl;
      if (tx * dx + tz * dz < 0 || (tx * dx + tz * dz === 0 && vx * dz - vz * dx > 0)) { tx = -tx; tz = -tz; }
      dx = tx; dz = tz;
    }
    u.x += dx * step;
    u.z += dz * step;
    this.pushOut(u);
    return false;
  }

  // ------------------------------------------------------------ utilitaires

  private ev(...a: number[]) {
    this.events.push(a);
  }

  player(id: number): PlayerState | undefined {
    return this.players.find((p) => p.id === id);
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.players) if (p.active) n++;
    return Math.max(1, n);
  }

  get speed(): 1 | 2 {
    let any = false;
    for (const p of this.players) {
      if (!p.active || !p.connected) continue;
      any = true;
      if (p.speedVote !== 2) return 1;
    }
    return any ? 2 : 1;
  }

  get stars(): number {
    return starsFor(this.lives, this.maxLives);
  }

  /** Vagues complètement survécues (score de survie). */
  get wavesSurvived(): number {
    if (this.state === GameState.Lost) return Math.max(0, this.waveIdx - 1);
    return this.waveIdx;
  }

  private newUnit(kind: number, owner: number, x: number, z: number, hp: number, dmin: number, dmax: number, armor: number, cd: number, regen: number, tower: Tower | null, life: number): Unit {
    const u: Unit = {
      id: this.nextId++, kind, owner, tower, hero: null, idx: 0, x, z, hx: x, hz: z, hp, maxHp: hp, armor,
      dmgMin: dmin, dmgMax: dmax, cdTicks: Math.max(1, sec(cd)), cdT: 0, regen, speed: SOLDIER_SPEED,
      target: null, focus: null, extra: [], dead: false, respawnT: 0, life, buffT: 0, shield: 0, range: 0, rangedType: DmgType.Phys,
      moving: false, fighting: false,
    };
    this.units.push(u);
    return u;
  }

  private release(u: Unit) {
    if (u.target) {
      const b = u.target.blockers;
      const i = b.indexOf(u);
      if (i >= 0) b.splice(i, 1);
      u.target = null;
    }
    for (const e of u.extra) {
      const i = e.blockers.indexOf(u);
      if (i >= 0) e.blockers.splice(i, 1);
    }
    u.extra.length = 0;
    u.fighting = false;
  }

  private engage(u: Unit, e: Enemy) {
    u.target = e;
    e.blockers.push(u);
  }

  private pathOf(e: Enemy) {
    return this.map.paths[e.path];
  }

  private remaining(e: Enemy) {
    // un chapardeur en fuite « fuit » vers l'entrée : il est d'autant plus urgent qu'il en est proche
    if (e.fleeing) return e.dist;
    return this.pathOf(e).length - e.dist;
  }

  /** Atteignable par une zone (explosion, sort) : les camouflés compris. */
  private targetable(e: Enemy, air: boolean) {
    return !e.dead && !e.burrowed && (air || !e.flying) && e.dist > 0.5;
  }

  /** Visible pour un tir ou un soldat : un camouflé doit être repéré. */
  visible(e: Enemy) {
    return !(e.traits & Trait.Camo) || e.revealed;
  }

  /** Cible d'un tir dans le rayon selon la priorité (par défaut : l'ennemi le plus avancé). */
  private findTarget(x: number, z: number, r: number, air: boolean, exclude?: Enemy | null, prio: number = Prio.First): Enemy | null {
    const r2 = r * r;
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e === exclude || !this.targetable(e, air) || !this.visible(e)) continue;
      const dx = e.x - x, dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const rem = this.remaining(e);
      // départage : à score égal, le plus avancé
      const score = prio === Prio.Last ? -rem : prio === Prio.Strong ? -e.hp * 1000 + rem * 1e-3 : prio === Prio.Close ? d2 + rem * 1e-4 : rem;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  private enemiesIn(x: number, z: number, r: number, air: boolean, out: Enemy[] = []): Enemy[] {
    const r2 = r * r;
    out.length = 0;
    for (const e of this.enemies) {
      if (!this.targetable(e, air)) continue;
      const dx = e.x - x, dz = e.z - z;
      if (dx * dx + dz * dz <= r2) out.push(e);
    }
    return out;
  }

  private rollDmg(min: number, max: number) {
    return min + (max - min) * this.rng.next();
  }

  // ------------------------------------------------------------ dégâts

  /**
   * Inflige des dégâts. `explosive` : dégâts de zone d'une explosion (ils entament le plomb).
   * Renvoie les dégâts réellement infligés.
   */
  damage(e: Enemy, amount: number, type: DmgType, owner: number, hero: Hero | null, flags = 0, silent = false, explosive = false): number {
    if (e.dead || amount <= 0) return 0;
    let mult = 1 + e.marked;
    // plomb : les coups physiques non explosifs ricochent presque entièrement (drapeau 4 : étincelle côté client)
    if (type === DmgType.Phys && !explosive && e.traits & Trait.Lead) { mult *= LEAD_PHYS; flags |= 4; }
    if (type === DmgType.Phys) mult *= 1 - Math.max(0, Math.min(0.9, e.armor - e.shred));
    else if (type === DmgType.Magic) mult *= 1 - Math.min(0.9, e.mres);
    if (e.shielded) mult *= 0.7;
    // Kessin s'adapte : résistance au type appris, mais une brèche face à l'autre (varier paie)
    if (type !== DmgType.True) mult *= 1 - this.adapt[type] + ADAPT_WEAK * this.adapt[1 - type];
    const d = amount * mult;
    e.hp -= d;
    if (e.traits & Trait.Regrow) e.quietT = sec(REGROW_DELAY_S);
    if (owner >= 0) {
      e.hitBy = owner;
      const p = this.player(owner);
      if (p) p.damage += d;
      if (type !== DmgType.True) this.adaptDmg[type] += amount;
    }
    if (!silent) this.ev(Ev.Dmg, e.id, Math.min(65535, Math.round(d)), flags);
    if (e.hp <= 0) this.kill(e, owner, hero);
    return d;
  }

  private kill(e: Enemy, owner: number, hero: Hero | null) {
    const def = e.def;
    this.giveBounty(def.bounty, owner >= 0 ? owner : e.hitBy);
    this.giveXp(e, def.bounty, hero);
    if (def.ab.nextPhase) {
      const nt = ENEMY_INDEX[def.ab.nextPhase];
      const nd = ENEMIES[nt];
      e.type = nt;
      e.def = nd;
      e.maxHp = e.hp = nd.hp * e.hpScale;
      e.armor = nd.armor;
      e.mres = nd.mres;
      e.flying = !!nd.flying;
      e.abT = sec(3);
      e.ab2T = sec(4);
      for (const u of [...e.blockers]) this.release(u);
      this.ev(Ev.Teleport, e.id, e.x, e.z);
      // en se transformant, le boss recule sur le chemin : le combat se joue en plusieurs temps ;
      // sur une carte à plusieurs chemins, il change d'arène et surgit sur un autre chemin
      const old = this.pathOf(e);
      const back = Math.max(0.6, e.dist - 18);
      if (this.map.paths.length > 1) {
        e.path = (e.path + 1) % this.map.paths.length;
        const np = this.pathOf(e);
        e.dist = Math.max(0.6, Math.min(np.length * 0.5, (back / old.length) * np.length));
      } else e.dist = back;
      this.pathOf(e).at(e.dist, e.lane, tmp);
      e.x = tmp.x;
      e.z = tmp.z;
      this.ev(Ev.BossPhase, e.id, nt);
      // il appelle sa garde autour de lui
      const sm = def.ab.summon;
      if (sm) {
        const st = ENEMY_INDEX[sm.type];
        for (let k = 0; k < sm.count * 2; k++) {
          const c = this.spawnEnemy(st, e.path, this.scaling.hpMul, (this.rng.next() * 2 - 1) * 0.8, Math.max(0.6, e.dist - 0.4 - k * 0.6));
          c.dist = Math.max(0.6, e.dist - 0.4 - k * 0.6);
        }
      }
      return;
    }
    e.dead = true;
    if (owner >= 0) {
      const p = this.player(owner);
      if (p) p.kills++;
    }
    // chapardeur rattrapé : l'or volé revient à sa victime, avec un bonus
    if (e.fleeing && def.ab.thief) {
      const v = this.player(e.victim);
      const back = Math.round(e.loot * (1 + def.ab.thief.bonus));
      if (v && back > 0) { v.gold += back; v.goldEarned += back - e.loot; }
      this.ev(Ev.Recover, e.victim < 0 ? 255 : e.victim, back, e.x, e.z);
      e.loot = 0;
    }
    if (hero && hero.pas.has('moisson') && !hero.u.dead) hero.u.hp = Math.min(hero.u.maxHp, hero.u.hp + hero.u.maxHp * 0.06);
    // Combustion : l'ennemi tué explose (les voisins tués n'explosent pas à leur tour)
    if (hero && hero.pas.has('combustion') && !this.inCombustion) {
      this.inCombustion = true;
      for (const o of this.enemiesIn(e.x, e.z, 1.8, true, [])) if (o !== e) this.damage(o, (18 + 4 * hero.level) * (1 + hero.bonus.skill), DmgType.Magic, hero.owner, hero, 0, false, true);
      this.inCombustion = false;
      this.ev(Ev.Impact, Impact.FireShell, e.x, e.z, 18);
    }
    this.ev(Ev.Death, e.id, e.type, e.x, e.z);
    if (def.ab.split) {
      const st = ENEMY_INDEX[def.ab.split.type];
      for (let i = 0; i < def.ab.split.count; i++) {
        const c = this.spawnEnemy(st, e.path, e.hpScale / traitHp(e.traits), (i - 1) * 0.5, e.dist - i * 0.4, e.traits);
        c.dist = Math.max(0.6, e.dist - i * 0.4);
      }
    }
    for (const u of [...e.blockers]) this.release(u);
  }

  private giveBounty(base: number, _owner: number) {
    let mul = this.scaling.bountyMul;
    if (this.mutations.includes(MUTATION_INDEX.riches)) mul *= 1.3;
    const g = base * mul;
    for (const p of this.players) if (p.active) { p.gold += g; p.goldEarned += g; }
  }

  private giveXp(e: Enemy, bounty: number, killer: Hero | null) {
    for (const h of this.heroes) {
      if (h.level >= HERO_MAX_LEVEL) continue;
      let xp = 0;
      if (h === killer) xp = bounty * 1.2;
      else {
        const dx = h.u.x - e.x, dz = h.u.z - e.z;
        if (dx * dx + dz * dz < 81) xp = bounty * 0.6;
        else xp = bounty * 0.1;
      }
      this.addXp(h, xp);
    }
  }

  /** Bonus de l'arbre de compétences d'un joueur. */
  perk(pid: number): Perks {
    return this.perkMap.get(pid) ?? Sim.NO_PERKS;
  }

  /** Points de vie et dégâts du héros selon son niveau et les bonus de son joueur. */
  private heroStats(h: Hero) {
    const d = h.base;
    const hpMul = 1 + h.bonus.hp;
    const dmgMul = 1 + h.bonus.dmg;
    h.u.maxHp = Math.round((d.hp + d.hpPerLevel * (h.level - 1)) * hpMul);
    h.u.dmgMin = (d.dmg[0] + d.dmgPerLevel * (h.level - 1)) * dmgMul;
    h.u.dmgMax = (d.dmg[1] + d.dmgPerLevel * (h.level - 1)) * dmgMul;
  }

  private addXp(h: Hero, xp: number) {
    h.xp += xp * (1 + h.bonus.xp);
    while (h.level < HERO_MAX_LEVEL && h.xp >= HERO_XP[h.level]) {
      h.level++;
      this.heroStats(h);
      h.u.hp = h.u.maxHp;
      this.ev(Ev.LevelUp, h.owner, h.level);
    }
  }

  // ------------------------------------------------------------ apparition

  private spawnEnemy(type: number, path: number, hpScale: number, lane: number, dist = 0, traits = 0): Enemy {
    const def = ENEMIES[type];
    if (def.boss) traits = 0;
    // une propriété se paie en PV : la difficulté vient de la tour qu'il faut, pas de la masse à abattre
    hpScale *= traitHp(traits);
    const e: Enemy = {
      id: this.nextId++, type, def, hp: def.hp * hpScale, maxHp: def.hp * hpScale, hpScale, path, dist, lane,
      x: 0, z: 0, armor: def.armor, mres: def.mres, slowMul: 1, slowT: 0, stunT: 0, poisonDps: 0, poisonT: 0,
      burnDps: 0, burnT: 0, shred: 0, shredT: 0, curse: 0, curseT: 0, blockers: [], fighting: false, atkT: 0,
      abT: sec(2 + this.rng.next() * 2), ab2T: sec(3 + this.rng.next() * 3), ab3T: sec(4), burrowed: false,
      burrowT: def.ab.burrow ? sec(def.ab.burrow.up) : 0, flying: !!def.flying, shielded: false, dead: false, hitBy: -1,
      traits, revealed: false, quietT: 0, marked: 0, loot: 0, victim: -1, fleeing: false,
    };
    if (this.mutations.includes(MUTATION_INDEX.blindes)) e.armor = Math.min(0.9, e.armor + 0.25);
    if (this.mutations.includes(MUTATION_INDEX.resistants)) e.mres = Math.min(0.9, e.mres + 0.25);
    this.map.paths[path].at(dist, lane, tmp);
    e.x = tmp.x;
    e.z = tmp.z;
    this.enemies.push(e);
    if (dist > 0) this.ev(Ev.Spawn, e.id, e.x, e.z);
    return e;
  }

  private activePaths(wave: number): number[] {
    return activePathsFor(this.map.def.pathFrom, this.map.paths.length, wave);
  }

  private startWave() {
    if (this.level && this.waveIdx >= this.totalWaves) return;
    this.waveIdx++;
    const n = this.activeCount;
    this.scaling = computeScaling(n, this.cfg.difficulty, this.level?.multiK ?? 1);
    let wave: Wave;
    if (this.level) wave = this.storyWaves[this.waveIdx - 1];
    else {
      this.mutations = mutationsFor(this.cfg.seed, this.waveIdx);
      wave = genSurvivalWave(this.map.def.biome, this.cfg.seed, this.waveIdx, this.activePaths(this.waveIdx));
    }
    this.adaptWave();
    const wx = weatherFor(this.map.def.biome, this.cfg.seed, this.waveIdx);
    this.rain = wx.rain;
    this.night = wx.night;
    const cm = this.scaling.countMul;
    for (const g of wave.groups) {
      const def = ENEMIES[g.type];
      const count = scaledCount(g.type, g.count, cm);
      const interval = g.interval / (1 + 0.5 * (cm - 1));
      const hpMul = (def.boss ? this.scaling.bossHpMul : this.scaling.hpMul) * (g.hpMul ?? 1);
      for (let i = 0; i < count; i++) {
        this.spawnQ.push({
          tick: this.tick + sec(g.delay + i * interval), type: g.type, path: Math.min(g.path, this.map.paths.length - 1),
          hpMul, lane: def.boss ? 0 : (this.rng.next() * 2 - 1) * 0.7, traits: g.traits ?? 0,
        });
      }
    }
    this.spawnQ.sort((a, b) => a.tick - b.tick);
    this.waveSpawning = true;
    this.nextWaveT = -1;
    this.state = GameState.Running;
    for (const h of this.heroes) this.addXp(h, 6 * this.waveIdx);
    this.ev(Ev.WaveStart, this.waveIdx, wave.boss ? 1 : 0, wave.mutation ?? 255);
    this.payMines();
  }

  /** Point éclairé la nuit : près d'une torche de la carte ou d'un campement. */
  lit(x: number, z: number): boolean {
    const r2 = TORCH_R * TORCH_R;
    for (const t of this.map.torches) if ((t.x - x) ** 2 + (t.z - z) ** 2 <= r2) return true;
    for (const t of this.towers) if (t.fam === 'camp' && (t.x - x) ** 2 + (t.z - z) ** 2 <= r2 * 1.6) return true;
    return false;
  }

  /** Kessin s'adapte (terres de Cendre, survie) : active à partir de la vague `ADAPT_FROM`. */
  get adaptive(): boolean {
    return this.level ? this.level.index >= ADAPT_LEVEL : this.waveIdx >= ADAPT_FROM;
  }

  /**
   * Début de vague : les ennemis gagnent une résistance au type de dégâts dominant de la vague précédente
   * (plus de 58 % des dégâts), et en perdent un peu à l'autre. Ça pousse à varier sans rien interdire.
   */
  private adaptWave() {
    const [ph, mg] = this.adaptDmg;
    this.adaptDmg = [0, 0];
    if (!this.adaptive || ph + mg <= 0) return;
    const share = ph / (ph + mg);
    const dom: number = share > ADAPT_SHARE ? 0 : share < 1 - ADAPT_SHARE ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      this.adapt[k] = k === dom ? Math.min(ADAPT_MAX, this.adapt[k] + ADAPT_STEP) : Math.max(0, this.adapt[k] - ADAPT_DECAY);
    }
    if (dom >= 0) this.ev(Ev.Adapt, dom, Math.round(this.adapt[dom] * 100));
  }

  /** Revenus des mines au début d'une vague : or, intérêts, marché (alliés) et grenier (vies). */
  private payMines() {
    for (const t of this.towers) {
      if (t.fam !== 'mine') continue;
      const p = this.player(t.owner);
      if (!p || !p.active) continue;
      let g = mineIncome(t.level, t.sk, this.perk(t.owner).mineGold);
      const lvl = TOWERS.mine[t.level];
      let lives = 0;
      if (t.level === 3 && t.sk[1] > 0) g += Math.floor(Math.min(80, p.gold * lvl.skills![1].values[t.sk[1] - 1]));
      if (t.level === 4) {
        if (t.sk[0] > 0 && this.waveIdx % lvl.skills![0].values[t.sk[0] - 1] === 0 && this.lives < this.maxLives) {
          this.lives++;
          lives = 1;
        }
        if (t.sk[1] > 0) {
          const v = lvl.skills![1].values[t.sk[1] - 1];
          for (const q of this.players) if (q !== p && q.active) { q.gold += v; q.goldEarned += v; }
        }
      }
      p.gold += g;
      p.goldEarned += g;
      this.ev(Ev.Income, t.id, g, lives);
    }
  }

  // ------------------------------------------------------------ commandes

  apply(pid: number, c: Command) {
    const p = this.player(pid);
    if (!p || !p.active || this.state === GameState.Won || this.state === GameState.Lost) return;
    switch (c.k) {
      case 'build': {
        const slot = clampNum(c.slot, 0, this.map.slots.length - 1);
        const fi = clampNum(c.fam, 0, FAMILIES.length - 1);
        if (slot === null || fi === null || slot !== c.slot || fi !== c.fam) return;
        const s = this.map.slots[slot];
        if (s.locked || this.towerBySlot[slot]) return;
        const fam = FAMILIES[fi];
        const def = TOWERS[fam][0];
        if (p.gold < def.cost) return;
        p.gold -= def.cost;
        const t: Tower = {
          id: this.nextId++, slot, owner: pid, fam, fi, level: 0, sk: [0, 0], cdT: sec(0.3), burstLeft: 0, burstT: 0,
          stunT: 0, aim: null, rallyX: s.x, rallyZ: s.z, units: [], invested: def.cost, paid: { [pid]: def.cost }, lastBuy: this.tick, lastBuyer: pid, s1T: 0, s2T: 0, x: s.x, z: s.z,
          prio: Prio.First, auraRange: 0, auraRate: 0, auraDmg: 0,
        };
        if (fam === 'barracks') {
          // point de ralliement : le point du chemin le plus proche
          let best = Infinity;
          for (const path of this.map.paths) {
            const pr = path.project(s.x, s.z);
            if (pr.dist2 < best) {
              best = pr.dist2;
              path.at(pr.d, 0, tmp);
              t.rallyX = tmp.x;
              t.rallyZ = tmp.z;
            }
          }
          this.clampRally(t);
        }
        this.towers.push(t);
        this.towerBySlot[slot] = t;
        this.syncSoldiers(t);
        this.ev(Ev.Build, t.id, slot);
        break;
      }
      case 'up': {
        // n'importe quel joueur peut améliorer la tour d'un coéquipier, avec son propre or
        const t = this.anyTower(c.tower);
        if (!t || t.level >= 2) return;
        const def = TOWERS[t.fam][t.level + 1];
        if (p.gold < def.cost) return;
        p.gold -= def.cost;
        t.invested += def.cost;
        t.paid[pid] = (t.paid[pid] ?? 0) + def.cost;
        t.level++;
        t.lastBuy = this.tick;
        t.lastBuyer = pid;
        this.syncSoldiers(t);
        this.ev(Ev.Upgrade, t.id, pid, t.owner);
        break;
      }
      case 'spec': {
        const t = this.anyTower(c.tower);
        if (!t || t.level !== 2 || (c.s !== 1 && c.s !== 2)) return;
        const def = TOWERS[t.fam][2 + c.s];
        if (p.gold < def.cost) return;
        p.gold -= def.cost;
        t.invested += def.cost;
        t.paid[pid] = (t.paid[pid] ?? 0) + def.cost;
        t.level = 2 + c.s;
        t.lastBuy = this.tick;
        t.lastBuyer = pid;
        t.s1T = sec(3);
        t.s2T = sec(5);
        this.syncSoldiers(t);
        this.ev(Ev.Upgrade, t.id, pid, t.owner);
        break;
      }
      case 'skill': {
        const t = this.anyTower(c.tower);
        if (!t || t.level < LEVEL_SPEC_A || (c.i !== 0 && c.i !== 1)) return;
        const sk = TOWERS[t.fam][t.level].skills![c.i];
        const rank = t.sk[c.i];
        if (rank >= 3) return;
        const cost = sk.costs[rank];
        if (p.gold < cost) return;
        p.gold -= cost;
        t.invested += cost;
        t.paid[pid] = (t.paid[pid] ?? 0) + cost;
        t.sk[c.i]++;
        t.lastBuy = this.tick;
        t.lastBuyer = pid;
        this.syncSoldiers(t);
        this.ev(Ev.Upgrade, t.id, pid, t.owner);
        break;
      }
      case 'sell': {
        const t = this.ownTower(pid, c.tower);
        if (!t) return;
        // remboursement intégral : juste après un achat, ou pendant la préparation (avant la première vague)
        const undo = t.lastBuyer === pid && this.tick - t.lastBuy <= sec(UNDO_SELL_S);
        if (this.state === GameState.Waiting) {
          // chaque joueur récupère exactement ce qu'il a payé
          for (const q of this.players) q.gold += t.paid[q.id] ?? 0;
        } else p.gold += Math.floor(t.invested * (undo ? 1 : SELL_RATIO));
        this.removeTower(t);
        break;
      }
      case 'prio': {
        const t = this.ownTower(pid, c.tower);
        if (!t || !SHOOTERS.includes(t.fi) || typeof c.p !== 'number' || !Number.isInteger(c.p) || c.p < 0 || c.p > 3) return;
        t.prio = c.p;
        break;
      }
      case 'rally': {
        const t = this.ownTower(pid, c.tower);
        const x = clampNum(c.x, -100, 100), z = clampNum(c.z, -100, 100);
        if (!t || t.fam !== 'barracks' || x === null || z === null) return;
        t.rallyX = x;
        t.rallyZ = z;
        this.clampRally(t);
        for (const u of t.units) {
          this.release(u);
          u.hx = t.rallyX + FORMATION[u.idx][0];
          u.hz = t.rallyZ + FORMATION[u.idx][1];
        }
        this.ev(Ev.Impact, Impact.Rally, t.rallyX, t.rallyZ, 10);
        break;
      }
      case 'hmove': {
        const h = this.heroes.find((h) => h.owner === pid);
        const x = clampNum(c.x, -this.map.def.hw, this.map.def.hw), z = clampNum(c.z, -this.map.def.hh, this.map.def.hh);
        if (!h || h.u.dead || x === null || z === null) return;
        this.release(h.u);
        h.u.focus = null;
        // destination dans l'eau, un rocher ou une tour : au bord le plus proche
        const goal = { x, z };
        this.pushOut(goal);
        h.u.hx = goal.x;
        h.u.hz = goal.z;
        h.u.moving = true;
        break;
      }
      case 'hattack': {
        const h = this.heroes.find((h) => h.owner === pid);
        if (!h || h.u.dead || typeof c.e !== 'number') return;
        const e = this.enemies.find((q) => q.id === c.e);
        if (!e || !this.targetable(e, true) || !this.visible(e)) return;
        const u = h.u;
        this.release(u);
        u.moving = false;
        if (u.range <= 0 && e.flying) {
          // un héros de mêlée ne touche pas les volants : il se place dessous
          u.focus = null;
          const goal = { x: e.x, z: e.z };
          this.pushOut(goal);
          u.hx = goal.x; u.hz = goal.z;
          u.moving = true;
          return;
        }
        u.focus = e;
        break;
      }
      case 'hskill': {
        const h = this.heroes.find((h) => h.owner === pid);
        const x = clampNum(c.x, -this.map.def.hw - 2, this.map.def.hw + 2), z = clampNum(c.z, -this.map.def.hh - 2, this.map.def.hh + 2);
        if (!h || h.u.dead || x === null || z === null || (c.i !== 0 && c.i !== 1 && c.i !== 2)) return;
        const sk = h.skills[c.i];
        if (!sk || h.level < SKILL_UNLOCK[c.i] || h.cds[c.i] > 0) return;
        h.cds[c.i] = sec(sk.cd * Math.max(0.4, 1 - h.bonus.cd - (h.pas.has('focalisation') ? 0.2 : 0)));
        this.heroSkill(h, c.i, sk, x, z);
        // Résonance : chaque compétence avance la recharge des autres
        if (h.pas.has('resonance')) for (let k = 0; k < 3; k++) if (k !== c.i) h.cds[k] = Math.max(0, h.cds[k] - sec(2));
        break;
      }
      case 'item': {
        const i = c.i;
        if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= ITEMS.length) return;
        if (!(p.items[i] > 0) || p.itemCd > 0) return;
        const x = clampNum(c.x, -this.map.def.hw - 2, this.map.def.hw + 2), z = clampNum(c.z, -this.map.def.hh - 2, this.map.def.hh + 2);
        if (ITEMS[i].targeted && (x === null || z === null)) return;
        p.items[i]--;
        p.itemCd = sec(ITEM_COOLDOWN_S);
        this.useItem(p, i, x ?? 0, z ?? 0);
        break;
      }
      case 'spell': {
        const x = clampNum(c.x, -this.map.def.hw - 2, this.map.def.hw + 2), z = clampNum(c.z, -this.map.def.hh - 2, this.map.def.hh + 2);
        if (c.s !== 0 && c.s !== 1) return;
        // l'emplacement renvoie au sort emporté par ce joueur : un sort hors de son choix ne se lance pas
        const def = SPELLS[p.spells[c.s]];
        if (!def || p.spellCd[c.s] > 0 || (def.radius > 0 && (x === null || z === null))) return;
        p.spellCd[c.s] = sec(def.cd * Math.max(0.4, 1 - this.perk(pid).spellCd));
        this.castSpell(pid, c.s, p.spells[c.s], x ?? 0, z ?? 0);
        break;
      }
      case 'wave': {
        if (this.state === GameState.Waiting) {
          this.startWave();
        } else if (this.nextWaveT > 0) {
          const rem = this.nextWaveT / TICK_RATE;
          // bonus d'équipe : chaque joueur actif touche sa part, selon la même règle que les primes
          // (en solo, rien ne change ; en coop, plus de course au clic)
          const bonus = earlyCallBonus(rem, this.activeCount);
          for (const q of this.players) if (q.active) q.gold += bonus;
          const red = sec(rem * BALANCE.earlySpellCdPerSec);
          for (const q of this.players) {
            q.spellCd[0] = Math.max(0, q.spellCd[0] - red);
            q.spellCd[1] = Math.max(0, q.spellCd[1] - red);
          }
          this.startWave();
        }
        break;
      }
      case 'speed': {
        p.speedVote = c.v === 2 ? 2 : 1;
        break;
      }
      case 'prop': {
        const i = c.i;
        if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= this.map.props.length) return;
        this.useProp(p, i);
        break;
      }
      case 'gift': {
        const to = this.player(c.to);
        const amt = clampNum(c.amt, 0, 100000);
        if (!to || to === p || !to.active || amt === null) return;
        const a = Math.min(Math.floor(p.gold), Math.floor(amt / 50) * 50);
        if (a <= 0) return;
        p.gold -= a;
        to.gold += a;
        this.ev(Ev.Gift, pid, to.id, a);
        break;
      }
    }
  }

  private anyTower(id: unknown): Tower | null {
    return this.towers.find((t) => t.id === id) ?? null;
  }

  private ownTower(pid: number, id: unknown): Tower | null {
    const t = this.towers.find((t) => t.id === id);
    return t && t.owner === pid ? t : null;
  }

  private clampRally(t: Tower) {
    const r = TOWERS.barracks[t.level].range;
    const dx = t.rallyX - t.x, dz = t.rallyZ - t.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > r) {
      t.rallyX = t.x + (dx / d) * r;
      t.rallyZ = t.z + (dz / d) * r;
    }
  }

  private removeTower(t: Tower) {
    for (const u of t.units) {
      this.release(u);
      u.life = 0;
      u.dead = true;
    }
    t.units.length = 0;
    this.towers.splice(this.towers.indexOf(t), 1);
    this.towerBySlot[t.slot] = null;
    this.ev(Ev.Sell, t.slot, t.owner);
  }

  /** Crée / met à jour les soldats d'une caserne. */
  private syncSoldiers(t: Tower) {
    const lvl = TOWERS[t.fam][t.level];
    const sd = lvl.soldiers;
    if (!sd) return;
    const shieldBonus = t.level === 3 ? lvl.skills![0].values[t.sk[0] - 1] ?? 0 : 0;
    const pk = this.perk(t.owner);
    const hp = Math.round(sd.hp * (1 + pk.soldierHp));
    for (let i = 0; i < sd.count; i++) {
      let u = t.units[i];
      if (!u) {
        u = this.newUnit(sd.kind, t.owner, t.x, t.z, hp, sd.dmg[0], sd.dmg[1], sd.armor, sd.cooldown, sd.regen, t, -1);
        u.idx = i;
        t.units.push(u);
      }
      u.kind = sd.kind;
      u.maxHp = hp;
      if (!u.dead) u.hp = hp;
      u.dmgMin = sd.dmg[0] * (1 + pk.soldierDmg);
      u.dmgMax = sd.dmg[1] * (1 + pk.soldierDmg);
      u.armor = sd.armor + shieldBonus + pk.soldierArmor;
      u.regen = sd.regen * (1 + shieldBonus * 3);
      u.cdTicks = sec(sd.cooldown);
      u.hx = t.rallyX + FORMATION[i][0];
      u.hz = t.rallyZ + FORMATION[i][1];
    }
  }

  // ------------------------------------------------------------ sorts & héros

  /** Lance le sort `spell` (index de SPELLS) depuis l'emplacement `slot` du joueur `pid`. */
  private castSpell(pid: number, slot: 0 | 1, spell: number, x: number, z: number) {
    this.ev(Ev.Spell, slot, pid, x, z, spell);
    const id = SPELLS[spell].id;
    const near: Enemy[] = [];
    // branche Renforts & sorts de l'atelier : dégâts, rayon et durée des zones
    const pk = this.perk(pid);
    const dm = 1 + pk.spellDmg, am = 1 + pk.spellArea;
    /** zone durable + son effet visuel (rayon ×10 + durée ×1000 transmis au client) */
    const zone = (kind: Impact, r: number, dur: number, dps: number, dtype: DmgType, air: boolean, slow: number) => {
      r *= am;
      dur *= am;
      dps *= dm;
      this.zones.push({ kind, x, z, r, t: sec(dur), dps, dtype, owner: pid, air, slow });
      this.ev(Ev.Impact, kind, x, z, Math.round(r * 10) + Math.round(dur) * 1000);
    };
    switch (id) {
      case 'meteor': {
        const offs = [[0, 0], [1.3, 0.8], [-1.1, 0.9]];
        offs.forEach(([ox, oz], i) => {
          const tx = x + ox, tz = z + oz;
          const flight = sec(1.0 + i * 0.25);
          this.projs.push(this.mkProj(FIRE_METEOR, null, pid, null, tx, tz, flight, 75 * (1 + pk.meteorDmg + pk.spellDmg), DmgType.True, 1.9, false, null));
          this.ev(Ev.Fire, FIRE_METEOR, Src.Sky, pid, 0xffff, tx, tz, flight);
        });
        break;
      }
      case 'renfort': {
        // miliciens, chevaliers ou paladins selon la branche Renforts & sorts de l'atelier
        const tier = RENFORT_TIERS[Math.min(RENFORT_TIERS.length - 1, pk.renfortTier)];
        const n = RENFORT_COUNT + pk.renfortCount;
        for (let i = 0; i < n; i++) {
          const hp = Math.round(tier.hp * (1 + pk.renfortHp));
          const a = n === 2 ? (i ? 0 : Math.PI) : (i / n) * Math.PI * 2;
          const q = this.placeOut({ x: x + Math.cos(a) * 0.6, z: z + Math.sin(a) * 0.6 }, 0.45);
          const u = this.newUnit(tier.kind, pid, q.x, q.z, hp, tier.dmg[0], tier.dmg[1], tier.armor, 1, tier.regen, null, sec(RENFORT_DUR_S + pk.renfortDur));
          u.hx = u.x;
          u.hz = u.z;
        }
        break;
      }
      case 'sables':
        zone(Impact.Trap, 3, 8, 12, DmgType.Phys, false, 0.75);
        break;
      case 'poison':
        zone(Impact.Plague, 2.8, 8, 35, DmgType.Magic, true, 0);
        break;
      case 'blizzard':
        zone(Impact.Blizzard, 3, 6, 30, DmgType.Magic, true, 0.6);
        break;
      case 'flammes':
        zone(Impact.Lava, 2.6, 8, 40, DmgType.True, false, 0.25);
        break;
      case 'soin': {
        this.lives = Math.min(this.maxLives, this.lives + 2);
        let hx = 0, hz = 0;
        for (const o of this.units) {
          if (o.dead || o.owner !== pid) continue;
          o.hp = o.maxHp;
          if (o.kind === HERO_UNIT) { hx = o.x; hz = o.z; }
        }
        this.ev(Ev.Impact, Impact.Sanctuary, hx, hz, 50);
        break;
      }
      case 'malediction':
        for (const e of this.enemiesIn(x, z, 3 * am, true, near)) {
          e.curse = Math.max(e.curseT > 0 ? e.curse : 0, 0.35);
          e.curseT = Math.max(e.curseT, sec(9));
          e.slowMul = Math.min(e.slowMul, 0.7);
          e.slowT = Math.max(e.slowT, sec(9));
        }
        this.ev(Ev.Impact, Impact.Curse, x, z, Math.round(30 * am) + 9000);
        break;
      case 'benediction':
        this.blessings.push({ x, z, r: 4.5, t: sec(12), rate: 0.4, dmg: 0.2 });
        this.ev(Ev.Impact, Impact.Dawn, x, z, 45);
        break;
      case 'foudre': {
        // la cible près du point visé, puis cinq rebonds
        let cur: Enemy | null = null, best = 2.5 * 2.5;
        for (const e of this.enemies) {
          if (!this.targetable(e, true) || !this.visible(e)) continue;
          const d2 = (e.x - x) ** 2 + (e.z - z) ** 2;
          if (d2 < best) { best = d2; cur = e; }
        }
        const hit = new Set<Enemy>();
        let dmg = 220 * dm;
        while (cur && hit.size < 6) {
          hit.add(cur);
          this.ev(Ev.Impact, Impact.Bolt, cur.x, cur.z, 0);
          const px = cur.x, pz = cur.z;
          this.damage(cur, dmg, DmgType.Magic, pid, null);
          dmg *= 0.88;
          let next: Enemy | null = null, nb = 3.5 * 3.5;
          for (const e of this.enemies) {
            if (hit.has(e) || !this.targetable(e, true) || !this.visible(e)) continue;
            const d2 = (e.x - px) ** 2 + (e.z - pz) ** 2;
            if (d2 < nb) { nb = d2; next = e; }
          }
          cur = next;
        }
        break;
      }
      case 'seisme':
        for (const e of [...this.enemiesIn(x, z, 3.4 * am, false, near)]) {
          this.damage(e, 160 * dm, DmgType.Phys, pid, null);
          if (!e.dead) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 0.8 : 2));
        }
        this.ev(Ev.Impact, Impact.Quake, x, z, Math.round(34 * am));
        break;
    }
  }

  /** Carte interactive : tonneau, camp de mercenaires ou secret. */
  private useProp(p: PlayerState, i: number) {
    const prop = this.map.props[i];
    if (this.propCd[i] > 0) return;
    const st = this.propState[i];
    switch (prop.kind) {
      case PropKind.Poudre: {
        if (st !== 0) return;
        let n = 0;
        for (const e of [...this.enemiesIn(prop.x, prop.z, POUDRE_R, false)]) {
          n++;
          this.damage(e, POUDRE_DMG, DmgType.Phys, p.id, null, 0, false, true);
        }
        // l'explosion blesse aussi les soldats trop proches (un peu)
        for (const u of this.units) if (!u.dead && !u.hero && (u.x - prop.x) ** 2 + (u.z - prop.z) ** 2 < POUDRE_R * POUDRE_R) this.hurtUnit(u, 25);
        this.propState[i] = 1;
        this.ev(Ev.Prop, i, p.id, 1, n);
        this.ev(Ev.Impact, Impact.Shell, prop.x, prop.z, Math.round(POUDRE_R * 10));
        break;
      }
      case PropKind.Camp: {
        const cost = PROP_INFO[PropKind.Camp].cost;
        if (p.gold < cost) return;
        p.gold -= cost;
        // ils vont barrer le chemin le plus proche du camp
        let best = Infinity, gx = prop.x, gz = prop.z;
        const o = { x: 0, z: 0 };
        for (const path of this.map.paths) {
          const pr = path.project(prop.x, prop.z);
          if (pr.dist2 < best) { best = pr.dist2; path.at(pr.d, 0, o); gx = o.x; gz = o.z; }
        }
        for (let k = 0; k < MERC.n; k++) {
          const a = (k / MERC.n) * Math.PI * 2 + prop.ang;
          const q = this.placeOut({ x: prop.x + Math.cos(a) * 1.5, z: prop.z + Math.sin(a) * 1.5 }, 0.45);
          const u = this.newUnit(MERC.kind, p.id, q.x, q.z, MERC.hp, MERC.dmg[0], MERC.dmg[1], MERC.armor, 1, 0, null, sec(MERC.dur));
          const g = this.placeOut({ x: gx + Math.cos(a) * 0.7, z: gz + Math.sin(a) * 0.7 }, 0.3);
          u.hx = g.x;
          u.hz = g.z;
        }
        this.propCd[i] = sec(CAMP_CD_S);
        this.ev(Ev.Prop, i, p.id, 1, MERC.n);
        break;
      }
      case PropKind.Secret: {
        const def = SECRETS[this.map.def.biome]?.[prop.v];
        if (!def || st === PROP_FOUND) return;
        const n = st + 1;
        // un petit délai entre deux clics : on ne le trouve pas en martelant par accident
        this.propCd[i] = sec(0.25);
        if (n >= def.clicks) {
          this.propState[i] = PROP_FOUND;
          p.gold += def.gold;
          p.goldEarned += def.gold;
          this.ev(Ev.Prop, i, p.id, PROP_FOUND, def.gold);
        } else {
          this.propState[i] = n;
          this.ev(Ev.Prop, i, p.id, n, 0);
        }
        break;
      }
    }
  }

  /** Rechargements des éléments de carte. */
  private stepProps() {
    for (let i = 0; i < this.propCd.length; i++) if (this.propCd[i] > 0) this.propCd[i]--;
  }

  /** Objet de boutique : effet immédiat (or, vies) ou sur la zone visée (givre, bombe). */
  private useItem(p: PlayerState, i: number, x: number, z: number) {
    const def = ITEMS[i];
    this.ev(Ev.Item, p.id, i, x, z);
    if (i === Item.Bourse) p.gold += 150;
    else if (i === Item.Potion) this.lives = Math.min(this.maxLives, this.lives + 3);
    else if (i === Item.Givre) {
      for (const e of this.enemiesIn(x, z, def.radius, true)) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 2 : 4));
      this.ev(Ev.Impact, Impact.Frost, x, z, Math.round(def.radius * 10));
    } else if (i === Item.Bombe) {
      for (const e of [...this.enemiesIn(x, z, def.radius, true)]) this.damage(e, 300, DmgType.True, p.id, null, 1);
      this.ev(Ev.Impact, Impact.Shell, x, z, Math.round(def.radius * 10));
    }
  }

  private heroSkill(h: Hero, i: number, sk: ClassSkill, x: number, z: number) {
    const u = h.u;
    const lvl = h.level;
    const near: Enemy[] = [];
    // bonus des nœuds « dégâts des compétences » et « invocations »
    const sm = 1 + h.bonus.skill;
    const km = 1 + h.bonus.summon;
    // portée maximale : le point visé est ramené vers le héros
    if (sk.range) {
      const dx = x - u.x, dz = z - u.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > sk.range) { x = u.x + (dx / d) * sk.range; z = u.z + (dz / d) * sk.range; }
    }
    this.ev(Ev.HeroSkill, h.owner, i, x, z, u.x, u.z);
    const unitsNear = (r: number, fn: (o: Unit) => void, heroes = false) => {
      for (const o of this.units) {
        if (o.dead || (!heroes && o.kind === HERO_UNIT)) continue;
        const dx = o.x - u.x, dz = o.z - u.z;
        if (dx * dx + dz * dz < r * r) fn(o);
      }
    };
    const tough = h.pas.has('ossements');
    const summon = (n: number, life: number) => {
      for (let k = 0; k < n; k++) {
        const a = FORMATION[k % FORMATION.length], ring = 1 + Math.floor(k / FORMATION.length) * 0.6;
        const q = this.placeOut({ x: x + a[0] * ring, z: z + a[1] * ring }, 0.4);
        const s = this.newUnit(SoldierKind.Squelette, h.owner, q.x, q.z, Math.round((90 + 12 * lvl) * (tough ? 1.4 : 1) * km), (5 + lvl) * km, (9 + lvl) * km, 0.1, 1, 0, null, sec(life + (tough ? 4 : 0)));
        s.hx = s.x; s.hz = s.z;
      }
      this.ev(Ev.Impact, Impact.Summon, x, z, n > 2 ? 20 : 12);
    };
    const catalyse = h.pas.has('catalyse') ? 1.3 : 1;
    const poudre = h.pas.has('poudre') ? 1.3 : 1;
    /** zone durable + son effet visuel (rayon et durée transmis au client) */
    const zone = (kind: Impact, zx: number, zz: number, r: number, dur: number, dps: number, dtype: DmgType, air: boolean, slow: number) => {
      this.zones.push({ kind, x: zx, z: zz, r, t: sec(dur), dps, dtype, owner: h.owner, air, slow });
      this.ev(Ev.Impact, kind, zx, zz, Math.round(r * 10) + Math.round(dur) * 1000);
    };
    /** explosion de bombe ou de grenade (Poudre noire, Éclats brûlants) */
    const blast = (bx: number, bz: number, r: number, dmg: number, stun: number) => {
      for (const e of [...this.enemiesIn(bx, bz, r, false, near)]) {
        this.damage(e, dmg, DmgType.Phys, h.owner, h, 0, false, true);
        if (stun && !e.dead) e.stunT = Math.max(e.stunT, sec(stun));
      }
      this.ev(Ev.Impact, Impact.Shell, bx, bz, Math.round(r * 10));
      if (h.pas.has('shrapnel')) this.zones.push({ kind: Impact.FireShell, x: bx, z: bz, r: r * 0.8, t: sec(3), dps: (14 + 3 * lvl) * sm, dtype: DmgType.True, owner: h.owner, air: false, slow: 0 });
    };
    const turret = (tx: number, tz: number) => {
      ({ x: tx, z: tz } = this.placeOut({ x: tx, z: tz }, 0.6));
      const k = (h.pas.has('mecanique') ? 1.4 : 1) * km;
      const forge = h.pas.has('forge');
      const t = this.newUnit(SoldierKind.Tourelle, h.owner, tx, tz, Math.round((220 + 20 * lvl) * k), (10 + 2 * lvl) * k, (16 + 2 * lvl) * k, 0.4, 0.6, 0, null, sec(forge ? 24 : 16));
      t.range = 6.5;
      t.speed = 0;
      t.hx = tx; t.hz = tz;
      this.ev(Ev.Impact, Impact.Turret, tx, tz, 10);
      if (forge) {
        this.zones.push({ kind: Impact.Lava, x: tx, z: tz, r: 2.4, t: sec(4), dps: (30 + 5 * lvl) * sm, dtype: DmgType.True, owner: h.owner, air: false, slow: 0.4 });
        this.ev(Ev.Impact, Impact.Lava, tx, tz, 24);
      }
    };
    /** ennemis sur un segment depuis le héros */
    const line = (len: number, w2: number, air: boolean, fn: (e: Enemy) => void) => {
      let dx = x - u.x, dz = z - u.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= d; dz /= d;
      for (const e of [...this.enemies]) {
        if (!this.targetable(e, air)) continue;
        const t = (e.x - u.x) * dx + (e.z - u.z) * dz;
        if (t < 0 || t > len) continue;
        const px = u.x + dx * t - e.x, pz = u.z + dz * t - e.z;
        if (px * px + pz * pz < w2) fn(e);
      }
    };
    switch (sk.id) {
      // ---- aventurier
      case 'coup':
        for (const e of this.enemiesIn(u.x, u.z, 2.2, false, near)) this.damage(e, (30 + 6 * lvl) * sm, DmgType.Phys, h.owner, h);
        this.ev(Ev.Impact, Impact.Hammer, u.x, u.z, 22);
        break;
      case 'souffle':
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.35);
        this.ev(Ev.Heal, u.x, u.z);
        break;
      case 'elan':
        for (const e of this.enemiesIn(u.x, u.z, 3.8, false, near)) this.damage(e, (150 + 26 * lvl) * sm, DmgType.Phys, h.owner, h, 1);
        unitsNear(4.5, (o) => { o.shield = Math.max(o.shield, 100 + 10 * lvl); }, true);
        this.ev(Ev.Impact, Impact.Holy, u.x, u.z, 34);
        break;
      // ---- épéiste
      case 'charge': {
        let dx = x - u.x, dz = z - u.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        const len = Math.min(sk.range ?? 7, d);
        dx /= d; dz /= d;
        const sx = u.x, sz = u.z;
        this.release(u);
        u.x = sx + dx * len;
        u.z = sz + dz * len;
        u.hx = u.x; u.hz = u.z;
        u.moving = false;
        for (const e of [...this.enemies]) {
          if (!this.targetable(e, false)) continue;
          const t = Math.max(0, Math.min(len, (e.x - sx) * dx + (e.z - sz) * dz));
          const px = sx + dx * t - e.x, pz = sz + dz * t - e.z;
          if (px * px + pz * pz < 1.6) {
            this.damage(e, (45 + 9 * lvl) * sm, DmgType.Phys, h.owner, h);
            e.stunT = Math.max(e.stunT, sec(0.8));
          }
        }
        this.ev(Ev.Impact, Impact.Charge, u.x, u.z, 15);
        break;
      }
      case 'tourbillon':
        for (let k = 0; k < 3; k++) for (const e of [...this.enemiesIn(u.x, u.z, 2.6, false, near)]) this.damage(e, (22 + 5 * lvl) * sm, DmgType.Phys, h.owner, h, 0, k > 0);
        this.ev(Ev.Impact, Impact.Charge, u.x, u.z, 26);
        break;
      case 'ralliement':
        unitsNear(4.5, (o) => { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.5); o.buffT = sec(6); });
        this.ev(Ev.Heal, u.x, u.z);
        break;
      case 'ethan':
        for (const e of this.enemiesIn(u.x, u.z, 3.8, false, near)) this.damage(e, (160 + 28 * lvl) * sm, DmgType.Phys, h.owner, h, 1);
        unitsNear(4.5, (o) => { o.shield = 120 + 10 * lvl; }, true);
        this.ev(Ev.Impact, Impact.Holy, u.x, u.z, 38);
        break;
      // ---- gardien
      case 'marteau':
        for (const e of this.enemiesIn(u.x, u.z, 2.7, false, near)) {
          this.damage(e, (50 + 9 * lvl) * sm, DmgType.Phys, h.owner, h);
          e.stunT = Math.max(e.stunT, sec(2));
        }
        this.ev(Ev.Impact, Impact.Hammer, u.x, u.z, 27);
        break;
      case 'defi':
        for (const e of this.enemiesIn(u.x, u.z, 3.2, false, near)) {
          this.damage(e, (20 + 5 * lvl) * sm, DmgType.Phys, h.owner, h);
          e.stunT = Math.max(e.stunT, sec(e.def.boss ? 0.6 : 1.6));
        }
        u.shield = Math.max(u.shield, (110 + 18 * lvl) * sm);
        this.ev(Ev.Impact, Impact.Rally, u.x, u.z, 32);
        break;
      case 'egide':
        unitsNear(4.5, (o) => { o.shield = Math.max(o.shield, (70 + 12 * lvl) * sm); }, true);
        this.ev(Ev.Impact, Impact.Holy, u.x, u.z, 30);
        break;
      case 'rempart':
        unitsNear(4.5, (o) => { o.shield = Math.max(o.shield, 200 + 25 * lvl); }, true);
        for (const e of this.enemiesIn(u.x, u.z, 3.5, false, near)) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 1 : 2.5));
        this.ev(Ev.Impact, Impact.Holy, u.x, u.z, 35);
        break;
      // ---- archer
      case 'perce': {
        let dx = x - u.x, dz = z - u.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= d; dz /= d;
        for (const e of [...this.enemies]) {
          if (!this.targetable(e, true)) continue;
          const t = (e.x - u.x) * dx + (e.z - u.z) * dz;
          if (t < 0 || t > 13) continue;
          const px = u.x + dx * t - e.x, pz = u.z + dz * t - e.z;
          if (px * px + pz * pz < 0.9) this.damage(e, (85 + 12 * lvl) * sm, DmgType.Phys, h.owner, h, 1);
        }
        break;
      }
      case 'visee': {
        // l'ennemi le plus solide près du point visé
        let best: Enemy | null = null;
        for (const e of this.enemiesIn(x, z, 2.2, true, near)) if (this.visible(e) && (!best || e.hp > best.hp)) best = e;
        if (!best) break;
        const flight = this.flightTicks(u.x, u.z, best.x, best.z, 26);
        const pr = this.mkProj(FIRE_HERO_ARROW, null, h.owner, best, best.x, best.z, flight, (170 + 26 * lvl) * sm, DmgType.Phys, 0, true, h);
        this.projs.push(pr);
        this.ev(Ev.Fire, FIRE_HERO_ARROW, Src.Hero, h.owner, best.id, best.x, best.z, flight);
        break;
      }
      case 'pluie':
        this.zones.push({ kind: Impact.ArrowRain, x, z, r: 2.3, t: sec(3), dps: (32 + 5 * lvl) * sm, dtype: DmgType.Phys, owner: h.owner, air: true, slow: 0 });
        this.ev(Ev.Impact, Impact.ArrowRain, x, z, 23);
        break;
      case 'aube':
        for (const e of this.enemiesIn(u.x, u.z, 9, true, near)) this.damage(e, (120 + 18 * lvl) * sm, DmgType.Phys, h.owner, h, 1);
        this.ev(Ev.Impact, Impact.Dawn, u.x, u.z, 90);
        break;
      // ---- mage
      case 'boule':
        for (const e of [...this.enemiesIn(x, z, 1.9, true, near)]) this.damage(e, (55 + 10 * lvl) * sm, DmgType.Magic, h.owner, h, 0, false, true);
        this.ev(Ev.Impact, Impact.FireShell, x, z, 19);
        break;
      case 'flammes':
        this.zones.push({ kind: Impact.FireShell, x, z, r: 2.4, t: sec(4), dps: (30 + 6 * lvl) * sm, dtype: DmgType.Magic, owner: h.owner, air: false, slow: 0 });
        this.ev(Ev.Impact, Impact.FireShell, x, z, 24);
        break;
      case 'nova':
        for (const e of [...this.enemiesIn(u.x, u.z, 3, true, near)]) {
          this.damage(e, (40 + 8 * lvl) * sm, DmgType.Magic, h.owner, h);
          if (!e.dead) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 0.8 : 2));
        }
        this.ev(Ev.Impact, Impact.Frost, u.x, u.z, 30);
        break;
      case 'meteore': {
        const flight = sec(1.1);
        this.projs.push(this.mkProj(FIRE_METEOR, null, h.owner, null, x, z, flight, (260 + 30 * lvl) * sm, DmgType.Magic, 3, false, h));
        this.ev(Ev.Fire, FIRE_METEOR, Src.Sky, h.owner, 0xffff, x, z, flight);
        break;
      }
      // ---- nécromancien
      case 'os': summon(h.pas.has('legion') ? 3 : 2, 14); break;
      case 'armee': summon(h.pas.has('legion') ? 8 : 6, 18); break;
      case 'golem': {
        ({ x, z } = this.placeOut({ x, z }, 0.7));
        const g = this.newUnit(SoldierKind.Squelette, h.owner, x, z, Math.round((420 + 45 * lvl) * (tough ? 1.4 : 1) * km), (16 + 3 * lvl) * km, (26 + 3 * lvl) * km, 0.35, 1.2, 0, null, sec(20 + (tough ? 4 : 0)));
        g.hx = x; g.hz = z;
        this.ev(Ev.Impact, Impact.Summon, x, z, 22);
        break;
      }
      case 'drain': {
        let total = 0;
        for (const e of this.enemiesIn(u.x, u.z, 3.6, true, near)) total += this.damage(e, (32 + 7 * lvl) * sm, DmgType.Magic, h.owner, h);
        u.hp = Math.min(u.maxHp, u.hp + total * 0.5);
        this.ev(Ev.Impact, Impact.Drain, u.x, u.z, 36);
        break;
      }
      // ---- artificier
      case 'bombe':
        blast(x, z, 2.2 * catalyse * poudre, (60 + 10 * lvl) * sm, 0.7);
        break;
      case 'acide': {
        const r = 2 * catalyse;
        this.zones.push({ kind: Impact.Lava, x, z, r, t: sec(catalyse > 1 ? 6 : 4), dps: (26 + 5 * lvl) * sm, dtype: DmgType.True, owner: h.owner, air: false, slow: 0.35 });
        this.ev(Ev.Impact, Impact.Lava, x, z, Math.round(r * 10));
        break;
      }
      case 'tourelle':
        turret(x, z);
        break;
      case 'transmutation': {
        const p = this.players.find((q) => q.id === h.owner);
        for (const e of [...this.enemiesIn(x, z, 2.8, true, near)]) {
          this.damage(e, (200 + 25 * lvl) * sm, DmgType.True, h.owner, h, 1, false, true);
          if (p) { p.gold += 3; p.goldEarned += 3; }
        }
        this.ev(Ev.Impact, Impact.Arcane, x, z, 28);
        break;
      }
      // ---- routes ajoutées : épéiste
      case 'lames': {
        // les six ennemis les plus solides autour de lui
        const pool = [...this.enemiesIn(u.x, u.z, 6, true, near)].filter((e) => this.visible(e)).sort((a, b) => b.hp - a.hp || a.id - b.id).slice(0, 6);
        for (const e of pool) {
          this.damage(e, (130 + 22 * lvl) * sm, DmgType.Phys, h.owner, h, 1);
          this.ev(Ev.Impact, Impact.Blades, e.x, e.z, 12);
        }
        this.ev(Ev.Impact, Impact.Charge, u.x, u.z, 30);
        break;
      }
      case 'onde':
        line(8, 1.4, false, (e) => {
          this.damage(e, (55 + 10 * lvl) * sm, DmgType.Phys, h.owner, h);
          if (e.dead || e.def.boss || e.flying) return;
          // repoussé en arrière sur son chemin
          for (const o of [...e.blockers]) this.release(o);
          e.dist = Math.max(0.6, e.dist - 1.6);
          this.pathOf(e).at(e.dist, e.lane, tmp);
          e.x = tmp.x; e.z = tmp.z;
        });
        {
          const d = Math.hypot(x - u.x, z - u.z) || 1;
          this.ev(Ev.Impact, Impact.Wave, u.x + ((x - u.x) / d) * 8, u.z + ((z - u.z) / d) * 8, 15);
        }
        break;
      case 'cyclone':
        zone(Impact.Cyclone, x, z, 2.6, 5, (60 + 10 * lvl) * sm, DmgType.Phys, true, 0.25);
        break;
      // ---- gardien
      case 'seisme':
        for (const e of [...this.enemiesIn(u.x, u.z, 3.3, false, near)]) {
          this.damage(e, (42 + 8 * lvl) * sm, DmgType.Phys, h.owner, h);
          if (!e.dead) { e.slowMul = Math.min(e.slowMul, 0.5); e.slowT = Math.max(e.slowT, sec(3)); }
        }
        this.ev(Ev.Impact, Impact.Quake, u.x, u.z, 33);
        break;
      case 'colere':
        for (let k = 0; k < 3; k++) for (const e of [...this.enemiesIn(u.x, u.z, 3.8, false, near)]) {
          this.damage(e, (70 + 12 * lvl) * sm, DmgType.Phys, h.owner, h, k === 2 ? 1 : 0, k === 1);
          if (!e.dead) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 1 : 3));
        }
        this.ev(Ev.Impact, Impact.Hammer, u.x, u.z, 38);
        this.ev(Ev.Impact, Impact.Quake, u.x, u.z, 38);
        break;
      case 'sanctuaire':
        unitsNear(5, (o) => { o.hp = o.maxHp; o.shield = Math.max(o.shield, (120 + 15 * lvl) * sm); }, true);
        this.ev(Ev.Impact, Impact.Sanctuary, u.x, u.z, 50);
        break;
      // ---- archer
      case 'jugement': {
        let best: Enemy | null = null;
        for (const e of this.enemies) if (this.targetable(e, true) && this.visible(e) && (!best || e.hp > best.hp)) best = e;
        if (!best) break;
        const flight = sec(0.5);
        this.projs.push(this.mkProj(FIRE_HERO_ARROW, null, h.owner, best, best.x, best.z, flight, (320 + 45 * lvl) * sm, DmgType.True, 0, true, h));
        this.ev(Ev.Fire, FIRE_HERO_ARROW, Src.Sky, h.owner, best.id, best.x, best.z, flight);
        this.ev(Ev.Impact, Impact.Dawn, best.x, best.z, 14);
        break;
      }
      case 'piege':
        ({ x, z } = this.placeOut({ x, z }, 0.5));
        zone(Impact.Trap, x, z, 1.4, 6, (24 + 5 * lvl) * sm, DmgType.Phys, false, 0.75);
        break;
      case 'filet':
        for (const e of [...this.enemiesIn(x, z, 3, true, near)]) {
          this.damage(e, (70 + 12 * lvl) * sm, DmgType.Phys, h.owner, h);
          if (!e.dead) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 1 : 3));
        }
        this.ev(Ev.Impact, Impact.Net, x, z, 30 + 3000);
        break;
      // ---- mage
      case 'blizzard':
        zone(Impact.Blizzard, x, z, 3, 6, (38 + 7 * lvl) * sm, DmgType.Magic, true, 0.6);
        break;
      case 'eclair': {
        // la cible près du point visé, puis cinq rebonds
        let cur: Enemy | null = null, best = 2.5 * 2.5;
        for (const e of this.enemies) {
          if (!this.targetable(e, true) || !this.visible(e)) continue;
          const d2 = (e.x - x) ** 2 + (e.z - z) ** 2;
          if (d2 < best) { best = d2; cur = e; }
        }
        const hit = new Set<Enemy>();
        let px = u.x, pz = u.z, dmg = (80 + 14 * lvl) * sm;
        while (cur && hit.size < 6) {
          hit.add(cur);
          this.ev(Ev.Impact, Impact.Bolt, cur.x, cur.z, Math.round(Math.min(60, Math.hypot(cur.x - px, cur.z - pz)) * 10));
          px = cur.x; pz = cur.z;
          this.damage(cur, dmg, DmgType.Magic, h.owner, h);
          dmg *= 0.88;
          let next: Enemy | null = null, nb = 3.5 * 3.5;
          for (const e of this.enemies) {
            if (hit.has(e) || !this.targetable(e, true) || !this.visible(e)) continue;
            const d2 = (e.x - px) ** 2 + (e.z - pz) ** 2;
            if (d2 < nb) { nb = d2; next = e; }
          }
          cur = next;
        }
        break;
      }
      case 'prison':
        for (const e of this.enemiesIn(x, z, 2.8, true, near)) {
          e.stunT = Math.max(e.stunT, sec(e.def.boss ? 1 : 3));
          e.curse = Math.max(e.curseT > 0 ? e.curse : 0, 0.3);
          e.curseT = Math.max(e.curseT, sec(9));
        }
        this.ev(Ev.Impact, Impact.Arcane, x, z, 28);
        this.ev(Ev.Impact, Impact.Curse, x, z, 28 + 3000);
        break;
      // ---- nécromancien
      case 'faux': {
        let total = 0;
        for (const e of [...this.enemiesIn(u.x, u.z, 4, true, near)]) total += this.damage(e, (140 + 22 * lvl) * sm, DmgType.Magic, h.owner, h, 1);
        u.hp = Math.min(u.maxHp, u.hp + total * 0.5);
        this.ev(Ev.Impact, Impact.Drain, u.x, u.z, 40);
        this.ev(Ev.Impact, Impact.Blades, u.x, u.z, 40);
        break;
      }
      case 'peste': {
        const rot = h.pas.has('pourriture');
        zone(Impact.Plague, x, z, 2.4, rot ? 9 : 6, (26 + 5 * lvl) * sm, DmgType.Magic, false, rot ? 0.3 : 0);
        break;
      }
      case 'malediction':
        for (const e of this.enemiesIn(x, z, 3, true, near)) {
          e.curse = Math.max(e.curseT > 0 ? e.curse : 0, 0.4);
          e.curseT = Math.max(e.curseT, sec(8));
          e.slowMul = Math.min(e.slowMul, 0.6);
          e.slowT = Math.max(e.slowT, sec(8));
        }
        this.ev(Ev.Impact, Impact.Curse, x, z, 30 + 8000);
        break;
      // ---- artificier
      case 'usine':
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
          turret(x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3);
        }
        break;
      case 'grenades': {
        const dx = x - u.x, dz = z - u.z;
        for (let k = 1; k <= 3; k++) blast(u.x + (dx * k) / 3, u.z + (dz * k) / 3, 1.6 * poudre, (48 + 9 * lvl) * sm, 0);
        break;
      }
      case 'barrage': {
        const kind = PROJ_KINDS.indexOf('fireshell');
        for (let k = 0; k < 8; k++) {
          const a = this.rng.next() * Math.PI * 2, d = Math.sqrt(this.rng.next()) * 2.6;
          const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
          const flight = sec(0.6 + k * 0.22);
          this.projs.push(this.mkProj(kind, null, h.owner, null, bx, bz, flight, (75 + 11 * lvl) * sm, DmgType.Phys, 1.7, false, h));
          this.ev(Ev.Fire, kind, Src.Sky, h.owner, 0xffff, bx, bz, flight);
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ projectiles

  private mkProj(kind: number, tower: Tower | null, owner: number, target: Enemy | null, tx: number, tz: number, t: number, dmg: number, dtype: DmgType, splash: number, air: boolean, hero: Hero | null): Proj {
    return { kind, tower, owner, target, tx, tz, t, dmg, dtype, splash, air, slowF: 0, slowT: 0, poison: 0, burn: 0, burnT: 0, shred: 0, mortel: 0, heroXp: hero };
  }

  private flightTicks(x: number, z: number, tx: number, tz: number, speed: number) {
    const dx = tx - x, dz = tz - z;
    return Math.max(1, Math.round((Math.sqrt(dx * dx + dz * dz) / speed) * TICK_RATE));
  }

  /** Position prévue d'un ennemi dans `ticks` ticks. */
  private predict(e: Enemy, ticks: number, out: { x: number; z: number }) {
    if (e.fighting || e.stunT > 0) { out.x = e.x; out.z = e.z; return out; }
    const d = e.dist + this.enemySpeed(e) * ticks * DT * (e.fleeing ? -1 : 1);
    return this.pathOf(e).at(Math.max(0, d), e.lane, out);
  }

  private enemySpeed(e: Enemy) {
    let s = e.def.speed * e.slowMul;
    if (e.def.ab.enrage && e.hp < e.maxHp * e.def.ab.enrage.threshold) s *= e.def.ab.enrage.speedMul;
    if (e.burrowed) s *= 1.3;
    if (e.fleeing) s *= e.def.ab.thief?.flee ?? 1;
    if (this.mutations.includes(MUTATION_INDEX.rapides)) s *= 1.25;
    return s;
  }

  private fireTower(t: Tower, lvl: TowerLevel, target: Enemy) {
    const pk = this.perk(t.owner);
    const dmg = this.rollDmg(lvl.dmg[0], lvl.dmg[1]) * (1 + pk.dmg[t.fi] + t.auraDmg);
    const splash = (lvl.splash ?? 0) * (1 + pk.splash);
    if (lvl.proj === 'tesla') {
      const chainN = (lvl.chain ?? 1) + (t.level === 4 ? lvl.skills![0].values[t.sk[0] - 1] ?? 0 : 0);
      const hit: Enemy[] = [];
      const pts: number[] = [];
      let cur: Enemy | null = target;
      let d = dmg;
      while (cur && hit.length < chainN) {
        hit.push(cur);
        pts.push(cur.x, cur.z);
        this.damage(cur, d, lvl.dmgType, t.owner, null);
        d *= 0.8;
        let next: Enemy | null = null, best = 2.8 * 2.8;
        for (const e of this.enemies) {
          if (!this.targetable(e, true) || hit.includes(e)) continue;
          const dx = e.x - cur.x, dz = e.z - cur.z;
          const dd = dx * dx + dz * dz;
          if (dd < best) { best = dd; next = e; }
        }
        cur = next;
      }
      this.ev(Ev.Chain, t.id, hit.length, ...pts);
      return;
    }
    const kind = PROJ_KINDS.indexOf(lvl.proj);
    let tx = target.x, tz = target.z;
    let flight = this.flightTicks(t.x, t.z, tx, tz, lvl.projSpeed);
    if (lvl.splash) {
      this.predict(target, flight, tmp);
      tx = tmp.x; tz = tmp.z;
      flight = this.flightTicks(t.x, t.z, tx, tz, lvl.projSpeed);
    }
    const p = this.mkProj(kind, t, t.owner, lvl.splash ? null : target, tx, tz, flight, dmg, lvl.dmgType, splash, lvl.hitsAir, null);
    if (lvl.slow) { p.slowF = lvl.slow[0]; p.slowT = sec(lvl.slow[1]); }
    if (lvl.burn) { p.burn = lvl.burn[0]; p.burnT = sec(lvl.burn[1]); }
    if (t.level >= 3 && lvl.skills) {
      const r0 = t.sk[0], r1 = t.sk[1];
      const s0 = lvl.skills[0], s1 = lvl.skills[1];
      if (s0.id === 'mortel' && r0) p.mortel = s0.values[r0 - 1];
      if (s0.id === 'poison' && r0) p.poison = s0.values[r0 - 1];
      if (s1.id === 'percant' && r1) p.shred = s1.values[r1 - 1];
      if (s0.id === 'napalm' && r0) p.burn += s0.values[r0 - 1];
    }
    this.projs.push(p);
    this.ev(Ev.Fire, kind, Src.Tower, t.id, p.target ? p.target.id : 0xffff, tx, tz, flight);
  }

  private resolveProj(p: Proj) {
    if (p.splash > 0) {
      const near = this.enemiesIn(p.tx, p.tz, p.splash, p.air);
      for (const e of near) this.applyHit(p, e, true);
      const kind = p.kind === FIRE_METEOR ? Impact.Meteor : p.kind === PROJ_KINDS.indexOf('fireshell') ? Impact.FireShell : p.kind === FIRE_FRAG ? Impact.Frag : Impact.Shell;
      this.ev(Ev.Impact, kind, p.tx, p.tz, Math.round(p.splash * 10));
      if (p.burn > 0 || p.kind === FIRE_METEOR) {
        this.zones.push({ kind: Impact.FireShell, x: p.tx, z: p.tz, r: p.splash * 0.85, t: p.burnT || sec(3), dps: p.burn || 12, dtype: DmgType.True, owner: p.owner, air: false, slow: 0 });
      }
      return;
    }
    const e = p.target;
    if (!e || e.dead || e.burrowed) return;
    this.applyHit(p, e, false);
  }

  private applyHit(p: Proj, e: Enemy, aoe: boolean) {
    // flèche ou carreau sur du plomb : ni poison ni tir mortel (les dégâts ricochent presque tous)
    const lead = !aoe && p.dtype === DmgType.Phys && (e.traits & Trait.Lead) !== 0;
    if (p.mortel && !lead && !e.def.boss && this.rng.next() < p.mortel) {
      this.damage(e, e.hp + 1, DmgType.True, p.owner, p.heroXp, 2);
      return;
    }
    let dmg = p.dmg;
    let flags = 0;
    // pluie : le givre mord davantage (dégâts et ralentissement des tirs de givre)
    const wet = this.rain && p.slowF > 0;
    if (wet) dmg *= RAIN_FROST;
    if (p.heroXp) { const k = this.heroCrit(p.heroXp); if (k > 1) { dmg *= k; flags = 1; } }
    const dealt = this.damage(e, dmg, p.dtype, p.owner, p.heroXp, flags, aoe && dmg < 10, aoe);
    if (p.heroXp && p.heroXp.pas.has('vampire')) p.heroXp.u.hp = Math.min(p.heroXp.u.maxHp, p.heroXp.u.hp + dealt * 0.2);
    if (e.dead) return;
    if (p.slowF) { e.slowMul = Math.min(e.slowMul, 1 - Math.min(0.85, p.slowF * (wet ? RAIN_FROST : 1))); e.slowT = Math.max(e.slowT, p.slowT); }
    if (p.poison && !lead) { e.poisonDps = p.poison; e.poisonT = sec(4); }
    if (p.shred) { e.shred = p.shred; e.shredT = sec(4); }
  }

  // ------------------------------------------------------------ boucle

  step() {
    if (this.state === GameState.Won || this.state === GameState.Lost) {
      this.tick++;
      return;
    }
    this.stepWaves();
    this.stepSupport();
    this.stepEnemies();
    this.stepUnits();
    this.stepTowers();
    this.stepProjectiles();
    this.stepZones();
    this.stepProps();
    this.cleanup();
    this.stepCooldowns();
    this.checkEnd();
    this.tick++;
  }

  private stepWaves() {
    while (this.spawnQ.length && this.spawnQ[0].tick <= this.tick) {
      const s = this.spawnQ.shift()!;
      this.spawnEnemy(s.type, s.path, s.hpMul, s.lane, 0, s.traits);
    }
    if (this.waveSpawning && this.spawnQ.length === 0) {
      this.waveSpawning = false;
      if (!this.level || this.waveIdx < this.totalWaves) {
        this.nextWaveT = sec(this.level ? BALANCE.waveGap : BALANCE.survivalWaveGap);
      }
    }
    if (this.nextWaveT > 0) {
      this.nextWaveT--;
      if (this.nextWaveT === 0) this.startWave();
    }
  }

  /** Campements (bonus des tours voisines, marquage) et repérage des camouflés. */
  private stepSupport() {
    for (const t of this.towers) { t.auraRange = 0; t.auraRate = 0; t.auraDmg = 0; }
    let watch = false, camo = false;
    for (const c of this.towers) {
      if (c.fam !== 'camp') continue;
      if (c.level === 3) watch = true;
      const cp = this.perk(c.owner);
      const a = campAura(c.level, c.sk, cp.campAura, cp.campRange);
      const r2 = a.r * a.r;
      for (const t of this.towers) {
        if (t === c || t.fam === 'mine' || t.fam === 'camp') continue;
        const dx = t.x - c.x, dz = t.z - c.z;
        if (dx * dx + dz * dz > r2) continue;
        t.auraRange = Math.max(t.auraRange, a.range);
        t.auraRate = Math.max(t.auraRate, a.rate);
        t.auraDmg = Math.max(t.auraDmg, a.dmg);
      }
    }
    for (const b of this.blessings) {
      const r2 = b.r * b.r;
      for (const t of this.towers) {
        const dx = t.x - b.x, dz = t.z - b.z;
        if (dx * dx + dz * dz > r2) continue;
        t.auraRate = Math.max(t.auraRate, b.rate);
        t.auraDmg = Math.max(t.auraDmg, b.dmg);
      }
    }
    for (const e of this.enemies) { e.marked = e.curseT > 0 ? e.curse : 0; e.revealed = false; if (e.traits & Trait.Camo) camo = true; }
    if (!watch && !camo) return;
    for (const t of this.towers) {
      const detect = t.fam === 'mage' || (t.fam === 'camp' && t.level === 3);
      if (!detect) continue;
      const tp = this.perk(t.owner);
      const mark = t.fam === 'camp' ? campAura(t.level, t.sk, tp.campAura).mark : 0;
      if (!mark && !camo) continue;
      const r = t.fam === 'mage' ? TOWERS.mage[t.level].range * (1 + (tp.range[2] ?? 0)) : TOWERS.camp[t.level].range * (1 + tp.campRange);
      const r2 = r * r;
      for (const e of this.enemies) {
        const dx = e.x - t.x, dz = e.z - t.z;
        if (dx * dx + dz * dz > r2) continue;
        e.revealed = true;
        if (mark > e.marked) e.marked = mark;
      }
    }
    if (!camo) return;
    for (const h of this.heroes) {
      if (h.u.dead) continue;
      const r2 = this.heroDetect(h) ** 2;
      for (const e of this.enemies) {
        if (e.revealed || !(e.traits & Trait.Camo)) continue;
        const dx = e.x - h.u.x, dz = e.z - h.u.z;
        if (dx * dx + dz * dz <= r2) e.revealed = true;
      }
    }
  }

  /** Rayon où un héros repère les ennemis camouflés. */
  private heroDetect(h: Hero) {
    return h.pas.has('clairvoyance') ? 6.5 : HERO_DETECT;
  }

  /** Coup critique d'un héros (passifs Riposte, Œil perçant) : multiplicateur des dégâts (1 : pas de critique). */
  private heroCrit(h: Hero) {
    if (!(h.pas.has('riposte') || h.pas.has('oeil')) || this.rng.next() >= 0.2) return 1;
    return h.pas.has('execution') ? 3 : 2;
  }

  /** Auras des héros sur les soldats proches (r = 4) : dégâts subis, dégâts infligés. */
  private soldierAura(u: Unit, kind: 'def' | 'atk') {
    let m = 1;
    for (const h of this.heroes) {
      if (h.u.dead || h.u === u) continue;
      const dx = h.u.x - u.x, dz = h.u.z - u.z;
      if (dx * dx + dz * dz >= 16) continue;
      if (kind === 'def') {
        if (h.pas.has('vaillant')) m *= 0.85;
        if (h.pas.has('garde')) m *= 0.8;
      } else if (h.pas.has('inspiration')) m *= 1.25;
    }
    return m;
  }

  /** Un soldat est-il près d'un héros à Présence apaisante ? */
  private soothed(u: Unit) {
    for (const h of this.heroes) {
      if (h.u.dead || !h.pas.has('soin')) continue;
      const dx = h.u.x - u.x, dz = h.u.z - u.z;
      if (dx * dx + dz * dz < 16) return true;
    }
    return false;
  }

  /** Effets des passifs sur un coup de mêlée du héros (Brûlure, Toucher glacé). */
  private heroOnHit(h: Hero, e: Enemy) {
    if (h.pas.has('givre')) { e.slowMul = Math.min(e.slowMul, 0.7); e.slowT = Math.max(e.slowT, sec(1.5)); }
    if (h.pas.has('brulure')) { e.poisonDps = (h.u.dmgMin + h.u.dmgMax) * 0.15; e.poisonT = sec(4); }
    if (h.pas.has('saignement') || h.pas.has('venin') || h.pas.has('contagion')) { e.poisonDps = Math.max(e.poisonT > 0 ? e.poisonDps : 0, (h.u.dmgMin + h.u.dmgMax) * 0.15); e.poisonT = sec(4); }
    if (h.pas.has('lourd')) { e.shred = Math.max(e.shred, 0.25); e.shredT = sec(4); }
    if (h.pas.has('commotion') && this.rng.next() < 0.15) e.stunT = Math.max(e.stunT, sec(e.def.boss ? 0.3 : 1));
  }

  /** Multiplicateur de dégâts d'attaque du héros selon ses passifs (Fureur, Chasseur de volants). */
  private heroDmgMul(h: Hero, e: Enemy) {
    let m = 1;
    if (h.pas.has('fureur') && h.u.hp < h.u.maxHp * 0.5) m *= 1.3;
    if (h.pas.has('chasseur') && e.flying) m *= 1.4;
    return m;
  }

  private stepEnemies() {
    // boucliers
    for (const e of this.enemies) e.shielded = false;
    for (const s of this.enemies) {
      const sh = s.def.ab.shield;
      if (!sh || s.dead) continue;
      const r2 = sh.radius * sh.radius;
      for (const e of this.enemies) {
        if (e === s) continue;
        const dx = e.x - s.x, dz = e.z - s.z;
        if (dx * dx + dz * dz < r2) e.shielded = true;
      }
    }
    const regenMut = this.mutations.includes(MUTATION_INDEX.regen);
    const count = this.enemies.length;
    for (let i = 0; i < count; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const ab = e.def.ab;
      // statuts
      if (e.slowT > 0 && --e.slowT === 0) e.slowMul = 1;
      if (e.shredT > 0 && --e.shredT === 0) e.shred = 0;
      if (e.curseT > 0 && --e.curseT === 0) e.curse = 0;
      if (e.poisonT > 0) { e.poisonT--; this.damage(e, e.poisonDps * DT, DmgType.True, e.hitBy, null, 0, true); }
      if (e.burnT > 0) {
        // la pluie éteint les feux : brûlure deux fois moins forte et deux fois plus courte
        e.burnT = Math.max(0, e.burnT - (this.rain ? 2 : 1));
        this.damage(e, e.burnDps * DT * (this.rain ? RAIN_FIRE : 1), DmgType.True, e.hitBy, null, 0, true);
      }
      if (e.dead) continue;
      if (ab.regen) e.hp = Math.min(e.maxHp, e.hp + ab.regen * e.hpScale * DT);
      if (e.traits & Trait.Regrow) {
        if (e.quietT > 0) e.quietT--;
        else e.hp = Math.min(e.maxHp, e.hp + e.maxHp * REGROW_RATE * DT);
      }
      if (regenMut) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * DT);
      // compétences
      if (ab.heal && --e.abT <= 0) {
        e.abT = sec(ab.heal.cd);
        const r2 = ab.heal.radius * ab.heal.radius;
        for (const o of this.enemies) {
          const dx = o.x - e.x, dz = o.z - e.z;
          if (!o.dead && dx * dx + dz * dz < r2) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ab.heal.pct);
        }
        this.ev(Ev.Heal, e.x, e.z);
      }
      if (ab.stunTowers && --e.ab2T <= 0) {
        e.ab2T = sec(ab.stunTowers.cd);
        const r2 = ab.stunTowers.range * ab.stunTowers.range;
        const cands = this.towers.filter((t) => t.fam !== 'barracks' && t.stunT === 0 && (t.x - e.x) * (t.x - e.x) + (t.z - e.z) * (t.z - e.z) < r2);
        if (cands.length) {
          const t = cands[Math.floor(this.rng.next() * cands.length)];
          t.stunT = sec(ab.stunTowers.dur);
          this.ev(Ev.Stun, t.id, t.stunT);
        }
      }
      if (ab.summon && --e.ab3T <= 0) {
        e.ab3T = sec(ab.summon.cd);
        const st = ENEMY_INDEX[ab.summon.type];
        const hpScale = this.scaling.hpMul * (ENEMIES[st].boss ? 1 : 1);
        for (let k = 0; k < ab.summon.count; k++) {
          const lane = (this.rng.next() * 2 - 1) * 0.8;
          this.spawnEnemy(st, e.path, hpScale, lane, Math.max(0.6, e.dist - 0.3 - k * 0.5));
        }
      }
      if (ab.burrow && --e.burrowT <= 0) {
        e.burrowed = !e.burrowed;
        e.burrowT = sec(e.burrowed ? ab.burrow.down : ab.burrow.up);
        if (e.burrowed) for (const u of [...e.blockers]) this.release(u);
      }
      if (e.stunT > 0) { e.stunT--; e.fighting = false; this.pathOf(e).at(e.dist, e.lane, tmp); e.x = tmp.x; e.z = tmp.z; continue; }
      // combat
      e.fighting = false;
      let foe: Unit | null = null;
      if (!e.flying && !e.burrowed && e.blockers.length) {
        // allonge proportionnelle à la taille : un bloqueur posté contre un gros ennemi reste à portée
        const reach = Math.max(1.38, 0.95 + e.def.size * 0.3);
        const r2 = reach * reach;
        for (const u of e.blockers) {
          const dx = u.x - e.x, dz = u.z - e.z;
          if (dx * dx + dz * dz >= r2) continue;
          // un héros au contact attire les coups, même s'il attaque un ennemi déjà bloqué par des soldats
          if (u.hero) { foe = u; break; }
          if (!foe) foe = u;
        }
      }
      if (foe) {
        e.fighting = true;
        if (ab.kamikaze) {
          for (const u of this.units) {
            if (u.dead) continue;
            const dx = u.x - e.x, dz = u.z - e.z;
            if (dx * dx + dz * dz < ab.kamikaze.radius * ab.kamikaze.radius) this.hurtUnit(u, ab.kamikaze.dmg);
          }
          this.ev(Ev.Impact, Impact.Kamikaze, e.x, e.z, Math.round(ab.kamikaze.radius * 10));
          this.damage(e, e.hp + 1, DmgType.True, foe.owner, foe.hero, 0, true);
          continue;
        }
        if (--e.atkT <= 0) {
          e.atkT = sec(e.def.atkCd);
          const dmg = this.rollDmg(e.def.dmg[0], e.def.dmg[1]);
          if (ab.cleave) {
            const r2 = ab.cleave * ab.cleave;
            for (const u of this.units) {
              if (u.dead) continue;
              const dx = u.x - foe.x, dz = u.z - foe.z;
              if (dx * dx + dz * dz < r2) this.hurtUnit(u, dmg, e);
            }
          } else this.hurtUnit(foe, dmg, e);
        }
      } else {
        // déplacement
        if (e.fleeing) {
          e.dist -= this.enemySpeed(e) * DT;
          if (e.dist <= 0.6) {
            // le chapardeur s'échappe par où il est venu : l'or est perdu (aucune vie en moins)
            e.dead = true;
            this.ev(Ev.Escape, e.id, e.victim < 0 ? 255 : e.victim, e.loot);
            for (const u of [...e.blockers]) this.release(u);
            continue;
          }
          this.pathOf(e).at(e.dist, e.lane, tmp);
          e.x = tmp.x;
          e.z = tmp.z;
          continue;
        }
        e.dist += this.enemySpeed(e) * DT;
        const path = this.pathOf(e);
        if (ab.thief && e.dist >= path.length * ab.thief.at) {
          this.steal(e, ab.thief);
          continue;
        }
        if (e.dist >= path.length) {
          e.dead = true;
          // en survie, un boss qui passe coûte cher mais ne termine pas la partie d'un coup
          const cost = this.level ? e.def.lives : Math.min(e.def.lives, 5);
          this.lives = Math.max(0, this.lives - cost);
          this.ev(Ev.Leak, e.id, cost);
          for (const u of [...e.blockers]) this.release(u);
          continue;
        }
      }
      this.pathOf(e).at(e.dist, e.lane, tmp);
      e.x = tmp.x;
      e.z = tmp.z;
    }
  }

  /** Le chapardeur vole le joueur actif le plus riche, puis fait demi-tour. */
  private steal(e: Enemy, th: NonNullable<EnemyDef['ab']['thief']>) {
    let v: PlayerState | null = null;
    for (const p of this.players) if (p.active && (!v || p.gold > v.gold)) v = p;
    const g = v ? Math.min(th.max, Math.floor(v.gold * th.pct), Math.floor(v.gold)) : 0;
    if (v) v.gold -= g;
    e.loot = g;
    e.victim = v ? v.id : -1;
    e.fleeing = true;
    for (const u of [...e.blockers]) this.release(u);
    this.ev(Ev.Steal, e.id, v ? v.id : 255, g);
  }

  private hurtUnit(u: Unit, dmg: number, src: Enemy | null = null) {
    if (u.dead) return;
    let d = dmg * (1 - Math.min(0.85, u.armor));
    // auras des héros (Cœur vaillant, Garde rapprochée)
    if (u.kind !== HERO_UNIT) d *= this.soldierAura(u, 'def');
    // Épines : renvoie une part des coups de mêlée
    if (src && u.hero && u.hero.pas.has('epines') && !src.dead) this.damage(src, d * 0.25, DmgType.True, u.owner, u.hero, 0, true);
    if (u.shield > 0) {
      const a = Math.min(u.shield, d);
      u.shield -= a;
      d -= a;
    }
    u.hp -= d;
    if (u.hp <= 0) this.killUnit(u);
  }

  private killUnit(u: Unit) {
    this.release(u);
    u.focus = null;
    u.dead = true;
    u.hp = 0;
    u.shield = 0;
    this.ev(Ev.UnitDeath, u.x, u.z);
    if (u.hero) {
      u.respawnT = sec(HERO_RESPAWN_S);
      this.ev(Ev.HeroDeath, u.owner);
    } else if (u.tower) {
      const sd = TOWERS[u.tower.fam][u.tower.level].soldiers!;
      u.respawnT = Math.max(1, sec(sd.respawn * (1 - this.perk(u.owner).soldierRespawn)));
    } else u.life = 0;
  }

  private stepUnits() {
    const near: Enemy[] = [];
    for (const u of this.units) {
      if (u.life > 0 && --u.life === 0) { this.release(u); u.dead = true; continue; }
      if (u.dead) {
        if (u.life === 0) continue;
        if (u.respawnT > 0 && --u.respawnT === 0) {
          u.dead = false;
          u.hp = u.maxHp;
          if (u.hero) {
            u.x = this.map.heroSpawn.x; u.z = this.map.heroSpawn.z;
            u.hx = u.x; u.hz = u.z;
          } else if (u.tower) { u.x = u.tower.x; u.z = u.tower.z; }
        }
        continue;
      }
      if (u.buffT > 0) u.buffT--;
      const t = u.tower;
      // cible imposée (héros) : la mêlée va au contact, le tir s'approche juste à portée
      if (u.focus) {
        const f = u.focus;
        if (!this.targetable(f, u.range > 0) || (u.range <= 0 && f.flying) || !this.visible(f)) {
          u.focus = null;
          u.hx = u.x; u.hz = u.z;
          u.moving = false;
        } else if (u.range > 0) {
          if (u.target) this.release(u);
          const dx = u.x - f.x, dz = u.z - f.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          if (d > u.range * 0.92) {
            // point d'approche : sur la ligne qui mène à la cible, un peu en deçà de la portée
            const want = u.range * 0.8;
            u.hx = f.x + (dx / d) * want;
            u.hz = f.z + (dz / d) * want;
            u.moving = true;
          } else if (u.moving) {
            u.hx = u.x; u.hz = u.z;
            u.moving = false;
          }
        } else {
          if (u.target !== f) { this.release(u); this.engage(u, f); }
          u.hx = f.x; u.hz = f.z;
        }
      }
      // validité de la cible
      if (u.target && (u.target.dead || u.target.burrowed || u.target.flying)) this.release(u);
      if (u.target) {
        const dx = u.target.x - u.hx, dz = u.target.z - u.hz;
        const leash = u.hero ? 5 : 4;
        if (dx * dx + dz * dz > leash * leash) this.release(u);
      }
      // acquisition
      if (!u.target && !u.moving && !u.focus && u.speed > 0) {
        const r = u.hero ? 2.8 : t ? 2.6 : 2.4;
        const r2 = r * r;
        let best: Enemy | null = null;
        let bestScore = Infinity;
        for (const e of this.enemies) {
          if (e.dead || e.flying || e.burrowed || e.dist < 0.5 || !this.visible(e)) continue;
          const dx = e.x - u.hx, dz = e.z - u.hz;
          const d2 = dx * dx + dz * dz;
          if (d2 > r2) continue;
          const score = d2 + e.blockers.length * 6;
          if (score < bestScore) { bestScore = score; best = e; }
        }
        if (best) this.engage(u, best);
      }
      // retenir des ennemis supplémentaires : compétence Provocation, et tout héros au contact
      // (un héros posé au milieu du chemin arrête aussi ceux qui le frôlent, et prend leurs coups)
      const holds = u.hero ? HERO_EXTRA_HOLD : t && t.level === 3 && t.sk[1] > 0 ? TOWERS.barracks[3].skills![1].values[t.sk[1] - 1] : 0;
      if (holds > 0 && u.target) {
        const cap = holds;
        for (let k = u.extra.length - 1; k >= 0; k--) {
          const e = u.extra[k];
          if (e.dead || e.burrowed || e.flying) { u.extra.splice(k, 1); const j = e.blockers.indexOf(u); if (j >= 0) e.blockers.splice(j, 1); }
        }
        if (u.extra.length < cap) {
          for (const e of this.enemies) {
            if (u.extra.length >= cap) break;
            if (e === u.target || e.dead || e.flying || e.burrowed || e.blockers.length || !this.visible(e)) continue;
            const dx = e.x - u.x, dz = e.z - u.z;
            if (dx * dx + dz * dz < 3.2) { u.extra.push(e); e.blockers.push(u); }
          }
        }
      }
      // déplacement
      let gx = u.hx, gz = u.hz;
      if (u.target) {
        const e = u.target;
        let dx = u.x - e.x, dz = u.z - e.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= d; dz /= d;
        const reach = 0.75 + e.def.size * 0.25;
        gx = e.x + dx * reach;
        gz = e.z + dz * reach;
      }
      if (u.speed > 0) {
        // les unités contournent l'eau, le décor solide et les tours ; une destination dedans est ramenée au bord
        const goal = this.tmpGoal;
        goal.x = gx; goal.z = gz;
        if (this.pushOut(goal) && !u.target) { u.hx = goal.x; u.hz = goal.z; }
        if (this.walk(u, goal.x, goal.z, u.speed * DT) && u.moving) u.moving = false;
      }
      // attaque de mêlée
      u.fighting = false;
      if (u.cdT > 0) u.cdT--;
      if (u.target) {
        const e = u.target;
        const dx = e.x - u.x, dz = e.z - u.z;
        const reach = 1.05 + e.def.size * 0.3;
        if (dx * dx + dz * dz <= reach * reach) {
          u.fighting = true;
          if (u.cdT <= 0) {
            u.cdT = u.cdTicks;
            let dmg = this.rollDmg(u.dmgMin, u.dmgMax) * (u.buffT > 0 ? 1.5 : 1) * (1 + (t ? t.auraDmg : 0));
            let flags = 0;
            if (t && t.level === 4 && t.sk[1] > 0 && this.rng.next() < TOWERS.barracks[4].skills![1].values[t.sk[1] - 1]) { dmg *= 2; flags = 1; }
            if (u.hero) { const k = this.heroCrit(u.hero); if (k > 1) { dmg *= k; flags = 1; } dmg *= this.heroDmgMul(u.hero, e); }
            else if (u.kind !== HERO_UNIT) dmg *= this.soldierAura(u, 'atk');
            const dealt = this.damage(e, dmg, u.hero ? u.hero.base.dmgType : DmgType.Phys, u.owner, u.hero, flags);
            if (u.hero && u.hero.pas.has('vampire')) u.hp = Math.min(u.maxHp, u.hp + dealt * 0.2);
            if (u.hero && !e.dead) this.heroOnHit(u.hero, e);
          }
        }
      }
      // tir à distance (héros à distance, tourelle)
      if (!u.fighting && u.range > 0 && u.cdT <= 0 && !u.moving) {
        let tgt: Enemy | null;
        if (u.focus) {
          const dx = u.focus.x - u.x, dz = u.focus.z - u.z;
          tgt = dx * dx + dz * dz <= u.range * u.range ? u.focus : null;
        } else tgt = this.findTarget(u.x, u.z, u.range, true);
        if (tgt) {
          u.cdT = u.cdTicks;
          const h = u.hero;
          const flask = !!h && h.pas.has('instable');
          const kind = h ? (flask ? PROJ_KINDS.indexOf('shell') : h.base.dmgType === DmgType.Magic || h.cls?.id === 'artificier' ? FIRE_HERO_BOLT : FIRE_HERO_ARROW) : FIRE_TURRET;
          const shoot = (tg: Enemy) => {
            const flight = this.flightTicks(u.x, u.z, tg.x, tg.z, flask ? 11 : 16);
            const dmg = this.rollDmg(u.dmgMin, u.dmgMax) * (u.buffT > 0 ? 1.5 : 1) * (h ? this.heroDmgMul(h, tg) : 1);
            const pr = this.mkProj(kind, null, u.owner, flask ? null : tg, tg.x, tg.z, flight, dmg, h ? h.base.dmgType : DmgType.Phys, flask ? 1.2 : 0, true, h);
            if (h) {
              if (h.pas.has('tirmortel')) pr.mortel = 0.06;
              if (h.pas.has('givre')) { pr.slowF = 0.3; pr.slowT = sec(1.5); }
              if (h.pas.has('brulure')) pr.poison = dmg * 0.3;
              if (h.pas.has('venin') || h.pas.has('contagion') || h.pas.has('saignement')) pr.poison = Math.max(pr.poison, dmg * 0.3);
              if (h.pas.has('lourd')) pr.shred = 0.25;
            }
            this.projs.push(pr);
            this.ev(Ev.Fire, kind, h ? Src.Hero : Src.Unit, h ? u.owner : u.id & 0xffff, tg.id, tg.x, tg.z, flight);
          };
          shoot(tgt);
          if (h && h.pas.has('multi')) {
            const t2 = this.findTarget(u.x, u.z, u.range, true, tgt);
            if (t2) shoot(t2);
          }
        }
      }
      // régénération hors combat
      if (!u.target && u.hp < u.maxHp && u.regen > 0) u.hp = Math.min(u.maxHp, u.hp + u.regen * DT);
      // Présence apaisante : les soldats proches d'un gardien se soignent même en combat
      if (u.kind !== HERO_UNIT && u.hp < u.maxHp && this.soothed(u)) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.02 * DT);
    }
  }

  private stepTowers() {
    const near: Enemy[] = [];
    for (const t of this.towers) {
      if (t.fam === 'mine' || t.fam === 'camp') continue;
      if (t.stunT > 0) { t.stunT--; continue; }
      const lvl = TOWERS[t.fam][t.level];
      const s0 = t.level >= 3 ? t.sk[0] : 0;
      const s1 = t.level >= 3 ? t.sk[1] : 0;
      const pk = this.perk(t.owner);
      let range = lvl.range * (1 + pk.range[t.fi] + t.auraRange);
      if (t.fam === 'archer' && t.level === 3 && s1) range += lvl.skills![1].values[s1 - 1];
      // la nuit, les archers loin d'une torche ou d'un campement voient moins loin
      if (t.fam === 'archer' && this.night && !this.lit(t.x, t.z)) range *= NIGHT_RANGE;
      if (t.fam === 'barracks') {
        // Rôdeurs : bond
        if (t.level === 4 && s0 && --t.s1T <= 0) {
          let best: Enemy | null = null;
          for (const e of this.enemiesIn(t.rallyX, t.rallyZ, range + 1.5, false, near)) if (this.visible(e) && (!best || e.hp > best.hp)) best = e;
          const u = t.units.find((u) => !u.dead);
          if (best && u) {
            t.s1T = sec(9);
            this.release(u);
            u.x = best.x + 0.6; u.z = best.z;
            this.engage(u, best);
            this.damage(best, lvl.skills![0].values[s0 - 1], DmgType.Phys, t.owner, null, 1);
            this.ev(Ev.Skill, t.id, 0);
          } else t.s1T = sec(1);
        }
        continue;
      }
      // compétences périodiques
      if (t.level >= 3 && lvl.skills) {
        const sk0 = lvl.skills[0], sk1 = lvl.skills[1];
        if (sk1.id === 'rafale' && s1 && --t.s2T <= 0) {
          const targets = this.enemiesIn(t.x, t.z, range, true, near).filter((e) => this.visible(e));
          if (targets.length) {
            t.s2T = sec(8);
            const n = sk1.values[s1 - 1];
            for (let k = 0; k < n; k++) {
              const e = targets[k % targets.length];
              const flight = this.flightTicks(t.x, t.z, e.x, e.z, 22);
              const p = this.mkProj(0, t, t.owner, e, e.x, e.z, flight, this.rollDmg(lvl.dmg[0], lvl.dmg[1]) * (1 + pk.dmg[t.fi] + t.auraDmg), DmgType.Phys, 0, true, null);
              if (s0) p.poison = sk0.values[s0 - 1];
              this.projs.push(p);
              this.ev(Ev.Fire, 0, Src.Tower, t.id, e.id, e.x, e.z, flight);
            }
            this.ev(Ev.Skill, t.id, 1);
          } else t.s2T = sec(1);
        }
        if (sk0.id === 'desint' && s0 && --t.s1T <= 0) {
          const e = this.findTarget(t.x, t.z, range, true, null, t.prio);
          if (e) {
            t.s1T = sec(sk0.values[s0 - 1]);
            this.ev(Ev.Impact, Impact.Arcane, e.x, e.z, 10);
            if (e.def.boss) this.damage(e, 400, DmgType.True, t.owner, null, 2);
            else this.damage(e, e.hp + 1, DmgType.True, t.owner, null, 2);
            this.ev(Ev.Skill, t.id, 0);
          } else t.s1T = sec(1);
        }
        if (sk1.id === 'teleport' && s1 && --t.s2T <= 0) {
          const list = this.enemiesIn(t.x, t.z, range, true, near).filter((e) => !e.def.boss && this.visible(e));
          if (list.length) {
            t.s2T = sec(10);
            list.sort((a, b) => this.remaining(a) - this.remaining(b));
            for (const e of list.slice(0, sk1.values[s1 - 1])) {
              for (const u of [...e.blockers]) this.release(u);
              e.dist = Math.max(0.6, e.dist - 6);
              this.pathOf(e).at(e.dist, e.lane, tmp);
              e.x = tmp.x; e.z = tmp.z;
              this.ev(Ev.Teleport, e.id, e.x, e.z);
            }
            this.ev(Ev.Skill, t.id, 1);
          } else t.s2T = sec(1);
        }
        if (sk0.id === 'blizzard' && s0 && --t.s1T <= 0) {
          const e = this.findTarget(t.x, t.z, range, false, null, t.prio);
          if (e) {
            t.s1T = sec(12);
            for (const o of this.enemiesIn(e.x, e.z, 2.5, false, near)) o.stunT = Math.max(o.stunT, sec(sk0.values[s0 - 1]));
            this.ev(Ev.Impact, Impact.Frost, e.x, e.z, 25);
            this.ev(Ev.Skill, t.id, 0);
          } else t.s1T = sec(1);
        }
        if (sk1.id === 'frag' && s1 && --t.s2T <= 0) {
          const e = this.findTarget(t.x, t.z, range, false, null, t.prio);
          if (e) {
            t.s2T = sec(10);
            const n = sk1.values[s1 - 1];
            for (let k = 0; k < n; k++) {
              const tx = e.x + (this.rng.next() * 2 - 1) * 2, tz = e.z + (this.rng.next() * 2 - 1) * 2;
              const flight = this.flightTicks(t.x, t.z, tx, tz, 8) + k;
              this.projs.push(this.mkProj(FIRE_FRAG, t, t.owner, null, tx, tz, flight, 28, DmgType.Phys, 1.3, false, null));
              this.ev(Ev.Fire, FIRE_FRAG, Src.Tower, t.id, 0xffff, tx, tz, flight);
            }
            this.ev(Ev.Skill, t.id, 1);
          } else t.s2T = sec(1);
        }
        if (sk1.id === 'statique' && s1) {
          const dps = sk1.values[s1 - 1];
          for (const e of this.enemiesIn(t.x, t.z, 3.6, true, near)) this.damage(e, dps * DT, DmgType.Magic, t.owner, null, 0, true);
        }
      }
      // tir principal
      if (t.burstLeft > 0 && --t.burstT <= 0) {
        const tgt = t.aim && this.targetable(t.aim, true) && this.visible(t.aim) ? t.aim : this.findTarget(t.x, t.z, range, lvl.hitsAir, null, t.prio);
        if (tgt) this.fireTower(t, lvl, tgt);
        t.burstLeft--;
        t.burstT = 2;
      }
      if (t.cdT > 0) { t.cdT--; continue; }
      const tgt = this.findTarget(t.x, t.z, range, lvl.hitsAir, null, t.prio);
      t.aim = tgt;
      if (!tgt) continue;
      this.fireTower(t, lvl, tgt);
      t.cdT = sec(lvl.cooldown / (1 + pk.rate[t.fi] + t.auraRate));
      if (lvl.burst) { t.burstLeft = lvl.burst - 1; t.burstT = 2; }
    }
  }

  private stepProjectiles() {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.tz = p.target.z; }
      if (--p.t <= 0) {
        this.projs[i] = this.projs[this.projs.length - 1];
        this.projs.pop();
        this.resolveProj(p);
      }
    }
  }

  private stepZones() {
    const near: Enemy[] = [];
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      // pluie : les zones de feu faiblissent et s'éteignent plus vite, le blizzard redouble
      const fire = this.rain && (z.kind === Impact.FireShell || z.kind === Impact.Lava);
      const frost = this.rain && z.kind === Impact.Blizzard;
      const dps = z.dps * (fire ? RAIN_FIRE : frost ? RAIN_FROST : 1);
      const slow = frost ? Math.min(0.85, z.slow * RAIN_FROST) : z.slow;
      for (const e of this.enemiesIn(z.x, z.z, z.r, z.air, near)) {
        this.damage(e, dps * DT, z.dtype, z.owner, null, 0, true);
        if (slow) { e.slowMul = Math.min(e.slowMul, 1 - slow); e.slowT = Math.max(e.slowT, 2); }
      }
      if (fire) z.t--;
      if (--z.t <= 0) { this.zones[i] = this.zones[this.zones.length - 1]; this.zones.pop(); }
    }
    for (let i = this.blessings.length - 1; i >= 0; i--) if (--this.blessings[i].t <= 0) this.blessings.splice(i, 1);
  }

  private stepCooldowns() {
    for (const p of this.players) {
      if (p.spellCd[0] > 0) p.spellCd[0]--;
      if (p.spellCd[1] > 0) p.spellCd[1]--;
      if (p.itemCd > 0) p.itemCd--;
    }
    for (const h of this.heroes) for (let i = 0; i < 3; i++) if (h.cds[i] > 0) h.cds[i]--;
  }

  private cleanup() {
    let w = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.dead) this.enemies[w++] = e;
      else for (const u of [...e.blockers]) this.release(u);
    }
    this.enemies.length = w;
    w = 0;
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (!(u.dead && u.life === 0)) this.units[w++] = u;
    }
    this.units.length = w;
  }

  private checkEnd() {
    if (this.lives <= 0) {
      this.state = GameState.Lost;
      this.ev(Ev.GameEnd, 0);
      return;
    }
    if (this.level && this.waveIdx >= this.totalWaves && !this.waveSpawning && this.spawnQ.length === 0 && this.enemies.length === 0) {
      this.state = GameState.Won;
      this.ev(Ev.GameEnd, 1);
    }
  }

  // ------------------------------------------------------------ joueurs

  setConnected(pid: number, connected: boolean) {
    const p = this.player(pid);
    if (p) p.connected = connected;
  }

  /** Un joueur quitte définitivement : ses tours et son or sont répartis. */
  removePlayer(pid: number) {
    const p = this.player(pid);
    if (!p || !p.active) return;
    p.active = false;
    p.connected = false;
    const others = this.players.filter((q) => q.active);
    const hi = this.heroes.findIndex((h) => h.owner === pid);
    if (hi >= 0) {
      const h = this.heroes[hi];
      this.release(h.u);
      h.u.dead = true;
      h.u.life = 0;
      this.heroes.splice(hi, 1);
    }
    if (!others.length) return;
    const share = p.gold / others.length;
    for (const q of others) q.gold += share;
    p.gold = 0;
    let k = 0;
    for (const t of this.towers) {
      if (t.owner !== pid) continue;
      const q = others[k++ % others.length];
      t.owner = q.id;
      for (const u of t.units) u.owner = q.id;
    }
  }

  drainEvents(): number[][] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
