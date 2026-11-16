import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  GameState, HERO_IDS, LEVELS, MAPS, MAX_PLAYERS, RECONNECT_GRACE_S, SURVIVAL_MAPS, Sim, encodeSnapshot,
  type ClientMsg, type Command, type EndInfo, type GameConfig, type HeroId, type LobbyPlayer, type RoomSettings, type ServerMsg,
} from '@dfend/shared';
import type { Scores } from './db';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMPTY_ROOM_TTL = 120_000;
const CMD_PER_SEC = 25;

export interface Client {
  ws: WebSocket;
  token: string;
  name: string;
  room: Room | null;
  pid: number;
  alive: boolean;
  cmdBudget: number;
  chatBudget: number;
  pingSent: number;
  pingN: number;
  rtt: number;
}

interface RoomPlayer {
  pid: number;
  token: string;
  name: string;
  hero: HeroId;
  ready: boolean;
  client: Client | null;
  leftAt: number;
}

function send(c: Client | null, m: ServerMsg) {
  if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(m));
}

function sanitize(s: unknown, max: number): string {
  return String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

export class Room {
  players: RoomPlayer[] = [];
  hostPid = 0;
  settings: RoomSettings = { mode: 'story', mapId: LEVELS[0].mapId, difficulty: 1 };
  sim: Sim | null = null;
  private timer: NodeJS.Timeout | null = null;
  private acc = 0;
  private last = 0;
  private queue: { pid: number; c: Command }[] = [];
  emptySince = 0;
  private endSent = false;

  constructor(readonly code: string, private mgr: RoomManager) {}

  get inGame() {
    return !!this.sim;
  }

  playerOf(c: Client) {
    return this.players.find((p) => p.client === c);
  }

  lobbyState(): LobbyPlayer[] {
    return this.players.map((p) => ({ id: p.pid, name: p.name, hero: p.hero, ready: p.ready, host: p.pid === this.hostPid, connected: !!p.client }));
  }

  broadcastRoom() {
    const players = this.lobbyState();
    for (const p of this.players) send(p.client, { t: 'room', code: this.code, you: p.pid, players, settings: this.settings, inGame: this.inGame });
  }

  broadcast(m: ServerMsg) {
    for (const p of this.players) send(p.client, m);
  }

  add(c: Client): boolean {
    if (this.players.length >= MAX_PLAYERS) return false;
    if (this.inGame) return false;
    let pid = 0;
    while (this.players.some((p) => p.pid === pid)) pid++;
    this.players.push({ pid, token: c.token, name: c.name, hero: 'samuel', ready: false, client: c, leftAt: 0 });
    if (this.players.length === 1) this.hostPid = pid;
    c.room = this;
    c.pid = pid;
    this.emptySince = 0;
    this.broadcastRoom();
    return true;
  }

  /** Reconnexion avec un jeton connu. */
  reattach(c: Client): boolean {
    const p = this.players.find((p) => p.token === c.token);
    if (!p) return false;
    if (p.client && p.client !== c) p.client.ws.close(4000, 'remplacé');
    p.client = c;
    p.leftAt = 0;
    c.room = this;
    c.pid = p.pid;
    this.emptySince = 0;
    this.sim?.setConnected(p.pid, true);
    this.broadcastRoom();
    if (this.sim) send(c, { t: 'start', cfg: this.sim.cfg, you: p.pid });
    return true;
  }

  /** Déconnexion réseau (la place reste réservée). */
  disconnect(c: Client) {
    const p = this.playerOf(c);
    if (!p) return;
    p.client = null;
    p.leftAt = Date.now();
    if (this.sim) this.sim.setConnected(p.pid, false);
    else this.remove(p.pid);
    this.afterChange();
  }

  /** Départ volontaire. */
  leave(c: Client) {
    const p = this.playerOf(c);
    if (!p) return;
    c.room = null;
    if (this.sim) {
      this.sim.removePlayer(p.pid);
      p.client = null;
      p.leftAt = -1; // parti définitivement
    }
    this.remove(p.pid);
    send(c, { t: 'left' });
    this.afterChange();
  }

  private remove(pid: number) {
    const i = this.players.findIndex((p) => p.pid === pid);
    if (i < 0) return;
    if (this.sim) {
      // en partie : on garde l'entrée pour la reconnexion, sauf départ définitif
      if (this.players[i].leftAt !== -1) return;
    }
    this.players.splice(i, 1);
  }

  private afterChange() {
    const connected = this.players.filter((p) => p.client);
    if (connected.length === 0) {
      this.emptySince = Date.now();
    } else if (!connected.some((p) => p.pid === this.hostPid)) {
      this.hostPid = connected[0].pid;
    }
    this.broadcastRoom();
  }

  handle(c: Client, m: ClientMsg) {
    const p = this.playerOf(c);
    if (!p) return;
    switch (m.t) {
      case 'hero':
        if (HERO_IDS.includes(m.hero) && !this.inGame) { p.hero = m.hero; this.broadcastRoom(); }
        break;
      case 'ready':
        if (!this.inGame) { p.ready = !!m.ready; this.broadcastRoom(); }
        break;
      case 'settings': {
        if (p.pid !== this.hostPid || this.inGame) return;
        const s = m.settings;
        const mode = s.mode === 'survival' ? 'survival' : 'story';
        const valid = mode === 'story' ? LEVELS.some((l) => l.mapId === s.mapId) : SURVIVAL_MAPS.includes(s.mapId);
        if (!valid || !MAPS[s.mapId]) return;
        this.settings = { mode, mapId: s.mapId, difficulty: s.difficulty === 0 || s.difficulty === 2 ? s.difficulty : 1 };
        for (const q of this.players) q.ready = false;
        this.broadcastRoom();
        break;
      }
      case 'start':
        if (p.pid === this.hostPid && !this.inGame && this.players.every((q) => q.ready || q.pid === this.hostPid)) this.start();
        break;
      case 'cmd':
        if (!this.sim || c.cmdBudget <= 0 || !m.c || typeof m.c !== 'object') return;
        c.cmdBudget--;
        this.queue.push({ pid: p.pid, c: m.c });
        break;
      case 'chat': {
        if (c.chatBudget <= 0) return;
        c.chatBudget--;
        const text = sanitize(m.text, 140);
        if (text) this.broadcast({ t: 'chat', from: p.pid, name: p.name, text });
        break;
      }
      case 'ping': {
        if (c.chatBudget <= 0) return;
        c.chatBudget -= 0.5;
        const x = Number(m.x), z = Number(m.z);
        if (Number.isFinite(x) && Number.isFinite(z)) this.broadcast({ t: 'ping', from: p.pid, kind: (Number(m.kind) | 0) % 3, x, z });
        break;
      }
      case 'lobby':
        // retour au salon après la fin
        if (!this.inGame) this.broadcastRoom();
        break;
    }
  }

  start() {
    const cfg: GameConfig = {
      mode: this.settings.mode,
      mapId: this.settings.mapId,
      difficulty: this.settings.difficulty,
      seed: randomBytes(4).readUInt32LE(0),
      players: this.players.filter((p) => p.client).map((p) => ({ id: p.pid, name: p.name, hero: p.hero })),
    };
    // les absents sont retirés du salon
    this.players = this.players.filter((p) => p.client);
    this.sim = new Sim(cfg);
    this.endSent = false;
    this.queue.length = 0;
    for (const p of this.players) send(p.client, { t: 'start', cfg, you: p.pid });
    this.broadcastRoom();
    this.last = performance.now();
    this.acc = 0;
    // premier état
    this.sendSnapshot([]);
    this.timer = setInterval(() => this.loop(), 25);
  }

  private loop() {
    const sim = this.sim;
    if (!sim) return;
    const now = performance.now();
    this.acc += now - this.last;
    this.last = now;
    if (this.acc > 1000) this.acc = 1000;
    let events: number[][] | null = null;
    while (this.acc >= 50) {
      this.acc -= 50;
      events ??= [];
      for (let s = 0; s < sim.speed; s++) {
        for (const q of this.queue) sim.apply(q.pid, q.c);
        this.queue.length = 0;
        sim.step();
        for (const e of sim.drainEvents()) events.push(e);
      }
    }
    if (events) this.sendSnapshot(events);
    // joueurs partis trop longtemps
    const t = Date.now();
    for (const p of this.players) {
      if (!p.client && p.leftAt > 0 && t - p.leftAt > RECONNECT_GRACE_S * 1000) {
        sim.removePlayer(p.pid);
        p.leftAt = -1;
        this.remove(p.pid);
        this.broadcast({ t: 'chat', from: -1, name: 'Système', text: `${p.name} a quitté la partie : ses tours et son or sont répartis.` });
        this.afterChange();
      }
    }
    if ((sim.state === GameState.Won || sim.state === GameState.Lost) && !this.endSent) {
      this.endSent = true;
      setTimeout(() => this.finish(), 1500);
    }
  }

  private sendSnapshot(events: number[][]) {
    if (!this.sim) return;
    const buf = encodeSnapshot(this.sim, events);
    for (const p of this.players) if (p.client && p.client.ws.readyState === 1) p.client.ws.send(buf, { binary: true });
  }

  private finish() {
    const sim = this.sim;
    if (!sim) return;
    const info: EndInfo = {
      won: sim.state === GameState.Won,
      stars: sim.stars,
      wave: sim.wavesSurvived,
      mode: sim.cfg.mode,
      mapId: sim.cfg.mapId,
      difficulty: sim.cfg.difficulty,
      stats: sim.players.map((p) => ({ id: p.id, name: p.name, kills: p.kills, damage: Math.round(p.damage), gold: Math.round(p.goldEarned) })),
    };
    if (sim.cfg.mode === 'survival' && info.wave > 0) {
      try {
        this.mgr.scores?.add(sim.cfg.mapId, sim.cfg.players.length, sim.cfg.difficulty, info.wave, sim.cfg.players.map((p) => p.name));
      } catch (e) {
        console.error('score', e);
      }
    }
    this.broadcast({ t: 'end', info });
    this.stop();
    this.players = this.players.filter((p) => p.client);
    for (const p of this.players) p.ready = false;
    this.afterChange();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.sim = null;
    this.queue.length = 0;
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();
  clients = new Set<Client>();
  /** jeton -> salon (pour la reconnexion) */
  private tokens = new Map<string, string>();
  private pingN = 0;

  constructor(readonly maxRooms: number, readonly scores: Scores | null) {
    setInterval(() => this.housekeeping(), 1000);
  }

  private newCode(): string {
    for (;;) {
      let s = '';
      const b = randomBytes(5);
      for (let i = 0; i < 5; i++) s += CODE_CHARS[b[i] % CODE_CHARS.length];
      if (!this.rooms.has(s)) return s;
    }
  }

  connect(ws: WebSocket): Client {
    const c: Client = { ws, token: '', name: 'Joueur', room: null, pid: -1, alive: true, cmdBudget: CMD_PER_SEC, chatBudget: 5, pingSent: 0, pingN: 0, rtt: 0 };
    this.clients.add(c);
    return c;
  }

  message(c: Client, m: ClientMsg) {
    if (m.t === 'hello') {
      c.name = sanitize(m.name, 16) || 'Joueur';
      const tok = typeof m.token === 'string' && /^[a-f0-9]{32}$/.test(m.token) ? m.token : randomBytes(16).toString('hex');
      c.token = tok;
      send(c, { t: 'welcome', token: tok });
      const code = this.tokens.get(tok);
      const room = code ? this.rooms.get(code) : undefined;
      if (room && room.reattach(c)) return;
      return;
    }
    if (!c.token) return;
    if (m.t === 'pong') {
      if (m.n === c.pingN) c.rtt = Math.round(performance.now() - c.pingSent);
      return;
    }
    if (m.t === 'create') {
      if (c.room) c.room.leave(c);
      if (this.rooms.size >= this.maxRooms) return send(c, { t: 'error', msg: 'Le serveur est plein, réessayez plus tard.' });
      const room = new Room(this.newCode(), this);
      this.rooms.set(room.code, room);
      room.add(c);
      this.tokens.set(c.token, room.code);
      return;
    }
    if (m.t === 'join') {
      const code = sanitize(m.code, 5).toUpperCase();
      const room = this.rooms.get(code);
      if (!room) return send(c, { t: 'error', msg: 'Salon introuvable.' });
      if (c.room === room) return room.broadcastRoom();
      if (room.reattach(c)) return;
      if (c.room) c.room.leave(c);
      if (room.inGame) return send(c, { t: 'error', msg: 'La partie a déjà commencé.' });
      if (!room.add(c)) return send(c, { t: 'error', msg: 'Le salon est complet.' });
      this.tokens.set(c.token, room.code);
      return;
    }
    if (m.t === 'leave') {
      if (c.room) c.room.leave(c);
      this.tokens.delete(c.token);
      return;
    }
    c.room?.handle(c, m);
  }

  close(c: Client) {
    this.clients.delete(c);
    c.room?.disconnect(c);
  }

  private housekeeping() {
    const now = Date.now();
    this.pingN++;
    for (const c of this.clients) {
      c.cmdBudget = CMD_PER_SEC;
      c.chatBudget = Math.min(5, c.chatBudget + 1);
    }
    for (const [code, r] of this.rooms) {
      if (r.emptySince && now - r.emptySince > EMPTY_ROOM_TTL) {
        r.stop();
        this.rooms.delete(code);
        for (const [t, rc] of this.tokens) if (rc === code) this.tokens.delete(t);
      }
    }
    // latence toutes les 2 s
    if (this.pingN % 2 === 0) {
      for (const r of this.rooms.values()) {
        const pings: Record<number, number> = {};
        for (const p of r.players) if (p.client) pings[p.pid] = p.client.rtt;
        for (const p of r.players) {
          const c = p.client;
          if (!c) continue;
          c.pingN = this.pingN;
          c.pingSent = performance.now();
          send(c, { t: 'latency', n: this.pingN, pings });
        }
      }
    }
  }

  stats() {
    let inGame = 0;
    for (const r of this.rooms.values()) if (r.inGame) inGame++;
    return { rooms: this.rooms.size, inGame, clients: this.clients.size };
  }
}
