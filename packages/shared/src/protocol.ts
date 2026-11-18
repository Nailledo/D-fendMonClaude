import { POS_SCALE } from './constants';
import { HERO_XP } from './data/heroes';
import { Ev, HERO_UNIT, type Sim } from './sim';
import { FAMILY_INDEX, HERO_IDS, type Command, type Difficulty, type GameConfig, type HeroId, type Mode } from './types';

// ---------------------------------------------------------------- Messages JSON (lobby / contrôle)

export interface LobbyPlayer {
  id: number;
  name: string;
  hero: HeroId;
  ready: boolean;
  host: boolean;
  connected: boolean;
}

export interface RoomSettings {
  mode: Mode;
  mapId: string;
  difficulty: Difficulty;
}

export interface EndInfo {
  won: boolean;
  stars: number;
  wave: number;
  mode: Mode;
  mapId: string;
  difficulty: Difficulty;
  stats: { id: number; name: string; kills: number; damage: number; gold: number }[];
}

export type ClientMsg =
  | { t: 'hello'; name: string; token?: string }
  | { t: 'create' }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'hero'; hero: HeroId }
  /** arbre de compétences et objets emportés (bornés par le serveur) */
  | { t: 'meta'; tree: number[]; items: number[] }
  | { t: 'ready'; ready: boolean }
  | { t: 'settings'; settings: RoomSettings }
  | { t: 'start' }
  | { t: 'cmd'; c: Command }
  | { t: 'chat'; text: string }
  | { t: 'ping'; kind: number; x: number; z: number }
  | { t: 'lobby' }
  | { t: 'pong'; n: number };

export type ServerMsg =
  | { t: 'welcome'; token: string; pid?: number }
  | { t: 'error'; msg: string }
  | { t: 'room'; code: string; you: number; players: LobbyPlayer[]; settings: RoomSettings; inGame: boolean }
  | { t: 'start'; cfg: GameConfig; you: number }
  | { t: 'end'; info: EndInfo }
  | { t: 'chat'; from: number; name: string; text: string }
  | { t: 'ping'; from: number; kind: number; x: number; z: number }
  | { t: 'left' }
  | { t: 'latency'; n: number; pings: Record<number, number> };

// ---------------------------------------------------------------- Binaire

export const MSG_SNAPSHOT = 1;

class Writer {
  buf: ArrayBuffer;
  view: DataView;
  o = 0;
  constructor(size = 16384) {
    this.buf = new ArrayBuffer(size);
    this.view = new DataView(this.buf);
  }
  reset() {
    this.o = 0;
  }
  private ensure(n: number) {
    if (this.o + n <= this.buf.byteLength) return;
    const nb = new ArrayBuffer(Math.max(this.buf.byteLength * 2, this.o + n + 1024));
    new Uint8Array(nb).set(new Uint8Array(this.buf, 0, this.o));
    this.buf = nb;
    this.view = new DataView(nb);
  }
  u8(v: number) { this.ensure(1); this.view.setUint8(this.o, v & 0xff); this.o += 1; }
  i8(v: number) { this.ensure(1); this.view.setInt8(this.o, Math.max(-128, Math.min(127, Math.round(v)))); this.o += 1; }
  u16(v: number) { this.ensure(2); this.view.setUint16(this.o, Math.max(0, Math.min(65535, Math.round(v))), true); this.o += 2; }
  id(v: number) { this.ensure(2); this.view.setUint16(this.o, v & 0xffff, true); this.o += 2; }
  i16(v: number) { this.ensure(2); this.view.setInt16(this.o, Math.max(-32768, Math.min(32767, Math.round(v))), true); this.o += 2; }
  u32(v: number) { this.ensure(4); this.view.setUint32(this.o, Math.max(0, Math.min(4294967295, Math.floor(v))), true); this.o += 4; }
  pos(v: number) { this.i16(v * POS_SCALE); }
  frac(v: number) { this.u8(Math.max(0, Math.min(255, Math.ceil(v * 255)))); }
  bytes() { return this.buf.slice(0, this.o); }
}

class Reader {
  view: DataView;
  o = 0;
  constructor(buf: ArrayBuffer) { this.view = new DataView(buf); }
  u8() { return this.view.getUint8(this.o++); }
  i8() { return this.view.getInt8(this.o++); }
  u16() { const v = this.view.getUint16(this.o, true); this.o += 2; return v; }
  i16() { const v = this.view.getInt16(this.o, true); this.o += 2; return v; }
  u32() { const v = this.view.getUint32(this.o, true); this.o += 4; return v; }
  pos() { return this.i16() / POS_SCALE; }
  frac() { return this.u8() / 255; }
}

/** Schéma des événements : b=u8, w=u16, p=position, i=u32 */
const EV_SCHEMA: Record<number, string> = {
  [Ev.Fire]: 'bbwwppw',
  [Ev.Impact]: 'bppw',
  [Ev.Death]: 'wbpp',
  [Ev.Leak]: 'wb',
  [Ev.Build]: 'wb',
  [Ev.Sell]: 'bb',
  [Ev.Upgrade]: 'wbb',
  [Ev.Spell]: 'bbpp',
  [Ev.HeroSkill]: 'bbpppp',
  [Ev.Dmg]: 'wwb',
  [Ev.WaveStart]: 'wbb',
  [Ev.LevelUp]: 'bb',
  [Ev.Stun]: 'ww',
  [Ev.Teleport]: 'wpp',
  [Ev.BossPhase]: 'wb',
  [Ev.UnitDeath]: 'pp',
  [Ev.Heal]: 'pp',
  [Ev.Gift]: 'bbi',
  [Ev.Spawn]: 'wpp',
  [Ev.HeroDeath]: 'b',
  [Ev.GameEnd]: 'b',
  [Ev.Skill]: 'wb',
  [Ev.Item]: 'bbpp',
  [Ev.Income]: 'wwb',
};

// Drapeaux
export const EF_FLYING = 1, EF_BURROWED = 2, EF_FIGHTING = 4, EF_SLOWED = 8, EF_DOT = 16, EF_STUNNED = 32, EF_SHIELDED = 64, EF_ENRAGED = 128;
export const UF_DEAD = 1, UF_FIGHTING = 2, UF_BUFF = 4, UF_SHIELD = 8, UF_MOVING = 16;
/** le héros poursuit une cible imposée par son joueur (son id est alors dans la cible de l'unité) */
export const UF_FOCUS = 32;
export const PF_ACTIVE = 1, PF_CONNECTED = 2, PF_SPEED2 = 4;
/** propriétés d'un ennemi (bits 1, 2, 4 = Trait) ; 8 = camouflé repéré ; 16 = se régénère en ce moment ; 32 = marqué */
export const ET_REVEALED = 8, ET_REGROWING = 16, ET_MARKED = 32;

const writer = new Writer(32768);

/** Encode l'état complet + les événements du tick. */
export function encodeSnapshot(sim: Sim, events: number[][]): ArrayBuffer {
  const w = writer;
  w.reset();
  w.u8(MSG_SNAPSHOT);
  w.u32(sim.tick);
  w.u8(sim.state);
  w.u8(sim.speed);
  w.u16(sim.waveIdx);
  w.u16(sim.totalWaves);
  w.i16(sim.lives);
  w.u16(sim.maxLives);
  w.u16(sim.nextWaveT < 0 ? 0xffff : sim.nextWaveT);
  w.u8(sim.mutations.length);
  for (const m of sim.mutations) w.u8(m);
  // joueurs
  w.u8(sim.players.length);
  for (const p of sim.players) {
    w.u8(p.id);
    w.u32(p.gold);
    w.u16(p.spellCd[0]);
    w.u16(p.spellCd[1]);
    w.u8((p.active ? PF_ACTIVE : 0) | (p.connected ? PF_CONNECTED : 0) | (p.speedVote === 2 ? PF_SPEED2 : 0));
  }
  // tours
  w.u8(sim.towers.length);
  for (const t of sim.towers) {
    w.id(t.id);
    w.u8(t.slot);
    w.u8(t.owner);
    w.u8(FAMILY_INDEX[t.fam]);
    w.u8(t.level);
    w.u8(t.sk[0] | (t.sk[1] << 4));
    w.u16(t.stunT);
    w.id(t.aim && !t.aim.dead ? t.aim.id : 0xffff);
    w.pos(t.rallyX);
    w.pos(t.rallyZ);
    w.u8(t.prio);
  }
  // ennemis
  w.u16(sim.enemies.length);
  for (const e of sim.enemies) {
    w.id(e.id);
    w.u8(e.type);
    w.u8(e.path);
    w.u16(e.dist * 64);
    w.i8(e.lane * 100);
    w.frac(e.hp / e.maxHp);
    let f = 0;
    if (e.flying) f |= EF_FLYING;
    if (e.burrowed) f |= EF_BURROWED;
    if (e.fighting) f |= EF_FIGHTING;
    if (e.slowT > 0) f |= EF_SLOWED;
    if (e.poisonT > 0 || e.burnT > 0) f |= EF_DOT;
    if (e.stunT > 0) f |= EF_STUNNED;
    if (e.shielded) f |= EF_SHIELDED;
    if (e.def.ab.enrage && e.hp < e.maxHp * e.def.ab.enrage.threshold) f |= EF_ENRAGED;
    w.u8(f);
    w.u8(e.traits | (e.revealed ? ET_REVEALED : 0) | (e.traits & 4 && e.quietT === 0 && e.hp < e.maxHp ? ET_REGROWING : 0) | (e.marked > 0 ? ET_MARKED : 0));
  }
  // unités
  let nu = 0;
  for (const u of sim.units) if (!(u.dead && u.life === 0)) nu++;
  w.u16(nu);
  for (const u of sim.units) {
    if (u.dead && u.life === 0) continue;
    w.id(u.id);
    w.u8(u.kind);
    w.u8(u.owner);
    w.pos(u.x);
    w.pos(u.z);
    w.frac(u.maxHp > 0 ? u.hp / u.maxHp : 0);
    w.u8((u.dead ? UF_DEAD : 0) | (u.fighting ? UF_FIGHTING : 0) | (u.buffT > 0 ? UF_BUFF : 0) | (u.shield > 0 ? UF_SHIELD : 0) | (u.moving ? UF_MOVING : 0) | (u.focus ? UF_FOCUS : 0));
    const tg = u.focus ?? u.target;
    w.id(tg && !tg.dead ? tg.id : 0xffff);
  }
  // héros
  w.u8(sim.heroes.length);
  for (const h of sim.heroes) {
    w.u8(h.owner);
    w.u8(HERO_IDS.indexOf(h.def.id));
    w.u8(h.level);
    const lo = HERO_XP[h.level - 1] ?? 0;
    const hi = HERO_XP[h.level] ?? lo + 1;
    w.frac(h.level >= HERO_XP.length ? 1 : (h.xp - lo) / (hi - lo));
    w.u16(h.cds[0]);
    w.u16(h.cds[1]);
    w.u16(h.cds[2]);
    w.u16(h.u.respawnT);
    w.id(h.u.id);
    w.u16(h.u.maxHp);
  }
  // événements
  w.u16(events.length);
  for (const ev of events) {
    const type = ev[0];
    w.u8(type);
    if (type === Ev.Chain) {
      w.id(ev[1]);
      const n = ev[2];
      w.u8(n);
      for (let i = 0; i < n * 2; i++) w.pos(ev[3 + i]);
      continue;
    }
    const sch = EV_SCHEMA[type];
    for (let i = 0; i < sch.length; i++) {
      const v = ev[i + 1];
      switch (sch.charCodeAt(i)) {
        case 98: w.u8(v); break; // b
        case 119: w.id(v); break; // w
        case 112: w.pos(v); break; // p
        case 105: w.u32(v); break; // i
      }
    }
  }
  return w.bytes();
}

// ---------------------------------------------------------------- Décodage (structure de tableaux, réutilisable)

export class Snapshot {
  tick = 0;
  state = 0;
  speed = 1;
  wave = 0;
  totalWaves = 0;
  lives = 0;
  maxLives = 0;
  nextWaveT = -1;
  mutations: number[] = [];
  // joueurs
  pCount = 0;
  pId = new Uint8Array(4);
  pGold = new Uint32Array(4);
  pCd0 = new Uint16Array(4);
  pCd1 = new Uint16Array(4);
  pFlags = new Uint8Array(4);
  // tours
  tCount = 0;
  tId = new Uint16Array(64);
  tSlot = new Uint8Array(64);
  tOwner = new Uint8Array(64);
  tFam = new Uint8Array(64);
  tLevel = new Uint8Array(64);
  tSk = new Uint8Array(64);
  tStun = new Uint16Array(64);
  tAim = new Uint16Array(64);
  tRallyX = new Float32Array(64);
  tRallyZ = new Float32Array(64);
  tPrio = new Uint8Array(64);
  // ennemis
  eCount = 0;
  eId = new Uint16Array(1024);
  eType = new Uint8Array(1024);
  ePath = new Uint8Array(1024);
  eDist = new Float32Array(1024);
  eLane = new Float32Array(1024);
  eHp = new Float32Array(1024);
  eFlags = new Uint8Array(1024);
  eTraits = new Uint8Array(1024);
  // unités
  uCount = 0;
  uId = new Uint16Array(256);
  uKind = new Uint8Array(256);
  uOwner = new Uint8Array(256);
  uX = new Float32Array(256);
  uZ = new Float32Array(256);
  uHp = new Float32Array(256);
  uFlags = new Uint8Array(256);
  uTarget = new Uint16Array(256);
  // héros
  hCount = 0;
  hOwner = new Uint8Array(4);
  hType = new Uint8Array(4);
  hLevel = new Uint8Array(4);
  hXp = new Float32Array(4);
  hCd = new Uint16Array(12);
  hRespawn = new Uint16Array(4);
  hUnit = new Uint16Array(4);
  hMaxHp = new Uint16Array(4);
  events: number[][] = [];

  private grow(count: number) {
    if (count > this.eId.length) {
      const n = Math.max(count, this.eId.length * 2);
      this.eId = new Uint16Array(n); this.eType = new Uint8Array(n); this.ePath = new Uint8Array(n);
      this.eDist = new Float32Array(n); this.eLane = new Float32Array(n); this.eHp = new Float32Array(n); this.eFlags = new Uint8Array(n); this.eTraits = new Uint8Array(n);
    }
  }
  private growU(count: number) {
    if (count > this.uId.length) {
      const n = Math.max(count, this.uId.length * 2);
      this.uId = new Uint16Array(n); this.uKind = new Uint8Array(n); this.uOwner = new Uint8Array(n);
      this.uX = new Float32Array(n); this.uZ = new Float32Array(n); this.uHp = new Float32Array(n); this.uFlags = new Uint8Array(n); this.uTarget = new Uint16Array(n);
    }
  }

  decode(buf: ArrayBuffer) {
    const r = new Reader(buf);
    if (r.u8() !== MSG_SNAPSHOT) throw new Error('snapshot attendu');
    this.tick = r.u32();
    this.state = r.u8();
    this.speed = r.u8();
    this.wave = r.u16();
    this.totalWaves = r.u16();
    this.lives = r.i16();
    this.maxLives = r.u16();
    const nw = r.u16();
    this.nextWaveT = nw === 0xffff ? -1 : nw;
    const nm = r.u8();
    this.mutations.length = 0;
    for (let i = 0; i < nm; i++) this.mutations.push(r.u8());
    this.pCount = r.u8();
    for (let i = 0; i < this.pCount; i++) {
      this.pId[i] = r.u8(); this.pGold[i] = r.u32(); this.pCd0[i] = r.u16(); this.pCd1[i] = r.u16(); this.pFlags[i] = r.u8();
    }
    this.tCount = r.u8();
    for (let i = 0; i < this.tCount; i++) {
      this.tId[i] = r.u16(); this.tSlot[i] = r.u8(); this.tOwner[i] = r.u8(); this.tFam[i] = r.u8(); this.tLevel[i] = r.u8();
      this.tSk[i] = r.u8(); this.tStun[i] = r.u16(); this.tAim[i] = r.u16(); this.tRallyX[i] = r.pos(); this.tRallyZ[i] = r.pos(); this.tPrio[i] = r.u8();
    }
    const ne = r.u16();
    this.grow(ne);
    this.eCount = ne;
    for (let i = 0; i < ne; i++) {
      this.eId[i] = r.u16(); this.eType[i] = r.u8(); this.ePath[i] = r.u8(); this.eDist[i] = r.u16() / 64;
      this.eLane[i] = r.i8() / 100; this.eHp[i] = r.frac(); this.eFlags[i] = r.u8(); this.eTraits[i] = r.u8();
    }
    const nu = r.u16();
    this.growU(nu);
    this.uCount = nu;
    for (let i = 0; i < nu; i++) {
      this.uId[i] = r.u16(); this.uKind[i] = r.u8(); this.uOwner[i] = r.u8(); this.uX[i] = r.pos(); this.uZ[i] = r.pos();
      this.uHp[i] = r.frac(); this.uFlags[i] = r.u8(); this.uTarget[i] = r.u16();
    }
    this.hCount = r.u8();
    for (let i = 0; i < this.hCount; i++) {
      this.hOwner[i] = r.u8(); this.hType[i] = r.u8(); this.hLevel[i] = r.u8(); this.hXp[i] = r.frac();
      this.hCd[i * 3] = r.u16(); this.hCd[i * 3 + 1] = r.u16(); this.hCd[i * 3 + 2] = r.u16();
      this.hRespawn[i] = r.u16(); this.hUnit[i] = r.u16(); this.hMaxHp[i] = r.u16();
    }
    const nev = r.u16();
    const evs: number[][] = [];
    for (let i = 0; i < nev; i++) {
      const type = r.u8();
      if (type === Ev.Chain) {
        const a = [type, r.u16()];
        const n = r.u8();
        a.push(n);
        for (let k = 0; k < n * 2; k++) a.push(r.pos());
        evs.push(a);
        continue;
      }
      const sch = EV_SCHEMA[type];
      if (!sch) throw new Error('événement inconnu ' + type);
      const a = [type];
      for (let k = 0; k < sch.length; k++) {
        switch (sch.charCodeAt(k)) {
          case 98: a.push(r.u8()); break;
          case 119: a.push(r.u16()); break;
          case 112: a.push(r.pos()); break;
          case 105: a.push(r.u32()); break;
        }
      }
      evs.push(a);
    }
    this.events = evs;
    return this;
  }

  playerIndex(id: number): number {
    for (let i = 0; i < this.pCount; i++) if (this.pId[i] === id) return i;
    return -1;
  }
  heroIndex(owner: number): number {
    for (let i = 0; i < this.hCount; i++) if (this.hOwner[i] === owner) return i;
    return -1;
  }
}

export { HERO_UNIT };
