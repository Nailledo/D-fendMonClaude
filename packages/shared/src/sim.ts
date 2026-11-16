import { BALANCE, computeScaling, starsFor, type Scaling } from './balance';
import { DT, SELL_RATIO, TICK_RATE, UNDO_SELL_S, sec } from './constants';
import { ENEMIES, ENEMY_INDEX, type EnemyDef } from './data/enemies';
import { HEROES, HERO_MAX_LEVEL, HERO_RESPAWN_S, HERO_XP, SPELLS, type HeroDef } from './data/heroes';
import { LEVELS, SURVIVAL_START_GOLD, type LevelDef } from './data/levels';
import { LEVEL_SPEC_A, PROJ_KINDS, SoldierKind, TOWERS, type SoldierDef, type TowerLevel } from './data/towers';
import { buildRuntimeMap, type RuntimeMap } from './mapgen';
import { Rng } from './rng';
import { DmgType, FAMILIES, GameState, type Command, type Family, type GameConfig } from './types';
import { MUTATION_INDEX, genStoryWaves, genSurvivalWave, mutationsFor, type Wave } from './waves';

// ---------------------------------------------------------------- Événements

export const enum Ev {
  Fire = 1, // kind, srcType, srcId, targetId, tx, tz, flight
  Impact = 2, // kind, x, z, radius*10
  Death = 3, // enemyId, type, x, z
  Leak = 4, // enemyId, lives
  Build = 5, // towerId, slot
  Sell = 6, // slot, owner
  Upgrade = 7, // towerId
  Spell = 8, // kind, owner, x, z
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
}

export const enum Impact {
  Shell = 0, FireShell = 1, Meteor = 2, Frost = 3, Arcane = 4, Kamikaze = 5, Hammer = 6, Holy = 7,
  Drain = 8, Lava = 9, ArrowRain = 10, Dawn = 11, Charge = 12, Summon = 13, Turret = 14, Bolt = 15,
  Arrow = 16, Frag = 17, Teleport = 18, Rally = 19,
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
  lastBuy: number;
  s1T: number;
  s2T: number;
  x: number;
  z: number;
}

export interface Hero {
  owner: number;
  def: HeroDef;
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
}

export interface PlayerState {
  id: number;
  name: string;
  gold: number;
  active: boolean;
  connected: boolean;
  speedVote: 1 | 2;
  spellCd: [number, number];
  kills: number;
  damage: number;
  goldEarned: number;
}

const SOLDIER_SPEED = 2.6;
const FORMATION: [number, number][] = [[0, -0.75], [0.7, 0.45], [-0.7, 0.45], [0, 1.1], [1.2, -0.4], [-1.2, -0.4]];

const RENFORT: SoldierDef = { hp: 90, dmg: [3, 6], armor: 0.1, cooldown: 1, respawn: 0, regen: 0, kind: SoldierKind.Renfort, count: 2 };

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
  players: PlayerState[];
  towers: Tower[] = [];
  towerBySlot: (Tower | null)[];
  enemies: Enemy[] = [];
  units: Unit[] = [];
  heroes: Hero[] = [];
  projs: Proj[] = [];
  zones: Zone[] = [];
  spawnQ: SpawnEntry[] = [];
  events: number[][] = [];
  private storyWaves: Wave[] = [];
  private nextId = 1;
  private waveSpawning = false;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    const n = cfg.players.length;
    this.map = buildRuntimeMap(cfg.mapId, n);
    this.scaling = computeScaling(n, cfg.difficulty);
    this.level = cfg.mode === 'story' ? LEVELS.find((l) => l.mapId === cfg.mapId) ?? null : null;
    if (this.level) {
      this.storyWaves = genStoryWaves(this.level, this.map.paths.length);
      this.totalWaves = this.storyWaves.length;
    } else this.totalWaves = 0;
    this.lives = this.maxLives = this.scaling.lives;
    this.towerBySlot = this.map.slots.map(() => null);
    const startGold = Math.round((this.level ? this.level.startGold : SURVIVAL_START_GOLD) * this.scaling.startGoldMul);
    this.players = cfg.players.map((p) => ({
      id: p.id, name: p.name, gold: startGold, active: true, connected: true, speedVote: 1 as 1 | 2,
      spellCd: [0, 0] as [number, number], kills: 0, damage: 0, goldEarned: 0,
    }));
    const sp = this.map.heroSpawn;
    cfg.players.forEach((p, i) => {
      const def = HEROES[p.hero] ?? HEROES.samuel;
      const ox = (i % 2 === 0 ? -1 : 1) * 0.9 * (i < 2 ? 1 : 2);
      const u = this.newUnit(HERO_UNIT, p.id, sp.x + ox, sp.z + (i >= 2 ? 1 : 0), def.hp, def.dmg[0], def.dmg[1], def.armor, def.cooldown, def.regen, null, -1);
      u.speed = def.speed;
      u.range = def.range;
      u.rangedType = def.dmgType;
      const h: Hero = { owner: p.id, def, u, level: 1, xp: 0, cds: [0, 0, 0] };
      u.hero = h;
      this.heroes.push(h);
    });
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
      target: null, extra: [], dead: false, respawnT: 0, life, buffT: 0, shield: 0, range: 0, rangedType: DmgType.Phys,
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
    return this.pathOf(e).length - e.dist;
  }

  private targetable(e: Enemy, air: boolean) {
    return !e.dead && !e.burrowed && (air || !e.flying) && e.dist > 0.5;
  }

  /** Ennemi le plus avancé dans le rayon. */
  private findTarget(x: number, z: number, r: number, air: boolean, exclude?: Enemy | null): Enemy | null {
    const r2 = r * r;
    let best: Enemy | null = null;
    let bestRem = Infinity;
    for (const e of this.enemies) {
      if (e === exclude || !this.targetable(e, air)) continue;
      const dx = e.x - x, dz = e.z - z;
      if (dx * dx + dz * dz > r2) continue;
      const rem = this.remaining(e);
      if (rem < bestRem) { bestRem = rem; best = e; }
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

  damage(e: Enemy, amount: number, type: DmgType, owner: number, hero: Hero | null, flags = 0, silent = false): number {
    if (e.dead || amount <= 0) return 0;
    let mult = 1;
    if (type === DmgType.Phys) mult = 1 - Math.max(0, Math.min(0.9, e.armor - e.shred));
    else if (type === DmgType.Magic) mult = 1 - Math.min(0.9, e.mres);
    if (e.shielded) mult *= 0.7;
    const d = amount * mult;
    e.hp -= d;
    if (owner >= 0) {
      e.hitBy = owner;
      const p = this.player(owner);
      if (p) p.damage += d;
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
      if (e.flying) for (const u of [...e.blockers]) this.release(u);
      this.ev(Ev.BossPhase, e.id, nt);
      return;
    }
    e.dead = true;
    if (owner >= 0) {
      const p = this.player(owner);
      if (p) p.kills++;
    }
    this.ev(Ev.Death, e.id, e.type, e.x, e.z);
    if (def.ab.split) {
      const st = ENEMY_INDEX[def.ab.split.type];
      for (let i = 0; i < def.ab.split.count; i++) {
        const c = this.spawnEnemy(st, e.path, e.hpScale, (i - 1) * 0.5, e.dist - i * 0.4);
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

  private addXp(h: Hero, xp: number) {
    h.xp += xp;
    while (h.level < HERO_MAX_LEVEL && h.xp >= HERO_XP[h.level]) {
      h.level++;
      const d = h.def;
      h.u.maxHp = d.hp + d.hpPerLevel * (h.level - 1);
      h.u.hp = h.u.maxHp;
      h.u.dmgMin = d.dmg[0] + d.dmgPerLevel * (h.level - 1);
      h.u.dmgMax = d.dmg[1] + d.dmgPerLevel * (h.level - 1);
      this.ev(Ev.LevelUp, h.owner, h.level);
    }
  }

  // ------------------------------------------------------------ apparition

  private spawnEnemy(type: number, path: number, hpScale: number, lane: number, dist = 0): Enemy {
    const def = ENEMIES[type];
    const e: Enemy = {
      id: this.nextId++, type, def, hp: def.hp * hpScale, maxHp: def.hp * hpScale, hpScale, path, dist, lane,
      x: 0, z: 0, armor: def.armor, mres: def.mres, slowMul: 1, slowT: 0, stunT: 0, poisonDps: 0, poisonT: 0,
      burnDps: 0, burnT: 0, shred: 0, shredT: 0, blockers: [], fighting: false, atkT: 0,
      abT: sec(2 + this.rng.next() * 2), ab2T: sec(3 + this.rng.next() * 3), ab3T: sec(4), burrowed: false,
      burrowT: def.ab.burrow ? sec(def.ab.burrow.up) : 0, flying: !!def.flying, shielded: false, dead: false, hitBy: -1,
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
    const from = this.map.def.pathFrom;
    const res: number[] = [];
    for (let i = 0; i < this.map.paths.length; i++) if (!from || (from[i] ?? 1) <= wave) res.push(i);
    return res.length ? res : [0];
  }

  private startWave() {
    if (this.level && this.waveIdx >= this.totalWaves) return;
    this.waveIdx++;
    const n = this.activeCount;
    this.scaling = computeScaling(n, this.cfg.difficulty);
    let wave: Wave;
    if (this.level) wave = this.storyWaves[this.waveIdx - 1];
    else {
      this.mutations = mutationsFor(this.cfg.seed, this.waveIdx);
      wave = genSurvivalWave(this.map.def.biome, this.cfg.seed, this.waveIdx, this.activePaths(this.waveIdx));
    }
    const cm = this.scaling.countMul;
    for (const g of wave.groups) {
      const def = ENEMIES[g.type];
      const count = def.boss ? g.count : Math.max(1, Math.round(g.count * cm));
      const interval = g.interval / (1 + 0.5 * (cm - 1));
      const hpMul = (def.boss ? this.scaling.bossHpMul : this.scaling.hpMul) * (g.hpMul ?? 1);
      for (let i = 0; i < count; i++) {
        this.spawnQ.push({
          tick: this.tick + sec(g.delay + i * interval), type: g.type, path: Math.min(g.path, this.map.paths.length - 1),
          hpMul, lane: def.boss ? 0 : (this.rng.next() * 2 - 1) * 0.7,
        });
      }
    }
    this.spawnQ.sort((a, b) => a.tick - b.tick);
    this.waveSpawning = true;
    this.nextWaveT = -1;
    this.state = GameState.Running;
    for (const h of this.heroes) this.addXp(h, 6 * this.waveIdx);
    this.ev(Ev.WaveStart, this.waveIdx, wave.boss ? 1 : 0, wave.mutation ?? 255);
  }

  // ------------------------------------------------------------ commandes

  apply(pid: number, c: Command) {
    const p = this.player(pid);
    if (!p || !p.active || this.state === GameState.Won || this.state === GameState.Lost) return;
    switch (c.k) {
      case 'build': {
        const slot = clampNum(c.slot, 0, this.map.slots.length - 1);
        const fi = clampNum(c.fam, 0, 3);
        if (slot === null || fi === null || slot !== c.slot || fi !== c.fam) return;
        const s = this.map.slots[slot];
        if (s.locked || this.towerBySlot[slot]) return;
        const fam = FAMILIES[fi];
        const def = TOWERS[fam][0];
        if (p.gold < def.cost) return;
        p.gold -= def.cost;
        const t: Tower = {
          id: this.nextId++, slot, owner: pid, fam, fi, level: 0, sk: [0, 0], cdT: sec(0.3), burstLeft: 0, burstT: 0,
          stunT: 0, aim: null, rallyX: s.x, rallyZ: s.z, units: [], invested: def.cost, lastBuy: this.tick, s1T: 0, s2T: 0, x: s.x, z: s.z,
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
        const t = this.ownTower(pid, c.tower);
        if (!t || t.level >= 2) return;
        const def = TOWERS[t.fam][t.level + 1];
        if (p.gold < def.cost) return;
        p.gold -= def.cost;
        t.invested += def.cost;
        t.level++;
        t.lastBuy = this.tick;
        this.syncSoldiers(t);
        this.ev(Ev.Upgrade, t.id);
        break;
      }
      case 'spec': {
        const t = this.ownTower(pid, c.tower);
        if (!t || t.level !== 2 || (c.s !== 1 && c.s !== 2)) return;
        const def = TOWERS[t.fam][2 + c.s];
        if (p.gold < def.cost) return;
        p.gold -= def.cost;
        t.invested += def.cost;
        t.level = 2 + c.s;
        t.lastBuy = this.tick;
        t.s1T = sec(3);
        t.s2T = sec(5);
        this.syncSoldiers(t);
        this.ev(Ev.Upgrade, t.id);
        break;
      }
      case 'skill': {
        const t = this.ownTower(pid, c.tower);
        if (!t || t.level < LEVEL_SPEC_A || (c.i !== 0 && c.i !== 1)) return;
        const sk = TOWERS[t.fam][t.level].skills![c.i];
        const rank = t.sk[c.i];
        if (rank >= 3) return;
        const cost = sk.costs[rank];
        if (p.gold < cost) return;
        p.gold -= cost;
        t.invested += cost;
        t.sk[c.i]++;
        t.lastBuy = this.tick;
        this.syncSoldiers(t);
        this.ev(Ev.Upgrade, t.id);
        break;
      }
      case 'sell': {
        const t = this.ownTower(pid, c.tower);
        if (!t) return;
        const undo = this.tick - t.lastBuy <= sec(UNDO_SELL_S);
        p.gold += Math.floor(t.invested * (undo ? 1 : SELL_RATIO));
        this.removeTower(t);
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
        h.u.hx = x;
        h.u.hz = z;
        h.u.moving = true;
        break;
      }
      case 'hskill': {
        const h = this.heroes.find((h) => h.owner === pid);
        const x = clampNum(c.x, -this.map.def.hw - 2, this.map.def.hw + 2), z = clampNum(c.z, -this.map.def.hh - 2, this.map.def.hh + 2);
        if (!h || h.u.dead || x === null || z === null || (c.i !== 0 && c.i !== 1 && c.i !== 2)) return;
        const sk = h.def.skills[c.i];
        if (h.level < sk.unlock || h.cds[c.i] > 0) return;
        h.cds[c.i] = sec(sk.cd);
        this.heroSkill(h, c.i, x, z);
        break;
      }
      case 'spell': {
        const x = clampNum(c.x, -this.map.def.hw - 2, this.map.def.hw + 2), z = clampNum(c.z, -this.map.def.hh - 2, this.map.def.hh + 2);
        if ((c.s !== 0 && c.s !== 1) || x === null || z === null || p.spellCd[c.s] > 0) return;
        p.spellCd[c.s] = sec(SPELLS[c.s].cd);
        this.castSpell(pid, c.s, x, z);
        break;
      }
      case 'wave': {
        if (this.state === GameState.Waiting) {
          this.startWave();
        } else if (this.nextWaveT > 0) {
          const rem = this.nextWaveT / TICK_RATE;
          p.gold += Math.floor(rem * BALANCE.earlyGoldPerSec);
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
    for (let i = 0; i < sd.count; i++) {
      let u = t.units[i];
      if (!u) {
        u = this.newUnit(sd.kind, t.owner, t.x, t.z, sd.hp, sd.dmg[0], sd.dmg[1], sd.armor, sd.cooldown, sd.regen, t, -1);
        u.idx = i;
        t.units.push(u);
      }
      u.kind = sd.kind;
      u.maxHp = sd.hp;
      if (!u.dead) u.hp = sd.hp;
      u.dmgMin = sd.dmg[0];
      u.dmgMax = sd.dmg[1];
      u.armor = sd.armor + shieldBonus;
      u.regen = sd.regen * (1 + shieldBonus * 3);
      u.cdTicks = sec(sd.cooldown);
      u.hx = t.rallyX + FORMATION[i][0];
      u.hz = t.rallyZ + FORMATION[i][1];
    }
  }

  // ------------------------------------------------------------ sorts & héros

  private castSpell(pid: number, s: 0 | 1, x: number, z: number) {
    this.ev(Ev.Spell, s, pid, x, z);
    if (s === 0) {
      const offs = [[0, 0], [1.3, 0.8], [-1.1, 0.9]];
      offs.forEach(([ox, oz], i) => {
        const tx = x + ox, tz = z + oz;
        const flight = sec(1.0 + i * 0.25);
        this.projs.push(this.mkProj(FIRE_METEOR, null, pid, null, tx, tz, flight, 75, DmgType.True, 1.9, false, null));
        this.ev(Ev.Fire, FIRE_METEOR, Src.Sky, pid, 0xffff, tx, tz, flight);
      });
    } else {
      for (let i = 0; i < 2; i++) {
        const u = this.newUnit(RENFORT.kind, pid, x + (i ? 0.6 : -0.6), z, RENFORT.hp, RENFORT.dmg[0], RENFORT.dmg[1], RENFORT.armor, RENFORT.cooldown, 0, null, sec(20));
        u.hx = u.x;
        u.hz = u.z;
      }
    }
  }

  private heroSkill(h: Hero, i: number, x: number, z: number) {
    const u = h.u;
    const lvl = h.level;
    const id = h.def.id;
    const near: Enemy[] = [];
    this.ev(Ev.HeroSkill, h.owner, i, x, z, u.x, u.z);
    if (id === 'samuel') {
      if (i === 0) {
        let dx = x - u.x, dz = z - u.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        const len = Math.min(7, d);
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
            this.damage(e, 45 + 9 * lvl, DmgType.Phys, h.owner, h);
            e.stunT = Math.max(e.stunT, sec(0.8));
          }
        }
        this.ev(Ev.Impact, Impact.Charge, u.x, u.z, 15);
      } else if (i === 1) {
        for (const o of this.units) {
          if (o.dead || o.kind === HERO_UNIT) continue;
          const dx = o.x - u.x, dz = o.z - u.z;
          if (dx * dx + dz * dz < 20) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.5);
            o.buffT = sec(6);
          }
        }
        this.ev(Ev.Heal, u.x, u.z);
      } else {
        for (const e of this.enemiesIn(u.x, u.z, 3.8, false, near)) this.damage(e, 160 + 28 * lvl, DmgType.Phys, h.owner, h, 1);
        for (const o of this.units) {
          if (o.dead) continue;
          const dx = o.x - u.x, dz = o.z - u.z;
          if (dx * dx + dz * dz < 20) o.shield = 120 + 10 * lvl;
        }
        this.ev(Ev.Impact, Impact.Holy, u.x, u.z, 38);
      }
    } else if (id === 'lyra') {
      if (i === 0) {
        let dx = x - u.x, dz = z - u.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= d; dz /= d;
        for (const e of [...this.enemies]) {
          if (!this.targetable(e, true)) continue;
          const t = (e.x - u.x) * dx + (e.z - u.z) * dz;
          if (t < 0 || t > 13) continue;
          const px = u.x + dx * t - e.x, pz = u.z + dz * t - e.z;
          if (px * px + pz * pz < 0.9) this.damage(e, 85 + 12 * lvl, DmgType.Phys, h.owner, h, 1);
        }
      } else if (i === 1) {
        this.zones.push({ kind: Impact.ArrowRain, x, z, r: 2.3, t: sec(3), dps: 32 + 5 * lvl, dtype: DmgType.Phys, owner: h.owner, air: true, slow: 0 });
        this.ev(Ev.Impact, Impact.ArrowRain, x, z, 23);
      } else {
        for (const e of this.enemiesIn(u.x, u.z, 9, true, near)) this.damage(e, 120 + 18 * lvl, DmgType.Phys, h.owner, h, 1);
        this.ev(Ev.Impact, Impact.Dawn, u.x, u.z, 90);
      }
    } else if (id === 'brom') {
      if (i === 0) {
        for (const e of this.enemiesIn(u.x, u.z, 2.7, false, near)) {
          this.damage(e, 40 + 7 * lvl, DmgType.Phys, h.owner, h);
          e.stunT = Math.max(e.stunT, sec(2));
        }
        this.ev(Ev.Impact, Impact.Hammer, u.x, u.z, 27);
      } else if (i === 1) {
        const t = this.newUnit(SoldierKind.Tourelle, h.owner, x, z, 220 + 20 * lvl, 10 + 2 * lvl, 16 + 2 * lvl, 0.4, 0.6, 0, null, sec(16));
        t.range = 6.5;
        t.speed = 0;
        t.hx = x; t.hz = z;
        this.ev(Ev.Impact, Impact.Turret, x, z, 10);
      } else {
        this.zones.push({ kind: Impact.Lava, x, z, r: 3, t: sec(5), dps: 45 + 7 * lvl, dtype: DmgType.True, owner: h.owner, air: false, slow: 0.5 });
        this.ev(Ev.Impact, Impact.Lava, x, z, 30);
      }
    } else if (id === 'nox') {
      if (i === 0 || i === 2) {
        const n = i === 0 ? 2 : 6;
        for (let k = 0; k < n; k++) {
          const a = FORMATION[k];
          const s = this.newUnit(SoldierKind.Squelette, h.owner, x + a[0], z + a[1], 90 + 12 * lvl, 5 + lvl, 9 + lvl, 0.1, 1, 0, null, sec(i === 0 ? 14 : 18));
          s.hx = s.x; s.hz = s.z;
        }
        this.ev(Ev.Impact, Impact.Summon, x, z, i === 0 ? 12 : 20);
      } else {
        let total = 0;
        for (const e of this.enemiesIn(u.x, u.z, 3.6, true, near)) total += this.damage(e, 32 + 7 * lvl, DmgType.Magic, h.owner, h);
        u.hp = Math.min(u.maxHp, u.hp + total * 0.5);
        this.ev(Ev.Impact, Impact.Drain, u.x, u.z, 36);
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
    const d = e.dist + this.enemySpeed(e) * ticks * DT;
    return this.pathOf(e).at(d, e.lane, out);
  }

  private enemySpeed(e: Enemy) {
    let s = e.def.speed * e.slowMul;
    if (e.def.ab.enrage && e.hp < e.maxHp * e.def.ab.enrage.threshold) s *= e.def.ab.enrage.speedMul;
    if (e.burrowed) s *= 1.3;
    if (this.mutations.includes(MUTATION_INDEX.rapides)) s *= 1.25;
    return s;
  }

  private fireTower(t: Tower, lvl: TowerLevel, target: Enemy) {
    const dmg = this.rollDmg(lvl.dmg[0], lvl.dmg[1]);
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
    const p = this.mkProj(kind, t, t.owner, lvl.splash ? null : target, tx, tz, flight, dmg, lvl.dmgType, lvl.splash ?? 0, lvl.hitsAir, null);
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
    if (p.mortel && !e.def.boss && this.rng.next() < p.mortel) {
      this.damage(e, e.hp + 1, DmgType.True, p.owner, p.heroXp, 2);
      return;
    }
    let dmg = p.dmg;
    let flags = 0;
    if (p.heroXp && p.heroXp.def.id === 'lyra' && this.rng.next() < 0.2) { dmg *= 2; flags = 1; }
    const dealt = this.damage(e, dmg, p.dtype, p.owner, p.heroXp, flags, aoe && dmg < 10);
    if (p.heroXp && p.heroXp.def.id === 'nox') p.heroXp.u.hp = Math.min(p.heroXp.u.maxHp, p.heroXp.u.hp + dealt * 0.2);
    if (e.dead) return;
    if (p.slowF) { e.slowMul = Math.min(e.slowMul, 1 - p.slowF); e.slowT = Math.max(e.slowT, p.slowT); }
    if (p.poison) { e.poisonDps = p.poison; e.poisonT = sec(4); }
    if (p.shred) { e.shred = p.shred; e.shredT = sec(4); }
  }

  // ------------------------------------------------------------ boucle

  step() {
    if (this.state === GameState.Won || this.state === GameState.Lost) {
      this.tick++;
      return;
    }
    this.stepWaves();
    this.stepEnemies();
    this.stepUnits();
    this.stepTowers();
    this.stepProjectiles();
    this.stepZones();
    this.cleanup();
    this.stepCooldowns();
    this.checkEnd();
    this.tick++;
  }

  private stepWaves() {
    while (this.spawnQ.length && this.spawnQ[0].tick <= this.tick) {
      const s = this.spawnQ.shift()!;
      this.spawnEnemy(s.type, s.path, s.hpMul, s.lane);
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
      if (e.poisonT > 0) { e.poisonT--; this.damage(e, e.poisonDps * DT, DmgType.True, e.hitBy, null, 0, true); }
      if (e.burnT > 0) { e.burnT--; this.damage(e, e.burnDps * DT, DmgType.True, e.hitBy, null, 0, true); }
      if (e.dead) continue;
      if (ab.regen) e.hp = Math.min(e.maxHp, e.hp + ab.regen * e.hpScale * DT);
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
        for (const u of e.blockers) {
          const dx = u.x - e.x, dz = u.z - e.z;
          if (dx * dx + dz * dz < 1.9) { foe = u; break; }
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
              if (dx * dx + dz * dz < r2) this.hurtUnit(u, dmg);
            }
          } else this.hurtUnit(foe, dmg);
        }
      } else {
        // déplacement
        e.dist += this.enemySpeed(e) * DT;
        const path = this.pathOf(e);
        if (e.dist >= path.length) {
          e.dead = true;
          this.lives = Math.max(0, this.lives - e.def.lives);
          this.ev(Ev.Leak, e.id, e.def.lives);
          for (const u of [...e.blockers]) this.release(u);
          continue;
        }
      }
      this.pathOf(e).at(e.dist, e.lane, tmp);
      e.x = tmp.x;
      e.z = tmp.z;
    }
  }

  private hurtUnit(u: Unit, dmg: number) {
    if (u.dead) return;
    let d = dmg * (1 - Math.min(0.85, u.armor));
    // aura de Samuel
    if (u.kind !== HERO_UNIT) {
      for (const h of this.heroes) {
        if (h.def.id !== 'samuel' || h.u.dead) continue;
        const dx = h.u.x - u.x, dz = h.u.z - u.z;
        if (dx * dx + dz * dz < 16) { d *= 0.85; break; }
      }
    }
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
    u.dead = true;
    u.hp = 0;
    u.shield = 0;
    this.ev(Ev.UnitDeath, u.x, u.z);
    if (u.hero) {
      u.respawnT = sec(HERO_RESPAWN_S);
      this.ev(Ev.HeroDeath, u.owner);
    } else if (u.tower) {
      const sd = TOWERS[u.tower.fam][u.tower.level].soldiers!;
      u.respawnT = sec(sd.respawn);
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
      // validité de la cible
      if (u.target && (u.target.dead || u.target.burrowed || u.target.flying)) this.release(u);
      if (u.target) {
        const dx = u.target.x - u.hx, dz = u.target.z - u.hz;
        const leash = u.hero ? 5 : 4;
        if (dx * dx + dz * dz > leash * leash) this.release(u);
      }
      // acquisition
      if (!u.target && !u.moving && u.speed > 0) {
        const r = u.hero ? 2.8 : t ? 2.6 : 2.4;
        const r2 = r * r;
        let best: Enemy | null = null;
        let bestScore = Infinity;
        for (const e of this.enemies) {
          if (e.dead || e.flying || e.burrowed || e.dist < 0.5) continue;
          const dx = e.x - u.hx, dz = e.z - u.hz;
          const d2 = dx * dx + dz * dz;
          if (d2 > r2) continue;
          const score = d2 + e.blockers.length * 6;
          if (score < bestScore) { bestScore = score; best = e; }
        }
        if (best) this.engage(u, best);
      }
      // provocation : retenir des ennemis supplémentaires
      if (t && t.level === 3 && t.sk[1] > 0 && u.target) {
        const cap = TOWERS.barracks[3].skills![1].values[t.sk[1] - 1];
        for (let k = u.extra.length - 1; k >= 0; k--) {
          const e = u.extra[k];
          if (e.dead || e.burrowed) { u.extra.splice(k, 1); const j = e.blockers.indexOf(u); if (j >= 0) e.blockers.splice(j, 1); }
        }
        if (u.extra.length < cap) {
          for (const e of this.enemies) {
            if (u.extra.length >= cap) break;
            if (e === u.target || e.dead || e.flying || e.burrowed || e.blockers.length) continue;
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
        const dx = gx - u.x, dz = gz - u.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const step = u.speed * DT;
        if (d > step) { u.x += (dx / d) * step; u.z += (dz / d) * step; }
        else { u.x = gx; u.z = gz; if (u.moving) u.moving = false; }
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
            let dmg = this.rollDmg(u.dmgMin, u.dmgMax) * (u.buffT > 0 ? 1.5 : 1);
            let flags = 0;
            if (t && t.level === 4 && t.sk[1] > 0 && this.rng.next() < TOWERS.barracks[4].skills![1].values[t.sk[1] - 1]) { dmg *= 2; flags = 1; }
            if (u.hero && u.hero.def.id === 'lyra' && this.rng.next() < 0.2) { dmg *= 2; flags = 1; }
            const dealt = this.damage(e, dmg, u.hero ? u.hero.def.dmgType : DmgType.Phys, u.owner, u.hero, flags);
            if (u.hero && u.hero.def.id === 'nox') u.hp = Math.min(u.maxHp, u.hp + dealt * 0.2);
          }
        }
      }
      // tir à distance (héros à distance, tourelle)
      if (!u.fighting && u.range > 0 && u.cdT <= 0 && !u.moving) {
        const tgt = this.findTarget(u.x, u.z, u.range, true);
        if (tgt) {
          u.cdT = u.cdTicks;
          const kind = u.hero ? (u.hero.def.id === 'nox' ? FIRE_HERO_BOLT : FIRE_HERO_ARROW) : FIRE_TURRET;
          const flight = this.flightTicks(u.x, u.z, tgt.x, tgt.z, 16);
          const dmg = this.rollDmg(u.dmgMin, u.dmgMax) * (u.buffT > 0 ? 1.5 : 1);
          this.projs.push(this.mkProj(kind, null, u.owner, tgt, tgt.x, tgt.z, flight, dmg, u.hero ? u.hero.def.dmgType : DmgType.Phys, 0, true, u.hero));
          this.ev(Ev.Fire, kind, u.hero ? Src.Hero : Src.Unit, u.hero ? u.owner : u.id & 0xffff, tgt.id, tgt.x, tgt.z, flight);
        }
      }
      // régénération hors combat
      if (!u.target && u.hp < u.maxHp && u.regen > 0) u.hp = Math.min(u.maxHp, u.hp + u.regen * DT);
    }
  }

  private stepTowers() {
    const near: Enemy[] = [];
    for (const t of this.towers) {
      if (t.stunT > 0) { t.stunT--; continue; }
      const lvl = TOWERS[t.fam][t.level];
      const s0 = t.level >= 3 ? t.sk[0] : 0;
      const s1 = t.level >= 3 ? t.sk[1] : 0;
      let range = lvl.range;
      if (t.fam === 'archer' && t.level === 3 && s1) range += lvl.skills![1].values[s1 - 1];
      if (t.fam === 'barracks') {
        // Rôdeurs : bond
        if (t.level === 4 && s0 && --t.s1T <= 0) {
          let best: Enemy | null = null;
          for (const e of this.enemiesIn(t.rallyX, t.rallyZ, range + 1.5, false, near)) if (!best || e.hp > best.hp) best = e;
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
          const targets = this.enemiesIn(t.x, t.z, range, true, near).slice();
          if (targets.length) {
            t.s2T = sec(8);
            const n = sk1.values[s1 - 1];
            for (let k = 0; k < n; k++) {
              const e = targets[k % targets.length];
              const flight = this.flightTicks(t.x, t.z, e.x, e.z, 22);
              const p = this.mkProj(0, t, t.owner, e, e.x, e.z, flight, this.rollDmg(lvl.dmg[0], lvl.dmg[1]), DmgType.Phys, 0, true, null);
              if (s0) p.poison = sk0.values[s0 - 1];
              this.projs.push(p);
              this.ev(Ev.Fire, 0, Src.Tower, t.id, e.id, e.x, e.z, flight);
            }
            this.ev(Ev.Skill, t.id, 1);
          } else t.s2T = sec(1);
        }
        if (sk0.id === 'desint' && s0 && --t.s1T <= 0) {
          const e = this.findTarget(t.x, t.z, range, true);
          if (e) {
            t.s1T = sec(sk0.values[s0 - 1]);
            this.ev(Ev.Impact, Impact.Arcane, e.x, e.z, 10);
            if (e.def.boss) this.damage(e, 400, DmgType.True, t.owner, null, 2);
            else this.damage(e, e.hp + 1, DmgType.True, t.owner, null, 2);
            this.ev(Ev.Skill, t.id, 0);
          } else t.s1T = sec(1);
        }
        if (sk1.id === 'teleport' && s1 && --t.s2T <= 0) {
          const list = this.enemiesIn(t.x, t.z, range, true, near).filter((e) => !e.def.boss);
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
          const e = this.findTarget(t.x, t.z, range, false);
          if (e) {
            t.s1T = sec(12);
            for (const o of this.enemiesIn(e.x, e.z, 2.5, false, near)) o.stunT = Math.max(o.stunT, sec(sk0.values[s0 - 1]));
            this.ev(Ev.Impact, Impact.Frost, e.x, e.z, 25);
            this.ev(Ev.Skill, t.id, 0);
          } else t.s1T = sec(1);
        }
        if (sk1.id === 'frag' && s1 && --t.s2T <= 0) {
          const e = this.findTarget(t.x, t.z, range, false);
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
        const tgt = t.aim && this.targetable(t.aim, true) ? t.aim : this.findTarget(t.x, t.z, range, lvl.hitsAir);
        if (tgt) this.fireTower(t, lvl, tgt);
        t.burstLeft--;
        t.burstT = 2;
      }
      if (t.cdT > 0) { t.cdT--; continue; }
      const tgt = this.findTarget(t.x, t.z, range, lvl.hitsAir);
      t.aim = tgt;
      if (!tgt) continue;
      this.fireTower(t, lvl, tgt);
      t.cdT = sec(lvl.cooldown);
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
      for (const e of this.enemiesIn(z.x, z.z, z.r, z.air, near)) {
        this.damage(e, z.dps * DT, z.dtype, z.owner, null, 0, true);
        if (z.slow) { e.slowMul = Math.min(e.slowMul, 1 - z.slow); e.slowT = Math.max(e.slowT, 2); }
      }
      if (--z.t <= 0) { this.zones[i] = this.zones[this.zones.length - 1]; this.zones.pop(); }
    }
  }

  private stepCooldowns() {
    for (const p of this.players) {
      if (p.spellCd[0] > 0) p.spellCd[0]--;
      if (p.spellCd[1] > 0) p.spellCd[1]--;
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
