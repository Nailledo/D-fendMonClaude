import {
  ENEMIES, HERO_IDS, LEVELS, buildRuntimeMap, type Difficulty, type EndInfo, type GameConfig, type HeroId, type Mode, type ServerMsg,
} from '@dfend/shared';
import { audio } from './audio/Audio';
import { K, buildLods, ensureModels, gameModelKeys, loadManifest, portraitModelKeys } from './art/models';
import { endLoading, nextFrame, setLoading, span, startLoading, warmup } from './loading';
import { renderIcons3DProgressive } from './render/icons3d';
import { renderPortraits } from './render/portraits';
import { GameClient } from './game/GameClient';
import { LocalHost } from './net/host';
import { RemoteHost, net } from './net/Net';
import { applyLods } from './render/InstPool';
import { Renderer } from './render/Renderer';
import { TitleScene } from './render/TitleScene';
import { autoDetect, settings, tuning } from './settings';
import { toast, ui } from './state.svelte';

class App {
  renderer!: Renderer;
  game: GameClient | null = null;
  private title: TitleScene | null = null;
  private last = performance.now();
  private pendingStart: { cfg: GameConfig; you: number } | null = null;

  init(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    autoDetect(this.renderer.gl.getContext());
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
        applyLods(this.renderer.pixelsPerUnit(), tuning().lodBias);
        this.renderer.render();
        this.dynamicResolution((now - this.frameStart) / 1000);
      }
      this.frameStart = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * Chargement initial, derrière l'écran de chargement : modèles de l'accueil et des portraits,
   * niveaux de détail, portraits, icônes 3D, puis préchauffage des shaders de la scène d'accueil.
   * L'accueil n'apparaît qu'une fois tout prêt (plus de modèles qui changent sous les yeux).
   */
  async boot() {
    startLoading('Chargement…');
    try {
      await loadManifest();
      setLoading(0.04, 'Chargement des modèles 3D…');
      const keys = [K.hero('samuel'), ...['kessin1', 'gobelin', 'loup', 'brute', 'corbeau'].map(K.enemy), ...gameModelKeys('vallee', [], []), ...portraitModelKeys()];
      await ensureModels(keys, span(0.04, 0.6));
      await buildLods(keys, span(0.6, 0.7, 'Optimisation des modèles…'));
      setLoading(0.7, 'Portraits des héros…');
      await nextFrame();
      ui.portraits = renderPortraits();
      await renderIcons3DProgressive((chunk) => (ui.icons = { ...ui.icons, ...chunk }), 160, 6, span(0.72, 0.9, 'Icônes…'));
    } catch (e) {
      console.warn('Chargement incomplet :', e);
    }
    setLoading(0.9, 'Préparation de la scène…');
    await nextFrame();
    if (!this.game) {
      this.showTitle();
      this.title!.update(1 / 60);
      await warmup(this.renderer.gl, this.renderer.scene, this.renderer.camera);
    }
    await endLoading();
  }

  private frameStart = performance.now();
  private dyn = { acc: 0, n: 0, good: 0 };

  /**
   * Résolution dynamique : si les images ralentissent nettement pendant ~1,5 s, on baisse la densité de pixels
   * (jusqu'à 55 %), puis on la remonte doucement quand la marge revient. Coupée pendant les chargements.
   */
  private dynamicResolution(frame: number) {
    const r = this.renderer, d = this.dyn;
    if (!settings.dynRes || ui.loading.active || frame > 0.25) {
      if (!settings.dynRes && r.dynScale !== 1) { r.dynScale = 1; r.applyPixelRatio(); }
      d.acc = d.n = 0;
      return;
    }
    d.acc += frame;
    d.n++;
    if (d.acc < 1.5) return;
    const avg = d.acc / d.n;
    d.acc = d.n = 0;
    const target = settings.fpsCap > 0 ? 1 / settings.fpsCap : 1 / 60;
    let s = r.dynScale;
    if (avg > target * 1.3 + 0.002) { s = Math.max(0.55, s - 0.1); d.good = 0; }
    else if (avg < target * 1.08 && ++d.good >= 2) { s = Math.min(1, s + 0.05); d.good = 0; }
    if (s !== r.dynScale) {
      r.dynScale = s;
      r.applyPixelRatio();
    }
    ui.debug.res = Math.round(r.gl.getPixelRatio() * 100);
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
    const gen = ++this.launchGen;
    const def = buildRuntimeMap(cfg.mapId, cfg.players.length).def;
    startLoading('Chargement des modèles 3D…', def.name);
    // la simulation locale attend la fin du chargement (le compte à rebours ne tourne pas pendant ce temps)
    if (host.local) host.pause(true);
    void (async () => {
      // en histoire, la princesse et le roi jouent dans le prologue
      const keys = gameModelKeys(def.biome, ENEMIES.map((e) => e.id), cfg.mode === 'story' ? [...HERO_IDS, 'ethan', 'roi'] : [...HERO_IDS]);
      try {
        await loadManifest();
        await ensureModels(keys, span(0, 0.55));
        await buildLods(keys, span(0.55, 0.7, 'Optimisation des modèles…'));
      } catch (e) {
        console.warn('Modèles incomplets :', e);
      }
      if (gen !== this.launchGen) return;
      setLoading(0.72, 'Construction du monde…');
      await nextFrame();
      if (gen !== this.launchGen) return;
      const game = new GameClient(this.renderer, cfg, host, you, () => this.leaveGame());
      this.game = game;
      ui.gameId++;
      setLoading(0.85, 'Préparation des effets…');
      await nextFrame();
      this.renderer.update(1 / 60, performance.now() / 1000);
      await warmup(this.renderer.gl, this.renderer.scene, this.renderer.camera);
      if (gen !== this.launchGen) return;
      await endLoading();
      if (gen === this.launchGen) game.resumeAfterLoad();
    })();
  }
  private launchGen = 0;

  leaveGame(toMenu = true) {
    this.launchGen++;
    ui.loading.active = false;
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
