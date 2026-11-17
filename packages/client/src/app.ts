import * as THREE from 'three';
import {
  ENEMIES, HERO_IDS, LEVELS, buildRuntimeMap, type Difficulty, type EndInfo, type GameConfig, type HeroId, type Mode, type ServerMsg,
} from '@dfend/shared';
import { audio } from './audio/Audio';
import { enemyGeometry } from './art/enemies';
import { K, ensureModels, gameModelKeys, geoFor, loadManifest } from './art/models';
import { heroGeometry } from './art/units';
import { GameClient } from './game/GameClient';
import { LocalHost } from './net/host';
import { RemoteHost, net } from './net/Net';
import { InstPool } from './render/InstPool';
import { Renderer } from './render/Renderer';
import { buildWorld } from './render/World';
import { autoDetect, settings } from './settings';
import { toast, ui } from './state.svelte';

/** Scène 3D de l'écran titre : un diorama animé. */
class TitleScene {
  private group = new THREE.Group();
  private t = 0;
  constructor(private r: Renderer) {
    const map = buildRuntimeMap('pont', 4);
    const w = buildWorld(map);
    this.group.add(w.group);
    r.applyTheme(w.theme);
    const hg = geoFor(K.hero('samuel'), () => heroGeometry('samuel'));
    const heroes = new InstPool(hg.geo, 1, this.group, settings.shadows, hg.map);
    heroes.begin();
    const h = heroes.push(9, 0, 3, -0.6, 1.6);
    heroes.setTeam(h, 0x3b82f6);
    heroes.setPose(h, 0, 0, 0, 1);
    heroes.end();
    const kg = geoFor(K.enemy('kessin2'), () => enemyGeometry('kessin2'));
    const k = new InstPool(kg.geo, 1, this.group, settings.shadows, kg.map);
    k.begin();
    k.setPose(k.push(-20, 5, -34, 0.5, 2.6, 0, 1.2, 0, 2), 0, 0, 0, 1);
    k.end();
    const gg = geoFor(K.enemy('gobelin'), () => enemyGeometry('gobelin'));
    const gob = new InstPool(gg.geo, 8, this.group, settings.shadows, gg.map);
    gob.begin();
    for (let i = 0; i < 6; i++) gob.setPose(gob.push(-6 + i * 1.3, 0, -3 + (i % 2), 0.9, 0.8, i, 6, 0, 0), 0, 0, 0, 1);
    gob.end();
    r.scene.add(this.group);
  }
  update(dt: number) {
    this.t += dt;
    const a = this.t * 0.05;
    const cam = this.r.camera;
    cam.position.set(Math.sin(a) * 30 + 4, 13 + Math.sin(this.t * 0.2) * 1.5, Math.cos(a) * 26 + 6);
    cam.lookAt(2, 1, -2);
    this.r.update(dt, this.t);
    cam.position.set(Math.sin(a) * 30 + 4, 13 + Math.sin(this.t * 0.2) * 1.5, Math.cos(a) * 26 + 6);
    cam.lookAt(2, 1, -2);
  }
  dispose() {
    this.r.scene.remove(this.group);
  }
}

class App {
  renderer!: Renderer;
  game: GameClient | null = null;
  private title: TitleScene | null = null;
  private last = performance.now();
  private pendingStart: { cfg: GameConfig; you: number } | null = null;

  init(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    autoDetect(this.renderer.gl.getContext());
    this.showTitle();
    // modèles importés de l'écran titre : on reconstruit le diorama une fois chargés
    void loadManifest().then(() => ensureModels([K.hero('samuel'), K.enemy('kessin2'), K.enemy('gobelin'), ...gameModelKeys('vallee', [], [])])).then(() => {
      if (this.title && !this.game) {
        this.title.dispose();
        this.title = new TitleScene(this.renderer);
      }
    });
    net.onStatus = (s) => (ui.netStatus = s);
    net.on((m) => this.onServer(m));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game?.host.local && !ui.paused) this.game.setPaused(true);
    });
    const loop = () => {
      const now = performance.now();
      let dt = (now - this.last) / 1000;
      if (settings.fpsCap > 0 && dt < 1 / settings.fpsCap - 0.002) {
        requestAnimationFrame(loop);
        return;
      }
      this.last = now;
      dt = Math.min(dt, 0.1);
      if (!document.hidden) {
        if (this.game) this.game.update(dt);
        else if (this.title) this.title.update(dt);
        this.renderer.render();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  showTitle() {
    if (!this.title) this.title = new TitleScene(this.renderer);
    audio.setBiome('menu');
  }

  private hideTitle() {
    this.title?.dispose();
    this.title = null;
  }

  /** Ticket signé par le serveur pour la partie de survie en cours (sans lui, le score ne peut pas être envoyé). */
  private ticket: string | null = null;
  private starting = 0;

  async startSolo(mode: Mode, mapId: string, difficulty: Difficulty, hero: HeroId, level = -1) {
    const run = ++this.starting;
    let seed = (Math.random() * 2 ** 31) | 0;
    this.ticket = null;
    if (mode === 'survival') {
      // la graine d'une partie classée est choisie par le serveur
      const t = await requestSeed(mapId, difficulty);
      if (run !== this.starting) return; // un autre lancement a eu lieu entre-temps
      if (t) {
        seed = t.seed;
        this.ticket = t.ticket;
      } else toast('Serveur injoignable : partie hors classement.', 'warn', 2500);
    }
    this.leaveGame(false);
    const cfg: GameConfig = { mode, mapId, difficulty, seed, players: [{ id: 0, name: ui.name || 'Samuel', hero }] };
    ui.game = { mode, mapId, difficulty, you: 0, multi: false, level };
    this.launch(cfg, 0, new LocalHost(cfg));
  }

  /** Scène de stress pour le benchmark (?bench). */
  startBench() {
    this.leaveGame(false);
    const cfg: GameConfig = { mode: 'survival', mapId: 'fournaise', difficulty: 1, seed: 1234, players: [{ id: 0, name: 'Bench', hero: 'samuel' }] };
    ui.game = { mode: 'survival', mapId: 'fournaise', difficulty: 1, you: 0, multi: false, level: -1 };
    this.launch(cfg, 0, new LocalHost(cfg, true));
    ui.debug.on = true;
  }

  private launch(cfg: GameConfig, you: number, host: LocalHost | RemoteHost) {
    this.hideTitle();
    ui.end = null;
    ui.paused = false;
    ui.sel = null;
    ui.submitted = false;
    ui.screen = 'game';
    ui.loading = true;
    const gen = ++this.launchGen;
    const biome = buildRuntimeMap(cfg.mapId, cfg.players.length).def.biome;
    // charge les modèles importés nécessaires (manifeste vide : aucune attente)
    loadManifest()
      .then(() => ensureModels(gameModelKeys(biome, ENEMIES.map((e) => e.id), [...HERO_IDS])))
      .catch(() => undefined)
      .then(() => {
        if (gen !== this.launchGen) return;
        ui.loading = false;
        this.game = new GameClient(this.renderer, cfg, host, you, () => this.leaveGame());
      });
  }
  private launchGen = 0;

  leaveGame(toMenu = true) {
    this.launchGen++;
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
    ui.paused = false;
    ui.dialog = null;
    ui.end = null;
    if (toMenu) {
      if (ui.game?.multi && ui.room) {
        ui.screen = 'lobby';
        net.send({ t: 'lobby' });
      } else ui.screen = ui.game?.mode === 'survival' ? 'survival' : ui.game?.mode === 'story' ? 'story' : 'title';
      this.showTitle();
    }
  }

  restart() {
    const g = ui.game;
    if (!g || g.multi || !this.game) return;
    const hero = this.game.cfg.players[0].hero;
    this.startSolo(g.mode, g.mapId, g.difficulty, hero, g.level);
  }

  /** Envoie le score de survie (solo) : le serveur rejoue la partie pour le valider. */
  async submitScore() {
    const g = this.game;
    if (!g || !ui.end || !g.host.getLog || ui.submitted) return;
    ui.submitted = true;
    const ticket = this.ticket;
    if (!ticket) {
      toast('Partie hors classement : score non envoyé.', 'warn');
      return;
    }
    try {
      const log = await g.host.getLog();
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cfg: g.cfg, log, claimed: ui.end.wave, ticket }),
      });
      // le ticket est consommé par le serveur, même en cas de refus
      if (res.status !== 503 && res.status !== 429) this.ticket = null;
      const j = await res.json();
      if (j.ok) toast(`Score validé : vague ${j.wave} !`, 'good');
      else toast('Score refusé : ' + (j.error ?? 'erreur'), 'warn');
    } catch {
      toast('Serveur indisponible : score non envoyé.', 'warn');
      ui.submitted = false;
    }
  }

  // ------------------------------------------------ multijoueur

  private onServer(m: ServerMsg) {
    switch (m.t) {
      case 'error':
        ui.error = m.msg;
        toast(m.msg, 'warn');
        break;
      case 'room':
        ui.room = { code: m.code, you: m.you, players: m.players, settings: m.settings, inGame: m.inGame };
        if (ui.screen === 'multi' || (ui.screen !== 'game' && !m.inGame)) ui.screen = 'lobby';
        break;
      case 'start': {
        const lvl = LEVELS.findIndex((l) => l.mapId === m.cfg.mapId);
        ui.game = { mode: m.cfg.mode, mapId: m.cfg.mapId, difficulty: m.cfg.difficulty, you: m.you, multi: true, level: lvl };
        this.leaveGame(false);
        this.launch(m.cfg, m.you, new RemoteHost(net));
        break;
      }
      case 'end':
        this.game?.handleEnd(m.info as EndInfo);
        break;
      case 'chat': {
        const p = ui.room?.players.find((p) => p.id === m.from);
        ui.chat.push({ from: m.name, text: m.text, color: p ? p.id : 0, t: Date.now() });
        if (ui.chat.length > 40) ui.chat.shift();
        break;
      }
      case 'ping':
        if (this.game) {
          const colors = [0x3b82f6, 0xef4444, 0x22c55e, 0xeab308];
          const c = colors[m.from] ?? 0xffffff;
          for (let k = 0; k < 3; k++) setTimeout(() => this.game?.fx.ring(m.x, m.z, 2.5, c, 0.8, 0.3), k * 250);
          audio.play(m.kind === 2 ? 'deny' : 'click', 1.5);
        }
        break;
      case 'left':
        ui.room = null;
        ui.screen = 'multi';
        break;
      case 'latency':
        for (const p of ui.hud.players) p.ping = m.pings[p.id] ?? 0;
        ui.debug.ping = m.pings[ui.room?.you ?? -1] ?? 0;
        break;
    }
  }

  connect() {
    net.connect(ui.name || 'Joueur');
  }
}

export const app = new App();
(window as unknown as { __ping: (x: number, z: number) => void }).__ping = (x, z) => net.send({ t: 'ping', kind: 0, x, z });
export { ENEMIES, HERO_IDS };

/** Demande au serveur une graine signée pour une partie de survie. */
async function requestSeed(mapId: string, difficulty: Difficulty): Promise<{ seed: number; ticket: string } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  try {
    const res = await fetch('/api/seed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mapId, difficulty }),
      signal: ctl.signal,
    });
    const j = await res.json();
    return j.ok && Number.isFinite(j.seed) && typeof j.ticket === 'string' ? { seed: j.seed, ticket: j.ticket } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
