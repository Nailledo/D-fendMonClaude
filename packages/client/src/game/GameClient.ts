import * as THREE from 'three';
import {
  AVENTURIER, CLASSES, ENEMIES, skinIndex, bossPhase, NIGHT_RANGE, TORCH_R, Ev, FAMILIES, HERO_RESPAWN_S, ITEMS, Item, perksOf, survivalStars, FIRE_HERO_ARROW, FIRE_HERO_BOLT, FIRE_METEOR, FIRE_TURRET, GameState, Impact,
  LEVEL_SPEC_A, MUTATIONS, PF_ACTIVE, PF_CONNECTED, PF_SPEED2, PLAYER_COLORS, SPELLS, sanitizeSpells, Src, TICK_RATE, TOWERS, UF_DEAD, UF_FOCUS,
  ET_FLEEING, ET_REVEALED, PROP_FOUND, PROP_INFO, PropKind, SECRETS, SECRET_TOTAL, PRIO_NAMES, SHOOTERS, SKILL_UNLOCK, TRAITS, Trait, kitSkills, classLook, heroPoints, buildRuntimeMap, campAura, type Command, type GameConfig, type RuntimeMap, type Snapshot,
} from '@dfend/shared';
import { audio } from '../audio/Audio';
import { Entities } from '../render/Entities';
import { forgetPools } from '../render/InstPool';
import { Decal, Fx, SHOT_BOULDER } from '../render/Fx';
import { WeatherView } from '../render/Weather';
import { PropsView } from '../render/Props';
import type { Renderer } from '../render/Renderer';
import { buildWorld, type WorldInfo } from '../render/World';
import type { Host } from '../net/host';
import { ACTION_LABELS, keys, settings, type Action } from '../settings';
import { banner, progress, saveProgress, toast, ui } from '../state.svelte';
import { addBonusStars, consumeItem, spellText } from '../meta';
import { PROLOGUE, STORY } from '../story/dialogs';
import { Prologue } from './Prologue';
import { drape } from '../render/drape';
import { Interp } from './Interp';
import { radialRadius } from '../ui/radialLayout';

/** Éléments DOM positionnés à chaque frame (sans passer par la réactivité). */
export const dom: { radial: HTMLElement | null; waves: (HTMLElement | null)[]; dmg: HTMLElement | null; pings: HTMLElement | null } = {
  radial: null, waves: [], dmg: null, pings: null,
};

type Targeting = null | { kind: 'spell'; s: 0 | 1 } | { kind: 'item'; i: number } | { kind: 'hskill'; i: 0 | 1 | 2 } | { kind: 'rally'; tower: number } | { kind: 'hmove' };

const FAM_ACTIONS: Action[] = ['buildArcher', 'buildBarracks', 'buildMage', 'buildArtillery', 'buildMine', 'buildCamp'];
const DEATH_COLORS: Record<string, number> = { vallee: 0x7cb342, marais: 0x6f9a8a, cendre: 0xd84315 };

/**
 * Position de l'arc de Patoche en joue (voir la pose « arc » du vertex shader) : main gauche tendue vers la cible,
 * un peu à gauche de l'axe du corps, à hauteur d'épaule. Les flèches partent de là.
 */
function bowPos(hx: number, hz: number, tx: number, tz: number, out: { x: number; y: number; z: number }) {
  const dx = tx - hx, dz = tz - hz, l = Math.hypot(dx, dz) || 1;
  const fx = dx / l, fz = dz / l;
  out.x = hx + fx * 0.7 + fz * 0.12;
  out.z = hz + fz * 0.7 - fx * 0.12;
  out.y = 0.88;
  return out;
}

/** Compétences du héros du joueur (d'après sa classe, reçue dans l'instantané). */
function hudSkills() {
  const h = ui.hud.hero;
  return kitSkills(h.cls, h.kit);
}
/** Rayon de l'anneau de visée des compétences de zone. */
const SKILL_RADIUS: Record<string, number> = {
  pluie: 2.3, boule: 1.9, flammes: 2.4, meteore: 3, acide: 2, transmutation: 2.8, bombe: 2.2, visee: 2.2, golem: 1.2,
  cyclone: 2.6, piege: 1.4, filet: 3, blizzard: 3, eclair: 2.5, prison: 2.8, peste: 2.4, malediction: 3, usine: 2, grenades: 1.6, barrage: 2.6,
};

/** Conseil affiché la première fois qu'une propriété d'ennemi apparaît. */
const TRAIT_ADVICE = [
  'Invisible aux tours tant qu’une tour de mages, une tour de guet (campement spécialisé) ou votre héros ne le repère pas.',
  'Flèches et lames ricochent : misez sur les mages, l’artillerie et les sorts.',
  'Il se soigne s’il n’est pas blessé un moment : gardez-le sous le feu, le poison et la brûlure l’en empêchent.',
];

/** Compétences lancées (type de projectile visuel) : l'impact attend l'arrivée de l'objet. */
const THROW_FX: Record<string, number> = { bombe: 12, grenades: 12, piege: 12, filet: 12, boule: 5, acide: 9, peste: 9, transmutation: 3, prison: 3, malediction: 3 };
/** Compétences en pirouette, et en bond suivi d'un coup au sol. */
const SPIN_FX = new Set(['tourbillon', 'lames', 'faux', 'elan']);
const SLAM_FX = new Set(['marteau', 'colere', 'seisme', 'coup', 'ethan', 'rempart']);

export class GameClient {
  readonly map: RuntimeMap;
  readonly world: WorldInfo;
  readonly ents: Entities;
  readonly fx: Fx;
  readonly interp: Interp;
  private scratch: { tick: number; ev: number[] }[] = [];
  private targeting: Targeting = null;
  /** instant du dernier ordre d'attaque (la marque de cible pulse brièvement) */
  private focusPulse = -10;
  private mouse = { x: 0, y: 0, down: false, button: -1, sx: 0, sy: 0, moved: false, inside: true };
  private keysDown = new Set<string>();
  private hoverSlot = -1;
  private time = 0;
  /** zones durables des compétences (cyclone, blizzard, peste…) : particules émises tant qu'elles durent */
  private zoneFx: { kind: number; x: number; z: number; r: number; end: number; acc: number }[] = [];
  private hudT = 0;
  private rangeRing: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private rallyFlag: THREE.Mesh;
  private aimRing: THREE.Mesh;
  /** marque rouge sous l'ennemi que votre héros a reçu l'ordre d'attaquer */
  private focusRing: THREE.Mesh;
  private disposers: (() => void)[] = [];
  private proj = { x: 0, y: 0, visible: false };
  private seenTypes = new Set<string>(progress.seen);
  private dialogPaused = false;
  /** mise en scène 3D du prologue (première partie de l'histoire) */
  private prologue: Prologue | null = null;
  private lastWave = 0;
  /** chapardeurs en fuite avec votre or (id → or volé) */
  private thieves = new Map<number, number>();
  /** boss déjà présentés (entrée en scène) */
  private bossSeen = new Set<number>();
  private tmpP = { x: 0, z: 0 };
  private weather: WeatherView;
  /** carte interactive : tonneaux, camp, secrets */
  private props: PropsView;
  private hoverProp = -1;
  private sparkleT = 3;
  /** gestes de compétence en cours (`at` en ticks de rendu) : l'impact attend que l'objet lancé arrive (ou que le héros retombe) */
  private pendingFx: { tick: number; x: number; z: number; delay: number; made: number }[] = [];
  private deferredFx: { at: number; tick: number; ev: number[] }[] = [];
  private replayFx = false;
  private ended = false;
  private dmgIdx = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private tpos = { x: 0, y: 0, z: 0 };
  /** vies au départ (pour l'état du château) */
  private maxLives = 1;
  private projScreen = new THREE.Matrix4();
  snapshotBytes = 0;

  constructor(
    private r: Renderer,
    readonly cfg: GameConfig,
    readonly host: Host,
    readonly you: number,
    private onLeaveRequest: () => void,
  ) {
    this.map = buildRuntimeMap(cfg.mapId, cfg.players.length);
    this.world = buildWorld(this.map);
    r.scene.add(this.world.group);
    r.applyTheme(this.world.theme);
    r.setBounds(this.map.def.hw, this.map.def.hh, this.world.exit);
    // objets de boutique emportés dans cette partie
    ui.hud.spellIds = sanitizeSpells(cfg.players.find((p) => p.id === you)?.spells);
    ui.hud.items = ITEMS.map((_, i) => cfg.players.find((p) => p.id === you)?.items?.[i] ?? 0);
    this.ents = new Entities(r.scene, this.map);
    for (const p of cfg.players) this.ents.playerSkin[p.id] = skinIndex(p.skin);
    this.ents.tunnels = this.world.entries;
    this.ents.heightAt = this.world.heightAt;
    const cs = this.world.castle;
    this.ents.castleGate = { x: cs.x, z: cs.z, dx: cs.dx, dz: cs.dz };
    this.fx = new Fx(r.scene);
    this.fx.setGround(this.world.ground);
    this.weather = new WeatherView(this.map.torches, this.world.heightAt);
    r.scene.add(this.weather.group);
    this.props = new PropsView(this.map.props, this.map.def.biome, this.world.heightAt);
    r.scene.add(this.props.group);
    this.interp = new Interp(this.map, host.local);
    host.onSnapshot = (b) => {
      this.snapshotBytes += b.byteLength;
      this.interp.push(b);
    };
    // anneaux de sélection
    const ringMat = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    const rg = new THREE.RingGeometry(0.97, 1, 96);
    rg.rotateX(-Math.PI / 2);
    this.rangeRing = new THREE.Mesh(rg, ringMat(0xffffff, 0.75));
    const disc = new THREE.RingGeometry(0, 1, 48, 6);
    disc.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(disc, ringMat(0xffffff, 0.08));
    this.rangeRing.add(fill);
    this.rangeRing.position.y = 0.09;
    this.rangeRing.visible = false;
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 32).rotateX(-Math.PI / 2), ringMat(0xfff3b0, 0.8));
    this.hoverRing.position.y = 0.1;
    this.hoverRing.visible = false;
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), ringMat(0xffd54f, 0.9));
    this.aimRing.position.y = 0.1;
    this.aimRing.visible = false;
    this.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40).rotateX(-Math.PI / 2), ringMat(0xef4444, 0.9));
    this.focusRing.visible = false;
    const flag = new THREE.Group();
    this.rallyFlag = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0x5d4037 }));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd54f, side: THREE.DoubleSide }));
    cloth.position.set(0.3, 0.45, 0);
    this.rallyFlag.add(cloth);
    this.rallyFlag.visible = false;
    void flag;
    for (const m of [this.rangeRing, this.hoverRing, this.aimRing, this.focusRing, this.rallyFlag]) r.scene.add(m);
    this.bindInput();
    audio.setBiome(this.map.def.biome);
    audio.intensity = 0;
    ui.hud.players = cfg.players.map((p) => ({ id: p.id, name: p.name, gold: 0, connected: true, active: true, hero: p.hero, speed2: false, ping: 0 }));
    host.onEnd = (info) => this.handleEnd({ ...info, mode: cfg.mode, mapId: cfg.mapId, difficulty: cfg.difficulty });
    this.startStory();
  }

  // ------------------------------------------------------------ histoire

  private startStory() {
    if (this.cfg.mode !== 'story' || !ui.game) return;
    const lv = ui.game.level;
    const story = STORY[lv];
    if (!story) return;
    const lines = [...story.intro];
    if (lv === 0 && (!progress.seenPrologue || ui.replayPrologue)) {
      progress.seenPrologue = true;
      ui.replayPrologue = false;
      saveProgress();
      lines.unshift(...PROLOGUE);
      this.prologue = new Prologue(this.r, this.fx, this.world.exit);
      this.ents.hideHeroes = true;
    }
    this.showDialog(lines);
  }

  showDialog(lines: { who: string; text: string }[]) {
    if (!lines.length) return;
    ui.dialog = { lines: lines as never, i: 0 };
    if (this.host.local) {
      this.dialogPaused = true;
      this.host.pause(true);
    }
  }

  dialogDone() {
    ui.dialog = null;
    if (this.dialogPaused) {
      this.dialogPaused = false;
      if (!ui.paused) this.host.pause(false);
    }
  }

  /** Fin de l'écran de chargement : la simulation locale repart (sauf dialogue ou pause en cours). */
  resumeAfterLoad() {
    if (this.host.local && !this.dialogPaused && !ui.paused) this.host.pause(false);
  }

  setPaused(v: boolean) {
    if (!this.host.local) return;
    ui.paused = v;
    this.host.pause(v || this.dialogPaused);
  }

  // ------------------------------------------------------------ commandes

  send(c: Command) {
    this.host.send(c);
  }

  build(fam: number) {
    const s = ui.sel;
    if (!s || s.kind !== 'build' || s.slot === undefined) return;
    const cost = TOWERS[FAMILIES[fam]][0].cost;
    if (ui.hud.gold < cost) { audio.play('deny'); toast('Pas assez d’or', 'warn', 1500); return; }
    this.send({ k: 'build', slot: s.slot, fam });
    ui.sel = null;
  }

  upgrade(spec?: 1 | 2) {
    const s = ui.sel;
    // toute tour peut être améliorée, y compris celle d'un coéquipier (avec son propre or)
    if (!s || s.kind !== 'tower' || s.tower === undefined) return;
    const fam = FAMILIES[s.fam ?? 0];
    const cost = spec ? TOWERS[fam][2 + spec].cost : (s.level ?? 0) < 2 ? TOWERS[fam][(s.level ?? 0) + 1].cost : 0;
    if (ui.hud.gold < cost) { audio.play('deny'); toast('Pas assez d’or', 'warn', 1500); return; }
    if (spec) this.send({ k: 'spec', tower: s.tower, s: spec });
    else if ((s.level ?? 0) < 2) this.send({ k: 'up', tower: s.tower });
    // la sélection reste ouverte : le panneau montre aussitôt les nouvelles statistiques
    this.hoverLevel = -1;
  }

  skill(i: 0 | 1) {
    const s = ui.sel;
    if (!s || s.kind !== 'tower' || s.tower === undefined) return;
    this.send({ k: 'skill', tower: s.tower, i });
  }

  sell() {
    const s = ui.sel;
    if (!s || s.kind !== 'tower' || !s.mine || s.tower === undefined) return;
    this.send({ k: 'sell', tower: s.tower });
    ui.sel = null;
  }

  /** Priorité de ciblage de la tour sélectionnée (sans argument : la suivante). */
  setPrio(p?: number) {
    const s = ui.sel;
    if (!s || s.kind !== 'tower' || !s.mine || s.tower === undefined || !SHOOTERS.includes(s.fam ?? -1)) return;
    const next = p ?? ((s.prio ?? 0) + 1) % PRIO_NAMES.length;
    this.send({ k: 'prio', tower: s.tower, p: next });
    // affichage immédiat (le prochain instantané confirme)
    s.prio = next;
    audio.play('click');
  }

  startRally() {
    const s = ui.sel;
    if (!s || s.kind !== 'tower' || !s.mine || s.fam !== 1 || s.tower === undefined) return;
    this.targeting = { kind: 'rally', tower: s.tower };
    ui.hud.targeting = 'Choisissez le point de ralliement';
  }

  castSpell(s: 0 | 1) {
    if (ui.hud.spells[s] > 0) { audio.play('deny'); return; }
    const def = SPELLS[ui.hud.spellIds[s]];
    // sort immédiat (sans zone à viser) : lancé tout de suite
    if (def.radius === 0) { this.send({ k: 'spell', s, x: 0, z: 0 }); return; }
    this.targeting = { kind: 'spell', s };
    ui.sel = null;
    ui.hud.targeting = def.name + (ui.touch ? ' : touchez la carte' : ' : cliquez sur la carte');
  }

  /** Objet de boutique : immédiat (or, vies) ou à lancer sur la carte (givre, bombe). */
  useItem(i: number) {
    const it = ITEMS[i];
    if (!it || (ui.hud.items[i] ?? 0) <= 0) { audio.play('deny'); return; }
    if (!it.targeted) {
      this.send({ k: 'item', i, x: 0, z: 0 });
      return;
    }
    this.targeting = { kind: 'item', i };
    ui.sel = null;
    ui.hud.targeting = it.name + (ui.touch ? ' : touchez la carte' : ' : cliquez sur la carte');
  }

  heroSkill(i: 0 | 1 | 2) {
    const h = ui.hud.hero;
    const sk = hudSkills()[i];
    if (!sk || h.dead || h.level < SKILL_UNLOCK[i] || h.cds[i] > 0) { audio.play('deny'); return; }
    if (!sk.targeted) {
      const hp = this.heroPos();
      if (hp) this.send({ k: 'hskill', i, x: hp.x, z: hp.z });
      return;
    }
    this.targeting = { kind: 'hskill', i };
    ui.hud.targeting = sk.name + (ui.touch ? ' : touchez la carte' : ' : cliquez sur la carte');
  }

  selectHero() {
    const hp = this.heroPos();
    if (!hp) return;
    ui.sel = { kind: 'hero' };
    this.targeting = { kind: 'hmove' };
    ui.hud.targeting = ui.touch ? 'Touchez la carte pour déplacer votre héros' : 'Cliquez pour déplacer votre héros';
  }

  focusHero() {
    const hp = this.heroPos();
    if (hp) this.r.focus(hp.x, hp.z);
  }

  callWave() {
    this.send({ k: 'wave' });
  }

  toggleSpeed() {
    const me = ui.hud.players.find((p) => p.id === this.you);
    this.send({ k: 'speed', v: me?.speed2 ? 1 : 2 });
  }

  gift(to: number) {
    this.send({ k: 'gift', to, amt: 50 });
  }

  cancel() {
    this.targeting = null;
    ui.hud.targeting = '';
    ui.sel = null;
  }

  private heroPos(): { x: number; z: number } | null {
    const s = this.interp.latest;
    if (!s) return null;
    const hi = s.heroIndex(this.you);
    if (hi < 0) return null;
    const ui_ = this.interp.frame.unitIdx(s.hUnit[hi]);
    if (ui_ < 0) return null;
    return { x: this.interp.frame.uX[ui_], z: this.interp.frame.uZ[ui_] };
  }

  private perkCache = new Map<number, ReturnType<typeof perksOf>>();
  /** Bonus de l'arbre de compétences d'un joueur de la partie. */
  private perksFor(pid: number) {
    let p = this.perkCache.get(pid);
    if (!p) { p = perksOf(this.cfg.players.find((q) => q.id === pid)?.tree); this.perkCache.set(pid, p); }
    return p;
  }

  /** Portée maximale d'une compétence ciblée du héros (charge de Samuel), sinon 0. */
  private skillRange(i: number): number {
    return hudSkills()[i]?.range ?? 0;
  }

  /** Point visé ramené à la portée de la compétence, depuis le héros. */
  private clampSkill(i: number, p: { x: number; z: number }): { x: number; z: number } {
    const range = this.skillRange(i), hp = this.heroPos();
    if (!range || !hp) return p;
    const dx = p.x - hp.x, dz = p.z - hp.z, d = Math.hypot(dx, dz);
    return d <= range ? p : { x: hp.x + (dx / d) * range, z: hp.z + (dz / d) * range };
  }

  // ------------------------------------------------------------ entrées

  private bindInput() {
    const c = this.r.gl.domElement;
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => t.removeEventListener(type, fn as EventListener));
    };
    on(c, 'contextmenu', (e) => e.preventDefault());
    // iOS : bloque le zoom de page par pincement (gesturestart n'est pas un PointerEvent)
    on(document, 'gesturestart' as keyof WindowEventMap, (e) => e.preventDefault(), { passive: false });
    let longPress: ReturnType<typeof setTimeout> | null = null;
    const stopLongPress = () => {
      if (longPress) clearTimeout(longPress);
      longPress = null;
    };
    this.disposers.push(stopLongPress);
    /** pointeurs posés sur la carte (souris ou doigts) */
    const pts = new Map<number, { x: number; y: number; type: string }>();
    /** geste en cours : glisser à un pointeur (ancre au sol) ou pincement à deux */
    let drag: { id: number; wx: number; wz: number } | null = null;
    let pinch: { d0: number; dist0: number; wx: number; wz: number } | null = null;
    /** un pincement a eu lieu depuis le premier appui : aucun clic à la fin du geste */
    let gestured = false;
    let vel = { x: 0, z: 0, t: 0 };
    let lastTap = { t: 0, x: 0, y: 0 };
    const r = this.r;
    const startDrag = (id: number, x: number, y: number) => {
      const p = r.pick(x, y);
      if (!p) return;
      r.beginDrag();
      drag = { id, wx: p.x, wz: p.z };
      vel = { x: 0, z: 0, t: performance.now() };
    };
    const startPinch = () => {
      const [a, b] = [...pts.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const p = r.pick(mx, my);
      if (!p) return;
      r.beginDrag();
      pinch = { d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), dist0: r.cam.dist, wx: p.x, wz: p.z };
      drag = null;
    };
    const release = () => {
      const fresh = performance.now() - vel.t < 80;
      r.endDrag(fresh ? vel.x : 0, fresh ? vel.z : 0);
      drag = null;
      pinch = null;
    };
    const canPan = (type: string) => type === 'touch' || this.mouse.button === 1 || this.mouse.button === 2 || (this.mouse.button === 0 && !this.targeting);

    on(c, 'pointerdown', (e) => {
      audio.unlock();
      try { c.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (pts.size === 1) {
        gestured = false;
        this.mouse.down = true;
        this.mouse.button = e.button;
        this.mouse.sx = e.clientX;
        this.mouse.sy = e.clientY;
        this.mouse.moved = false;
        if (r.cam.vx || r.cam.vz) { r.beginDrag(); r.endDrag(0, 0); } // un appui arrête l'inertie
      } else if (pts.size === 2) {
        gestured = true;
        this.mouse.moved = true;
        stopLongPress();
        startPinch();
        return;
      }
      // tactile : un appui long remplace le clic droit (déplacer le héros, attaquer un ennemi, annuler une visée)
      stopLongPress();
      if (e.pointerType === 'touch') {
        const x = e.clientX, y = e.clientY;
        longPress = setTimeout(() => {
          longPress = null;
          if (!this.mouse.down || this.mouse.moved || pts.size !== 1) return;
          this.mouse.down = false;
          gestured = true;
          navigator.vibrate?.(15);
          this.rightClick(x, y);
        }, 450);
      }
    });
    on(window, 'pointermove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      const pt = pts.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
        r.dragTo((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.wx, pinch.wz, pinch.dist0 * (pinch.d0 / d));
        vel.t = 0; // pas d'inertie après un pincement
        return;
      }
      if (!this.mouse.down) return;
      const slop = e.pointerType === 'touch' ? 10 : 6;
      if (!this.mouse.moved && Math.hypot(e.clientX - this.mouse.sx, e.clientY - this.mouse.sy) > slop) {
        this.mouse.moved = true;
        stopLongPress();
        if (canPan(e.pointerType)) startDrag(e.pointerId, this.mouse.sx, this.mouse.sy);
      }
      if (drag && drag.id === e.pointerId) {
        const m = r.dragTo(e.clientX, e.clientY, drag.wx, drag.wz);
        const now = performance.now(), dt = Math.max(1, now - vel.t) / 1000;
        const k = Math.min(1, dt * 25);
        vel = { x: vel.x + (m.dx / dt - vel.x) * k, z: vel.z + (m.dz / dt - vel.z) * k, t: now };
      }
    });
    const up = (e: PointerEvent) => {
      const had = pts.delete(e.pointerId);
      if (!had) return;
      try { c.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
      if (pts.size === 1) {
        // fin du pincement : le doigt restant reprend le glisser sans saut
        pinch = null;
        const [[id, p]] = [...pts.entries()];
        startDrag(id, p.x, p.y);
        vel.t = 0;
        return;
      }
      if (pts.size > 0) return;
      stopLongPress();
      if (drag || pinch) release();
      if (!this.mouse.down) return;
      this.mouse.down = false;
      if (this.mouse.moved || gestured || e.type === 'pointercancel') return;
      if (e.button === 0 || e.pointerType === 'touch') {
        const hit = this.click(e.clientX, e.clientY, e.altKey);
        // double appui sur le terrain : zoom avant / retour à la vue d'ensemble
        if (e.pointerType === 'touch') {
          const now = performance.now();
          if (!hit && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
            const cam = r.cam;
            if (cam.tdist > cam.fit * 0.7) r.zoomTo(cam.fit * 0.45, e.clientX, e.clientY);
            else r.zoomTo(cam.fit, e.clientX, e.clientY);
            lastTap.t = 0;
          } else lastTap = { t: hit ? 0 : now, x: e.clientX, y: e.clientY };
        }
      } else if (e.button === 2) this.rightClick(e.clientX, e.clientY);
    };
    on(window, 'pointerup', up);
    on(window, 'pointercancel', up);
    on(c, 'wheel', (e) => {
      e.preventDefault();
      // pavé tactile (ctrl + molette = pincement) : pas plus fin ; souris : pas fixe
      const step = e.ctrlKey ? Math.max(-0.25, Math.min(0.25, e.deltaY * 0.01)) : Math.sign(e.deltaY) * 0.14;
      r.zoom(step, e.clientX, e.clientY);
    }, { passive: false });
    on(document, 'mouseleave' as keyof WindowEventMap, () => (this.mouse.inside = false));
    on(document, 'mouseenter' as keyof WindowEventMap, () => (this.mouse.inside = true));
    // maintenir Alt affiche tous les raccourcis clavier
    const keysHeld = (on_: boolean) => document.documentElement.classList.toggle('keys-held', on_);
    this.disposers.push(() => keysHeld(false));
    on(window, 'keydown', (e) => {
      if (e.key === 'Alt') keysHeld(true);
      this.key(e);
    });
    on(window, 'keyup', (e) => {
      if (e.key === 'Alt') keysHeld(false);
      this.keysDown.delete(e.code);
    });
    on(window, 'blur', () => {
      keysHeld(false);
      this.keysDown.clear();
    });
  }

  private action(code: string): Action | null {
    for (const a of Object.keys(keys) as Action[]) if (keys[a] === code) return a;
    return null;
  }

  private key(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ui.overlay === 'settings' && document.querySelector('[data-capturing]')) return;
    const a = this.action(e.code);
    if (!a) return;
    if (a.startsWith('cam')) { this.keysDown.add(e.code); e.preventDefault(); return; }
    if (e.repeat) return;
    if (ui.dialog && (a === 'wave' || a === 'menu')) {
      e.preventDefault();
      if (a === 'menu') this.dialogDone();
      else this.nextDialog();
      return;
    }
    e.preventDefault();
    audio.unlock();
    switch (a) {
      case 'menu':
        if (this.targeting || ui.sel) this.cancel();
        else if (ui.overlay) ui.overlay = null;
        else if (this.host.local) this.setPaused(!ui.paused);
        else ui.paused = !ui.paused;
        break;
      case 'hero': this.selectHero(); this.focusHero(); break;
      case 'skill1': this.heroSkill(0); break;
      case 'skill2': this.heroSkill(1); break;
      case 'ult': this.heroSkill(2); break;
      case 'spell1': this.castSpell(0); break;
      case 'spell2': this.castSpell(1); break;
      case 'buildArcher': case 'buildBarracks': case 'buildMage': case 'buildArtillery': case 'buildMine': case 'buildCamp': {
        const fam = FAM_ACTIONS.indexOf(a);
        if (this.hoverSlot >= 0 && !this.towerAtSlot(this.hoverSlot)) ui.sel = { kind: 'build', slot: this.hoverSlot };
        this.build(fam);
        break;
      }
      case 'upgrade': {
        this.selectHoveredTower();
        const s = ui.sel;
        if (s?.kind === 'tower' && (s.level ?? 0) < 2) this.upgrade();
        break;
      }
      case 'sell': this.selectHoveredTower(); this.sell(); break;
      case 'rally': this.selectHoveredTower(); this.startRally(); break;
      case 'prio': this.selectHoveredTower(); this.setPrio(); break;
      case 'wave': this.callWave(); break;
      case 'speed': this.toggleSpeed(); break;
      case 'chat': if (!this.host.local) ui.chatOpen = true; break;
      case 'debug': ui.debug.on = !ui.debug.on; break;
    }
    void ACTION_LABELS;
  }

  private selectHoveredTower() {
    if (this.hoverSlot < 0) return;
    const t = this.towerAtSlot(this.hoverSlot);
    if (t >= 0) this.selectTowerIndex(t);
  }

  private towerAtSlot(slot: number): number {
    const s = this.interp.latest;
    if (!s) return -1;
    for (let i = 0; i < s.tCount; i++) if (s.tSlot[i] === slot) return i;
    return -1;
  }

  private selectTowerIndex(i: number) {
    const s = this.interp.latest!;
    ui.sel = {
      kind: 'tower', slot: s.tSlot[i], tower: s.tId[i], fam: s.tFam[i], level: s.tLevel[i],
      sk: [s.tSk[i] & 15, s.tSk[i] >> 4], owner: s.tOwner[i], mine: s.tOwner[i] === this.you, prio: s.tPrio[i],
    };
  }

  /** Rayon de sélection : au moins `px` pixels à l'écran (un doigt est moins précis qu'une souris). */
  private tapRadius(base: number, px = ui.touch ? 26 : 10) {
    const perPx = (this.r.cam.dist * 2 * Math.tan((this.r.camera.fov * Math.PI) / 360)) / Math.max(1, this.r.height);
    return Math.max(base, px * perPx);
  }

  private slotAt(x: number, z: number, rad = 1.5): number {
    let best = -1, bd = rad * rad;
    this.map.slots.forEach((s, i) => {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** Clic ou appui sur la carte. Retourne vrai s'il a visé quelque chose (pas le terrain nu). */
  private click(sx: number, sy: number, alt: boolean): boolean {
    const p = this.r.pick(sx, sy);
    if (!p) return false;
    if (alt && !this.host.local) {
      (window as unknown as { __ping?: (x: number, z: number) => void }).__ping?.(p.x, p.z);
      return true;
    }
    const slotRad = this.tapRadius(1.5);
    const t = this.targeting;
    if (t) {
      this.targeting = null;
      ui.hud.targeting = '';
      if (t.kind === 'spell') { this.send({ k: 'spell', s: t.s, x: p.x, z: p.z }); this.fx.ring(p.x, p.z, 1.2, 0xffffff, 0.35); return true; }
      if (t.kind === 'item') { this.send({ k: 'item', i: t.i, x: p.x, z: p.z }); return true; }
      if (t.kind === 'hskill') { const q = this.clampSkill(t.i, p); this.send({ k: 'hskill', i: t.i, x: q.x, z: q.z }); return true; }
      if (t.kind === 'rally') { this.send({ k: 'rally', tower: t.tower, x: p.x, z: p.z }); ui.sel = null; this.fx.ring(p.x, p.z, 1, 0xfff59d, 0.5); return true; }
      if (t.kind === 'hmove') {
        // héros sélectionné puis appui sur un ennemi (tactile surtout) : il l'attaque
        const ei = this.slotAt(p.x, p.z, slotRad) < 0 ? this.enemyAt(sx, sy, p, true) : -1;
        if (ei >= 0) { this.attackEnemy(ei); ui.sel = null; return true; }
        // un clic sur un emplacement reste prioritaire
        if (this.slotAt(p.x, p.z, slotRad) < 0) {
          this.send({ k: 'hmove', x: p.x, z: p.z });
          this.fx.ring(p.x, p.z, 0.8, 0x93c5fd, 0.5);
          ui.sel = null;
          return true;
        }
      }
    }
    // héros
    const hp = this.heroPos();
    const hr = this.tapRadius(1.14);
    if (hp && (hp.x - p.x) ** 2 + (hp.z - p.z) ** 2 < hr * hr) { this.selectHero(); audio.play('click'); return true; }
    // carte interactive (un emplacement tout proche reste prioritaire)
    const pi = this.slotAt(p.x, p.z, 1.1) < 0 ? this.props.at(p.x, p.z, ui.touch ? 0.3 : 0, this.interp.latest) : -1;
    if (pi >= 0) {
      audio.play('click');
      if (this.map.props[pi].kind === PropKind.Secret) {
        // un secret réagit tout de suite, sans fenêtre : on le découvre en insistant
        this.send({ k: 'prop', i: pi });
        this.props.poke(pi);
        ui.sel = null;
      } else ui.sel = { kind: 'prop', prop: pi };
      this.syncHud();
      return true;
    }
    // emplacement / tour
    const slot = this.slotAt(p.x, p.z, slotRad);
    if (slot >= 0) {
      audio.play('click');
      const ti = this.towerAtSlot(slot);
      if (ti >= 0) this.selectTowerIndex(ti);
      else if (this.map.slots[slot].locked) { toast('Emplacement en ruines : il s’ouvre avec plus de joueurs.', 'info', 2000); ui.sel = null; }
      else ui.sel = { kind: 'build', slot };
      return true;
    }
    // ennemi
    const f = this.interp.frame;
    const best = this.enemyAt(sx, sy, p);
    if (best >= 0) {
      ui.sel = { kind: 'enemy', enemyType: f.eType[best], hp: f.eHp[best], traits: f.eTraits[best] };
      return true;
    }
    ui.sel = null;
    return false;
  }

  /**
   * Ennemi sous le curseur (indice dans l'image interpolée), ou -1 ; `attack` : seulement ceux que
   * le héros peut prendre pour cible (camouflé repéré). Un volant se vise sur son corps, en l'air
   * (le rayon du clic est coupé à sa hauteur), ou sur son ombre au sol.
   */
  private enemyAt(sx: number, sy: number, p: { x: number; z: number }, attack = false): number {
    const f = this.interp.frame;
    const er = this.tapRadius(1.26);
    let best = -1, bd = er * er;
    const air = new Map<number, { x: number; z: number } | null>();
    for (let i = 0; i < f.eN; i++) {
      if (attack && f.eTraits[i] & Trait.Camo && !(f.eTraits[i] & ET_REVEALED)) continue;
      let d = (f.eX[i] - p.x) ** 2 + (f.eZ[i] - p.z) ** 2;
      const y = f.eY[i];
      if (y > 0) {
        // centre du corps : un peu au-dessus de la hauteur de vol
        const h = y + 0.6;
        if (!air.has(h)) air.set(h, this.r.pick(sx, sy, h));
        const q = air.get(h);
        if (q) d = Math.min(d, (f.eX[i] - q.x) ** 2 + (f.eZ[i] - q.z) ** 2);
      }
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Ordre au héros d'attaquer cet ennemi (la mêlée y court, le tir se place à portée). */
  private attackEnemy(i: number) {
    const f = this.interp.frame;
    this.targeting = null;
    ui.hud.targeting = '';
    this.send({ k: 'hattack', e: f.eId[i] });
    const cls = ui.hud.hero.cls;
    if (f.eY[i] > 0 && (cls >= 0 ? CLASSES[cls].range : AVENTURIER.range) <= 0) toast('Un héros de mêlée ne peut pas frapper un volant : il se place dessous.', 'info', 2400);
    this.focusPulse = this.time;
    this.fx.ring(f.eX[i], f.eZ[i], 1, 0xef4444, 0.4);
    audio.play('click');
  }

  /**
   * Clic droit (appui long au tactile) : sur un ennemi, votre héros l'attaque ; ailleurs, il s'y rend.
   * Pendant une visée de sort, il l'annule.
   */
  private rightClick(sx: number, sy: number) {
    const p = this.r.pick(sx, sy);
    if (!p) return;
    if (this.targeting && this.targeting.kind !== 'hmove') { this.cancel(); return; }
    const hp = this.heroPos();
    const ei = hp ? this.enemyAt(sx, sy, p, true) : -1;
    if (ei >= 0) { this.attackEnemy(ei); return; }
    this.targeting = null;
    ui.hud.targeting = '';
    this.send({ k: 'hmove', x: p.x, z: p.z });
    this.fx.ring(p.x, p.z, 0.8, 0x93c5fd, 0.5);
  }

  // ------------------------------------------------------------ boucle

  private stepZoneFx(dt: number) {
    const fx = this.fx;
    for (let i = this.zoneFx.length - 1; i >= 0; i--) {
      const z = this.zoneFx[i];
      if (this.time >= z.end) { this.zoneFx.splice(i, 1); continue; }
      z.acc += dt * 60;
      for (; z.acc >= 1; z.acc--) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * z.r;
        const px = z.x + Math.cos(a) * d, pz = z.z + Math.sin(a) * d;
        switch (z.kind) {
          case Impact.Cyclone:
            // lames d'air qui tournoient en montant
            fx.glow.spawn(px, 0.2 + Math.random() * 0.5, pz, -Math.sin(a) * 6, 1.5 + Math.random() * 2, Math.cos(a) * 6, 0.45, 0.1, Math.random() < 0.3 ? 0xffffff : 0x9fd3ff, 0);
            if (Math.random() < 0.15) fx.sparks.spawn(px, 0.2, pz, -Math.sin(a) * 4, 2, Math.cos(a) * 4, 0.6, 0.12, 0x9e8a70, -6);
            break;
          case Impact.Blizzard:
            fx.sparks.spawn(px - 1.2, 5 + Math.random() * 2, pz - 0.6, 1.4, -3.5, 0.6, 1.6, 0.07 + Math.random() * 0.06, 0xffffff, 0);
            if (Math.random() < 0.3) fx.glow.spawn(px, 0.2, pz, (Math.random() - 0.5), 0.3, (Math.random() - 0.5), 1, 0.25, 0x9be7ff, 0);
            break;
          case Impact.Plague:
            if (Math.random() < 0.6) fx.glow.spawn(px, 0.15, pz, (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4, 1.4, 0.22 + Math.random() * 0.15, Math.random() < 0.5 ? 0x9ccc65 : 0x7cb342, 0.1);
            break;
          case Impact.Curse:
            if (Math.random() < 0.5) fx.glow.spawn(px, 0.1, pz, 0, 1 + Math.random() * 1.5, 0, 0.9, 0.09, Math.random() < 0.5 ? 0xce93d8 : 0x6a1b9a, 0.3);
            break;
          case Impact.Trap:
            if (Math.random() < 0.08) fx.sparks.spawn(px, 0.2, pz, 0, 1.5, 0, 0.4, 0.06, 0xffe0b2, -6);
            break;
        }
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    const r = this.r;
    // caméra clavier / bords
    const pan = 22 * dt;
    if (this.keysDown.has(keys.camLeft)) r.pan(-pan, 0);
    if (this.keysDown.has(keys.camRight)) r.pan(pan, 0);
    if (this.keysDown.has(keys.camUp)) r.pan(0, -pan);
    if (this.keysDown.has(keys.camDown)) r.pan(0, pan);
    if (settings.edgeScroll && this.mouse.inside && !this.mouse.down) {
      const m = 12;
      if (this.mouse.x < m) r.pan(-pan, 0);
      if (this.mouse.x > r.width - m) r.pan(pan, 0);
      if (this.mouse.y < m) r.pan(0, -pan);
      if (this.mouse.y > r.height - m) r.pan(0, pan);
    }
    r.update(dt, this.time);

    const paused = ui.paused && this.host.local;
    const f = this.interp.update(dt, paused || this.dialogPaused);
    const snap = this.interp.latest;
    if (!f || !snap) return;

    // héros : type par unité
    for (let i = 0; i < snap.hCount; i++) {
      this.ents.heroTypeByUnit.set(snap.hUnit[i], snap.hType[i]);
      this.ents.heroWeaponByUnit.set(snap.hUnit[i], classLook(snap.hCls[i]).weapon);
    }
    this.ents.you = this.you;

    // événements
    for (const e of this.interp.dueEvents(this.scratch)) this.handleEvent(e.tick, e.ev);
    if (this.pendingFx.length) this.pendingFx = this.pendingFx.filter((p) => this.time - p.made < 0.5);
    if (this.deferredFx.length) {
      this.replayFx = true;
      this.deferredFx = this.deferredFx.filter((d) => {
        if (this.interp.renderTick < d.at) return true;
        this.handleEvent(d.tick, d.ev);
        return false;
      });
      this.replayFx = false;
    }

    const selTower = ui.sel?.kind === 'tower' ? ui.sel.tower ?? -1 : -1;
    // culling des entités : seulement quand on est zoomé (vue d'ensemble : tout est à l'écran)
    const cam = r.camera;
    this.ents.cullOn = r.cam.dist < r.cam.fit * 0.85;
    if (this.ents.cullOn) this.ents.frustum.setFromProjectionMatrix(this.projScreen.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    this.ents.update(f, snap, dt, this.time, this.hoverSlot, selTower);
    r.setWeather(snap.rain, snap.night);
    this.weather.update(dt, this.time, r.wx.rain, r.wx.night, r.cam.x, r.cam.z);
    this.props.update(dt, this.time, snap, this.hoverProp);
    this.ambientTowers(dt);
    // un secret pas encore trouvé scintille de temps en temps : de quoi intriguer l'œil attentif
    if ((this.sparkleT -= dt) <= 0) {
      this.sparkleT = 4 + Math.random() * 5;
      const hidden = this.map.props.map((p, i) => i).filter((i) => this.map.props[i].kind === PropKind.Secret && snap.propState[i] !== PROP_FOUND);
      const i = hidden[Math.floor(Math.random() * hidden.length)];
      if (i !== undefined) {
        const p = this.map.props[i];
        for (let k = 0; k < 3; k++) this.fx.glow.spawn(p.x + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.5, p.z + (Math.random() - 0.5) * 0.6, 0, 0.5, 0, 0.9, 0.12, 0xfff8e1, 0);
      }
    }
    // château : un monstre qui franchit la porte le fait trembler ; il brûle quand les vies s'épuisent
    const castle = this.world.castle;
    for (; this.ents.castleEntered > 0; this.ents.castleEntered--) castle.hit(this.fx);
    this.maxLives = Math.max(this.maxLives, snap.lives);
    castle.update(dt, this.time, this.ents.castleNear, snap.lives / Math.max(1, this.maxLives), this.fx);
    if (this.prologue) {
      const d = ui.dialog;
      // dialogue passé : la scène se termine (Kessin s'envole avec Ethan) avant de rendre la main
      if (!d || d.i >= PROLOGUE.length) this.prologue.finish(this.time);
      this.prologue.update(dt, this.time, d ? Math.min(d.i, PROLOGUE.length - 1) : 0, d && d.i < PROLOGUE.length ? d.lines[d.i].who : '');
      if (this.prologue.done) this.endPrologue();
    }
    this.stepZoneFx(dt);
    this.fx.update(dt, this.interp.renderTick, (id, out) => {
      const i = f.enemyIdx(id);
      if (i < 0) return false;
      out.x = f.eX[i]; out.y = f.eY[i] + 0.7; out.z = f.eZ[i];
      return true;
    });

    // emplacements libres
    const wp = this.world.slotPool, lp = this.world.lockedPool;
    wp.begin();
    lp.begin();
    const used = new Uint8Array(this.map.slots.length);
    for (let i = 0; i < snap.tCount; i++) used[snap.tSlot[i]] = 1;
    this.map.slots.forEach((s, i) => {
      if (used[i]) return;
      if (s.locked) lp.push(s.x, 0, s.z, i, 1);
      else {
        const j = wp.push(s.x, 0, s.z, i * 0.7, 1, 0, 0, i === this.hoverSlot || ui.sel?.slot === i ? 0.25 : 0);
        void j;
      }
    });
    wp.end();
    lp.end();

    this.updateHover();
    this.updateSelectionVisuals(snap);
    this.positionDom(snap);

    // ennemis rencontrés pour la première fois
    for (let i = 0; i < f.eN; i++) {
      const d = ENEMIES[f.eType[i]];
      if (d?.boss && !this.bossSeen.has(f.eId[i])) {
        this.bossSeen.add(f.eId[i]);
        this.bossEntrance(d.name, d.desc, f.eX[i], f.eZ[i]);
      }
      if (d && !this.seenTypes.has(d.id)) {
        this.seenTypes.add(d.id);
        progress.seen.push(d.id);
        saveProgress();
        // un boss est présenté par sa propre entrée en scène
        if (!d.boss) toast(`Nouvel ennemi : ${d.name}. ${d.desc}`, 'enemy', 6000);
      }
      const tr = f.eTraits[i] & 7;
      if (tr) for (let k = 0; k < 3; k++) {
        const key = 'trait_' + TRAITS[k].id;
        if (tr & (1 << k) && !this.seenTypes.has(key)) {
          this.seenTypes.add(key);
          progress.seen.push(key);
          saveProgress();
          toast(`Nouvelle menace : ${TRAITS[k].name}. ${TRAIT_ADVICE[k]}`, 'enemy', 8000);
        }
      }
    }

    // HUD
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.syncHud();
    }
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      ui.debug.fps = Math.round(this.fpsN / this.fpsAcc);
      ui.debug.calls = r.gl.info.render.calls;
      ui.debug.tris = r.gl.info.render.triangles;
      ui.debug.ents = f.eN + f.uN;
      ui.debug.kb = Math.round((this.snapshotBytes / this.fpsAcc / 1024) * 10) / 10;
      this.snapshotBytes = 0;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
  }

  private updateHover() {
    // au tactile, il n'y a de survol que pendant qu'un doigt est posé
    const p = ui.touch && !this.mouse.down ? null : this.r.pick(this.mouse.x, this.mouse.y);
    this.hoverSlot = p ? this.slotAt(p.x, p.z) : -1;
    this.hoverProp = p && !this.targeting && this.hoverSlot < 0 ? this.props.at(p.x, p.z, 0, this.interp.latest) : -1;
    const t = this.targeting;
    this.aimRing.visible = false;
    if (p && t && (t.kind === 'spell' || t.kind === 'hskill' || t.kind === 'item')) {
      let r = 2;
      if (t.kind === 'item') r = ITEMS[t.i].radius;
      else if (t.kind === 'spell') r = SPELLS[ui.hud.spellIds[t.s]].radius;
      else {
        r = SKILL_RADIUS[hudSkills()[t.i]?.id ?? ''] ?? 1.2;
      }
      const q = t.kind === 'hskill' ? this.clampSkill(t.i, p) : p;
      this.aimRing.visible = true;
      this.aimRing.position.set(q.x, 0.1, q.z);
      this.aimRing.scale.setScalar(r);
    }
    if (p && t && t.kind === 'rally') {
      this.aimRing.visible = true;
      this.aimRing.position.set(p.x, 0.1, p.z);
      this.aimRing.scale.setScalar(1);
    }
    if (this.aimRing.visible) drape(this.aimRing, this.world.heightAt, 0.08);
  }

  /** Bonus du meilleur campement couvrant la tour `ti` (même règle que la simulation). */
  auraAt(snap: Snapshot, ti: number) {
    const out = { range: 0, rate: 0, dmg: 0 };
    if (snap.tFam[ti] >= 4) return out;
    const a = this.map.slots[snap.tSlot[ti]];
    for (let j = 0; j < snap.tCount; j++) {
      if (snap.tFam[j] !== 5) continue;
      const c = this.map.slots[snap.tSlot[j]];
      const cp = this.perksFor(snap.tOwner[j]);
      const au = campAura(snap.tLevel[j], [snap.tSk[j] & 15, snap.tSk[j] >> 4], cp.campAura, cp.campRange);
      if ((a.x - c.x) ** 2 + (a.z - c.z) ** 2 > au.r * au.r) continue;
      out.range = Math.max(out.range, au.range);
      out.rate = Math.max(out.rate, au.rate);
      out.dmg = Math.max(out.dmg, au.dmg);
    }
    return out;
  }

  private updateSelectionVisuals(snap: NonNullable<Interp['latest']>) {
    const s = ui.sel;
    this.rangeRing.visible = false;
    this.rallyFlag.visible = false;
    this.hoverRing.visible = false;
    if (this.hoverSlot >= 0 && !this.targeting) {
      const sl = this.map.slots[this.hoverSlot];
      this.hoverRing.visible = true;
      this.hoverRing.position.set(sl.x, 0.1, sl.z);
    }
    if (s?.kind === 'tower' && s.tower !== undefined) {
      let ti = -1;
      for (let i = 0; i < snap.tCount; i++) if (snap.tId[i] === s.tower) ti = i;
      if (ti < 0) { ui.sel = null; return; }
      // garder la sélection à jour (amélioration effectuée)
      if (snap.tLevel[ti] !== s.level || (snap.tSk[ti] & 15) !== s.sk?.[0] || snap.tSk[ti] >> 4 !== s.sk?.[1] || snap.tOwner[ti] !== s.owner || snap.tPrio[ti] !== s.prio) this.selectTowerIndex(ti);
      const fam = FAMILIES[snap.tFam[ti]];
      const lvl = TOWERS[fam][snap.tLevel[ti]];
      // bonus de portée de l'arbre de compétences du propriétaire de la tour
      // (+ bonus du meilleur campement voisin ; un campement montre sa zone d'influence)
      const aura = fam === 'camp' ? 0 : this.auraAt(snap, ti).range;
      const opk = this.perksFor(snap.tOwner[ti]);
      const rangeOf = (l: number) => TOWERS[fam][l].range * (fam === 'camp' ? 1 + opk.campRange : 1 + opk.range[snap.tFam[ti]] + aura);
      let range = rangeOf(snap.tLevel[ti]);
      if (fam === 'archer' && snap.tLevel[ti] === LEVEL_SPEC_A && snap.tSk[ti] >> 4) range += lvl.skills![1].values[(snap.tSk[ti] >> 4) - 1];
      if (fam === 'archer' && snap.night && !this.lit(snap, this.map.slots[snap.tSlot[ti]])) range *= NIGHT_RANGE;
      if (fam === 'camp' && snap.tLevel[ti] === 3) range = campAura(3, [snap.tSk[ti] & 15, snap.tSk[ti] >> 4], opk.campAura, opk.campRange).r;
      if (this.hoverLevel > snap.tLevel[ti] && TOWERS[fam][this.hoverLevel]) range = rangeOf(this.hoverLevel);
      const sl = this.map.slots[snap.tSlot[ti]];
      this.rangeRing.visible = range > 0;
      this.rangeRing.position.set(sl.x, 0.09, sl.z);
      this.rangeRing.scale.setScalar(range);
      if (fam === 'barracks') {
        this.rallyFlag.visible = true;
        this.rallyFlag.position.set(snap.tRallyX[ti], 0.7, snap.tRallyZ[ti]);
      }
    } else if (this.targeting?.kind === 'hskill' && this.skillRange(this.targeting.i) > 0) {
      // compétence à portée limitée : cercle de portée autour du héros
      const hp = this.heroPos();
      if (hp) {
        this.rangeRing.visible = true;
        this.rangeRing.position.set(hp.x, 0.09, hp.z);
        this.rangeRing.scale.setScalar(this.skillRange(this.targeting.i));
      }
    } else if (s?.kind === 'build' && s.slot !== undefined && this.hoverFam >= 0) {
      const sl = this.map.slots[s.slot];
      this.rangeRing.visible = true;
      this.rangeRing.position.set(sl.x, 0.09, sl.z);
      this.rangeRing.scale.setScalar(Math.max(0.01, TOWERS[FAMILIES[this.hoverFam]][0].range * (1 + this.perksFor(this.you).range[this.hoverFam])));
      if (FAMILIES[this.hoverFam] === 'mine') this.rangeRing.visible = false;
    }
    // cible imposée à votre héros : anneau rouge sous l'ennemi (il pulse à l'ordre)
    this.focusRing.visible = false;
    const hi = snap.heroIndex(this.you);
    const f = this.interp.frame;
    const hu = hi >= 0 ? f.unitIdx(snap.hUnit[hi]) : -1;
    if (hu >= 0 && f.uFlags[hu] & UF_FOCUS && f.uTarget[hu] !== 0xffff) {
      const ei = f.enemyIdx(f.uTarget[hu]);
      if (ei >= 0) {
        const size = ENEMIES[f.eType[ei]]?.size ?? 1;
        const pulse = Math.max(0, 1 - (this.time - this.focusPulse) / 0.3);
        this.focusRing.visible = true;
        this.focusRing.position.set(f.eX[ei], 0.12, f.eZ[ei]);
        this.focusRing.scale.setScalar((0.55 + size * 0.3) * (1 + pulse * 0.6));
      }
    }
    // marques posées sur le relief
    const hm = this.world.heightAt;
    if (this.hoverRing.visible) drape(this.hoverRing, hm, 0.1);
    if (this.focusRing.visible) drape(this.focusRing, hm, 0.12);
    if (this.rangeRing.visible) {
      drape(this.rangeRing, hm, 0.09);
      drape(this.rangeRing.children[0] as THREE.Mesh, hm, 0.07);
    }
  }

  /** famille survolée dans le menu radial (aperçu de portée) */
  hoverFam = -1;
  /** niveau survolé dans le panneau de tour ou le menu radial (aperçu de la portée future) */
  hoverLevel = -1;

  /** emplacement pour lequel la caméra a déjà été recentrée (menu radial) */
  private radialSlot = -1;

  private positionDom(snap: NonNullable<Interp['latest']>) {
    const s = ui.sel;
    if (dom.radial) {
      if (s && (s.kind === 'build' || s.kind === 'tower') && s.slot !== undefined) {
        const sl = this.map.slots[s.slot];
        this.r.project(sl.x, 1.2, sl.z, this.proj);
        // le menu reste entièrement à l'écran (bords, barre du haut, barre du bas au tactile)
        const W = this.r.width, H = this.r.height;
        const R = radialRadius(s, ui.touch, ui.touch && ui.short), face = ui.touch ? (ui.short ? 58 : 76) : 76;
        const ext = R + face / 2 + 4;
        const top = ui.touch ? (ui.short ? 52 : 60) : 64, bottom = ui.touch ? (ui.short ? 76 : 84) : 16;
        const clampAxis = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
        const x = clampAxis(this.proj.x, ext + 4, W - ext - 4);
        const y = clampAxis(this.proj.y, top + ext, H - bottom - ext - 14);
        // emplacement trop près d'un bord (fréquent sur téléphone) : plutôt que de décaler le menu loin de sa case,
        // la caméra glisse pour amener la case là où le menu tient (le menu suit la case pendant le glissement)
        if (this.radialSlot !== s.slot) {
          this.radialSlot = s.slot;
          if (Math.hypot(x - this.proj.x, y - this.proj.y) > 6) {
            const from = this.r.pick(this.proj.x, this.proj.y), to = this.r.pick(x, y);
            if (from && to) this.r.nudge(from.x - to.x, from.z - to.z);
          }
        }
        // tiroir d'informations du côté opposé au menu
        if (ui.touch) {
          const side = W > H ? (x > W / 2 ? 'left' : 'right') : (y > H * 0.5 ? 'top' : 'bottom');
          if (ui.sheet !== side) ui.sheet = side;
        }
        dom.radial.style.transform = `translate(${x | 0}px, ${y | 0}px)`;
        dom.radial.style.visibility = 'visible';
      } else {
        this.radialSlot = -1;
        dom.radial.style.visibility = 'hidden';
        const side = this.r.width > this.r.height ? 'right' : 'bottom';
        if (ui.touch && ui.sheet !== side) ui.sheet = side;
      }
    }
    const showWave = snap.state === GameState.Waiting || snap.nextWaveT > 0;
    const from = this.map.def.pathFrom;
    const nextWave = snap.wave + 1;
    this.world.entries.forEach((e, i) => {
      const el = dom.waves[i];
      if (!el) return;
      const active = !from || (from[e.path] ?? 1) <= nextWave;
      if (!showWave || !active || (this.cfg.mode === 'story' && snap.wave >= snap.totalWaves)) { el.style.visibility = 'hidden'; return; }
      this.r.project(e.x, 1.5, e.z, this.proj);
      const m = 48;
      const x = Math.max(m, Math.min(this.r.width - m, this.proj.x));
      const y = Math.max(m + 40, Math.min(this.r.height - m - 90, this.proj.y));
      el.style.transform = `translate(${x | 0}px, ${y | 0}px)`;
      el.style.visibility = 'visible';
    });
  }

  /** Centre la caméra sur le chapardeur en fuite le plus proche de l'entrée (alerte du HUD). */
  focusThief() {
    const f = this.interp.frame;
    let best = -1;
    for (let i = 0; i < f.eN; i++) {
      if (!(f.eTraits[i] & ET_FLEEING)) continue;
      if (best < 0 || this.thieves.has(f.eId[i])) best = i;
      if (this.thieves.has(f.eId[i])) break;
    }
    if (best >= 0) this.r.focus(f.eX[best], f.eZ[best]);
  }

  /** Même règle que la simulation : près d'une torche ou d'un campement, la nuit n'enlève rien aux archers. */
  private lit(snap: Snapshot, p: { x: number; z: number }) {
    const r2 = TORCH_R * TORCH_R;
    for (const t of this.map.torches) if ((t.x - p.x) ** 2 + (t.z - p.z) ** 2 <= r2) return true;
    for (let i = 0; i < snap.tCount; i++) {
      if (FAMILIES[snap.tFam[i]] !== 'camp') continue;
      const s = this.map.slots[snap.tSlot[i]];
      if (s && (s.x - p.x) ** 2 + (s.z - p.z) ** 2 <= r2 * 1.6) return true;
    }
    return false;
  }

  /** Entrée en scène d'un boss : caméra sur lui, secousse, bannière et éclair rouge. */
  private bossEntrance(title: string, sub: string, x: number, z: number) {
    banner(title, sub, 3400);
    this.r.focus(x, z);
    this.r.shake(0.6);
    audio.play('boss');
    ui.hud.bossFx++;
    this.fx.ring(x, z, 5, 0xff3d00, 1.2, 2);
  }

  private ambientT = 0;
  /**
   * Vie autour des bâtiments : fumée des feux de camp, étincelles des tours de mage, poussière d'or
   * de la mine. Quelques particules seulement, pour les bâtiments visibles.
   */
  private ambientTowers(dt: number) {
    if ((this.ambientT -= dt) > 0) return;
    this.ambientT = 0.12;
    const fx = this.fx;
    for (const m of this.ents.towerMuzzle.values()) {
      if (Math.random() > 0.35) continue;
      const yaw = this.ents.yawOfSlot(m.slot);
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const at = (lx: number, lz: number) => ({ x: m.x + lx * c + lz * sn, z: m.z - lx * sn + lz * c });
      if (m.fam === 5) {
        // fumée du feu de camp (tour de guet : feu au pied ; tente de commandement : pas de feu)
        if (m.level === 4) continue;
        const p = m.level === 3 ? at(-0.65, 0.65) : at(0.35, 0.45);
        fx.sparks.spawn(p.x + (Math.random() - 0.5) * 0.1, 0.6, p.z + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.12, 0.55 + Math.random() * 0.25, (Math.random() - 0.5) * 0.12, 1.6, 0.07 + Math.random() * 0.05, 0x8f8a84, 0.12);
        if (Math.random() < 0.3) fx.sparks.spawn(p.x, 0.5, p.z, (Math.random() - 0.5) * 0.4, 1 + Math.random(), (Math.random() - 0.5) * 0.4, 0.6, 0.03, 0xffb74d, -0.5);
      } else if (m.fam === 2) {
        // étincelles arcaniques qui montent autour du sommet
        const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.4;
        fx.glow.spawn(m.x + Math.cos(a) * r, m.y - 0.6 + Math.random() * 0.6, m.z + Math.sin(a) * r, -Math.sin(a) * 0.4, 0.5 + Math.random() * 0.4, Math.cos(a) * 0.4, 1.1, 0.07, Math.random() < 0.5 ? 0xb388ff : 0x80d8ff, 0);
      } else if (m.fam === 4 && Math.random() < 0.4) {
        // paillettes de minerai devant la galerie
        const p = m.level === 4 ? at(0.65, -0.45) : at(-0.15, 0.85);
        fx.sparks.spawn(p.x + (Math.random() - 0.5) * 0.3, 0.6, p.z + (Math.random() - 0.5) * 0.3, 0, 0.6, 0, 0.5, 0.035, 0xffe082, 0);
      } else if (m.fam === 1 && Math.random() < 0.15) {
        // poussière de la cour d'entraînement
        const p = at((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.3);
        fx.sparks.spawn(p.x, 0.2, p.z, (Math.random() - 0.5) * 0.4, 0.25, (Math.random() - 0.5) * 0.4, 0.8, 0.06, 0xb8a58a, 0);
      }
    }
  }

  /** Bouton du panneau d'un élément de carte : allumer la mèche, engager les mercenaires. */
  useProp(i: number) {
    const p = this.map.props[i];
    if (!p) return;
    const s = this.interp.latest;
    const st = s && i < s.propN ? s.propState[i] : 0, cd = s && i < s.propN ? s.propCd[i] : 0;
    if (!PropsView.ready(p, st, cd)) { audio.play('deny'); return; }
    if (PROP_INFO[p.kind].cost > ui.hud.gold) { toast('Pas assez d’or pour engager les mercenaires.', 'info', 1800); audio.play('deny'); return; }
    this.send({ k: 'prop', i });
    this.props.poke(i);
    if (p.kind !== PropKind.Camp) ui.sel = null;
  }

  private syncHud() {
    const s = this.interp.latest;
    if (!s) return;
    const h = ui.hud;
    if (ui.sel?.kind === 'prop' && ui.sel.prop !== undefined) {
      const i = ui.sel.prop;
      const st = i < s.propN ? s.propState[i] : 0, cd = i < s.propN ? Math.ceil(s.propCd[i] / TICK_RATE) : 0;
      if (h.prop.st !== st) h.prop.st = st;
      if (h.prop.cd !== cd) h.prop.cd = cd;
    }
    const pi = s.playerIndex(this.you);
    h.gold = pi >= 0 ? s.pGold[pi] : 0;
    h.lives = s.lives;
    h.maxLives = s.maxLives;
    h.wave = s.wave;
    h.totalWaves = s.totalWaves;
    h.nextWave = s.nextWaveT < 0 ? -1 : Math.ceil(s.nextWaveT / TICK_RATE);
    h.state = s.state;
    h.speed = s.speed;
    if (h.mutations.join() !== s.mutations.join()) h.mutations = [...s.mutations];
    if (this.thieves.size) {
      // un chapardeur disparu sans événement (rattrapage de l'état) ne reste pas affiché
      for (const id of this.thieves.keys()) {
        let alive = false;
        for (let i = 0; i < s.eCount; i++) if (s.eId[i] === id) { alive = true; break; }
        if (!alive) this.thieves.delete(id);
      }
    }
    if (h.weather.rain !== s.rain) h.weather.rain = s.rain;
    if (h.weather.night !== s.night) h.weather.night = s.night;
    const ad = h.adapt;
    if (ad.on !== s.adaptOn) ad.on = s.adaptOn;
    if (s.adaptOn) {
      const ph = Math.round(s.adaptPhys * 100), mg = Math.round(s.adaptMagic * 100);
      if (ad.phys !== ph) ad.phys = ph;
      if (ad.magic !== mg) ad.magic = mg;
      if (Math.abs(ad.share - s.adaptShare) > 0.01) ad.share = s.adaptShare;
    }
    let bi = -1;
    for (let i = 0; i < s.eCount; i++) if (ENEMIES[s.eType[i]]?.boss) { bi = i; break; }
    const hb = h.boss;
    if (bi < 0) { if (hb.on) hb.on = false; }
    else {
      const t = s.eType[bi];
      if (!hb.on || hb.type !== t) { const ph = bossPhase(t); hb.type = t; hb.phase = ph.phase; hb.phases = ph.phases; }
      hb.hp = s.eHp[bi];
      hb.on = true;
    }
    let tg = 0;
    for (const g of this.thieves.values()) tg += g;
    if (h.thief.n !== this.thieves.size || h.thief.gold !== tg) { h.thief.n = this.thieves.size; h.thief.gold = tg; }
    if (pi >= 0) {
      h.spells[0] = Math.ceil(s.pCd0[pi] / TICK_RATE);
      h.spells[1] = Math.ceil(s.pCd1[pi] / TICK_RATE);
    }
    for (const p of h.players) {
      const i = s.playerIndex(p.id);
      if (i < 0) continue;
      p.gold = s.pGold[i];
      p.connected = (s.pFlags[i] & PF_CONNECTED) !== 0;
      p.active = (s.pFlags[i] & PF_ACTIVE) !== 0;
      p.speed2 = (s.pFlags[i] & PF_SPEED2) !== 0;
    }
    const hi = s.heroIndex(this.you);
    if (hi >= 0) {
      const he = h.hero;
      he.type = s.hType[hi];
      he.cls = s.hCls[hi];
      he.kit = s.hKit[hi];
      he.level = s.hLevel[hi];
      he.xp = s.hXp[hi];
      he.cds[0] = Math.ceil(s.hCd[hi * 3] / TICK_RATE);
      he.cds[1] = Math.ceil(s.hCd[hi * 3 + 1] / TICK_RATE);
      he.cds[2] = Math.ceil(s.hCd[hi * 3 + 2] / TICK_RATE);
      he.respawn = Math.ceil(s.hRespawn[hi] / TICK_RATE);
      const ui_ = this.interp.frame.unitIdx(s.hUnit[hi]);
      he.dead = ui_ < 0 || (this.interp.frame.uFlags[ui_] & UF_DEAD) !== 0;
      he.hp = ui_ >= 0 ? this.interp.frame.uHp[ui_] : 0;
    }
    if (ui.sel?.kind === 'enemy') {
      // rien : instantané
    }
    // intensité musicale
    const f = this.interp.frame;
    let boss = false;
    for (let i = 0; i < f.eN; i++) if (ENEMIES[f.eType[i]]?.boss) boss = true;
    audio.intensity = boss ? 1 : Math.min(0.85, f.eN / 40 + (s.state === GameState.Running ? 0.2 : 0));
  }

  // ------------------------------------------------------------ événements visuels

  private startPos(srcType: number, srcId: number, out: { x: number; y: number; z: number }): boolean {
    if (srcType === Src.Tower) {
      const t = this.ents.towerMuzzle.get(srcId);
      if (!t) return false;
      out.x = t.x; out.y = t.y; out.z = t.z;
      return true;
    }
    const f = this.interp.frame;
    if (srcType === Src.Hero) {
      const s = this.interp.latest!;
      const hi = s.heroIndex(srcId);
      const i = hi >= 0 ? f.unitIdx(s.hUnit[hi]) : -1;
      if (i < 0) return false;
      out.x = f.uX[i]; out.y = 1.2; out.z = f.uZ[i];
      return true;
    }
    if (srcType === Src.Unit) {
      const i = f.unitIdx(srcId);
      if (i < 0) return false;
      out.x = f.uX[i]; out.y = 0.9; out.z = f.uZ[i];
      return true;
    }
    return false;
  }

  private leadNumT = 0;
  /** Texte flottant au-dessus d'un point de la carte (même calque que les nombres de dégâts). */
  private floatText(x: number, y: number, z: number, text: string, kind: string) {
    const layer = dom.dmg;
    if (!layer) return;
    const el = layer.children[this.dmgIdx++ % layer.children.length] as HTMLElement;
    if (!el) return;
    this.r.project(x, y, z, this.proj);
    el.textContent = text;
    el.className = 'dn ' + kind;
    el.style.left = `${this.proj.x | 0}px`;
    el.style.top = `${this.proj.y | 0}px`;
    void el.offsetWidth;
    el.classList.add('go');
  }

  private damageNumber(x: number, y: number, z: number, amount: number, kind: '' | 'crit' | 'lead' | 'gold') {
    const layer = dom.dmg;
    if (!layer || !settings.damageNumbers) return;
    const el = layer.children[this.dmgIdx++ % layer.children.length] as HTMLElement;
    if (!el) return;
    this.r.project(x, y, z, this.proj);
    el.textContent = kind === 'gold' ? (amount < 0 ? `−${-amount}` : `+${amount}`) : kind === 'lead' && amount < 1 ? '0' : String(amount);
    el.className = kind ? 'dn ' + kind : 'dn';
    el.style.left = `${this.proj.x | 0}px`;
    el.style.top = `${this.proj.y | 0}px`;
    void el.offsetWidth;
    el.classList.add('go');
  }

  private handleEvent(tick: number, ev: number[]) {
    const fx = this.fx;
    const f = this.interp.frame;
    const p = this.tpos;
    switch (ev[0]) {
      case Ev.Fire: {
        const [, kind, srcType, srcId, target, tx, tz, flight] = ev;
        if (srcType === Src.Sky) { p.x = tx - 6; p.y = 24; p.z = tz - 7; }
        else if (!this.startPos(srcType, srcId, p)) return;
        // gestes des tireurs : recul de la tour (ou bascule du bras de la catapulte), bras levés de l'unité
        let delay = 0;
        if (srcType === Src.Tower) delay = this.ents.towerShot(srcId, tx, tz, this.time, p);
        else if (srcType === Src.Unit) {
          this.ents.uFireTime[srcId] = this.time;
          this.ents.aim(srcId, target, tx, tz, this.time);
          // le carreau sort de la bouche du canon qui tire (les deux canons tirent à tour de rôle)
          if (kind === FIRE_TURRET) this.ents.turretShot(srcId, p.x, p.z, tx, tz, p);
        }
        else if (srcType === Src.Hero) {
          const s = this.interp.latest!;
          const hi = s.heroIndex(srcId);
          if (hi >= 0) { this.ents.uFireTime[s.hUnit[hi]] = this.time; this.ents.aim(s.hUnit[hi], target, tx, tz, this.time); }
          // le projectile part de l'arc (ou de l'orbe du bâton), devant le héros, pas du centre de son corps
          if (kind === FIRE_HERO_BOLT) {
            const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1;
            p.x += (dx / l) * 0.75; p.z += (dz / l) * 0.75;
            p.y = 1.35;
          } else bowPos(p.x, p.z, tx, tz, p);
        }
        const dist = Math.sqrt((tx - p.x) ** 2 + (tz - p.z) ** 2);
        if (kind === 3) {
          // rayon arcanique
          const ti = f.enemyIdx(target);
          const ty = ti >= 0 ? f.eY[ti] + 0.7 : 0.7;
          fx.beams.add(p.x, p.y, p.z, tx, ty, tz, 0.3, 0.12, 0xea80fc);
          fx.beams.add(p.x, p.y, p.z, tx, ty, tz, 0.2, 0.05, 0xffffff);
          fx.burst(tx, ty, tz, 8, 0xea80fc, 3, 0.1, 0.4, true, 0);
          audio.play('arcane');
          return;
        }
        // catapulte : un rocher lancé en cloche, qui part du godet une fois le bras basculé
        const boulder = delay > 0 && kind === 4;
        let arc = 0.3;
        if (kind === 0 || kind === FIRE_HERO_ARROW || kind === FIRE_TURRET) arc = 0.12 * dist;
        else if (boulder) arc = 0.45 * dist + 1.5;
        else if (kind === 4 || kind === 5 || kind === 12) arc = 0.35 * dist + 1;
        else if (kind === FIRE_METEOR) arc = 0;
        const ti = target !== 0xffff ? f.enemyIdx(target) : -1;
        const wait = Math.min(flight - 1, delay * TICK_RATE * Math.max(1, ui.hud.speed));
        fx.addShot({ kind: boulder ? SHOT_BOULDER : kind, sx: p.x, sy: p.y, sz: p.z, tx, ty: ti >= 0 ? f.eY[ti] + 0.7 : 0.2, tz, targetId: target, t0: tick + Math.max(0, wait), dur: Math.max(1, flight - Math.max(0, wait)), arc, x: p.x, y: p.y, z: p.z });
        if (kind === FIRE_METEOR) fx.ring(tx, tz, 2.4, 0xff3d00, Math.max(0.3, flight / TICK_RATE / Math.max(1, ui.hud.speed)), 0.3);
        if (kind === 0 || kind === FIRE_HERO_ARROW) audio.play('arrow', 0.8);
        else if (kind === 1 || kind === FIRE_HERO_BOLT) audio.play('bolt', 0.7);
        else if (kind === 2) audio.play('frost', 0.8);
        else if (boulder) audio.play('catapult');
        else if (kind === 4 || kind === 5) { audio.play('shell'); fx.burst(p.x, p.y, p.z, 5, 0x9e9e9e, 2, 0.18, 0.6); }
        else if (kind === FIRE_TURRET) audio.play('arrow', 0.6);
        else if (kind === FIRE_METEOR) audio.play('meteor');
        break;
      }
      case Ev.Chain: {
        const t = this.ents.towerMuzzle.get(ev[1]);
        if (!t) return;
        const n = ev[2];
        // l'éclair part de la bouche du canon qui tire (double canon : à tour de rôle) et le canon recule
        const o = { x: t.x, y: t.y, z: t.z };
        if (n > 0) this.ents.towerShot(ev[1], ev[3], ev[4], this.time, o);
        let ax = o.x, ay = o.y, az = o.z;
        for (let k = 0; k < n; k++) {
          const bx = ev[3 + k * 2], bz = ev[4 + k * 2];
          fx.beams.add(ax, ay, az, bx, 0.8, bz, 0.22, 0.07, 0x80d8ff, 0.6);
          fx.burst(bx, 0.8, bz, 5, 0xb3e5fc, 3, 0.07, 0.3, true, 0);
          ax = bx; ay = 0.8; az = bz;
        }
        audio.play('tesla');
        break;
      }
      case Ev.Impact: {
        if (!this.replayFx) {
          // impact d'une compétence lancée : il se joue à l'arrivée de la bombe, de la fiole, du sort…
          const pd = this.pendingFx.find((q) => q.tick === tick && (q.x - ev[2]) ** 2 + (q.z - ev[3]) ** 2 < 1.2);
          if (pd) { this.deferredFx.push({ at: tick + pd.delay * TICK_RATE, tick, ev: ev.slice() }); break; }
        }
        const [, kind, x, z, r10] = ev;
        // zones durables des compétences de route : rayon ×10 + durée (s) ×1000
        const long = kind >= Impact.Cyclone && kind <= Impact.Blades;
        const rad = (long ? r10 % 1000 : r10) / 10;
        const dur = long ? Math.floor(r10 / 1000) : 0;
        if (dur > 0 && kind !== Impact.Net) this.zoneFx.push({ kind, x, z, r: rad, end: this.time + dur, acc: 0 });
        switch (kind) {
          case Impact.Bolt:
            // éclair : trait en zigzag tombé du ciel, étincelles bleues
            fx.beams.add(x, 9, z, x, 0.3, z, 0.3, 0.32, 0x81d4fa, 1.4);
            fx.beams.add(x, 9, z, x, 0.3, z, 0.22, 0.12, 0xffffff, 1);
            fx.ring(x, z, 1.2, 0xb3e5fc, 0.3);
            fx.burst(x, 0.6, z, 12, 0x81d4fa, 4, 0.08, 0.35, true, 0);
            fx.flashes.flash(x, 1.5, z, 0x9be7ff, 6, 0.25, 8);
            audio.play('arcane', 0.6);
            break;
          case Impact.Cyclone:
            fx.runes.add(x, z, rad, Decal.Rune, dur, 0xb3d4ff, 5);
            fx.decals.add(x, z, rad, Decal.Cracks, dur + 1, 0x9e8a70);
            fx.ring(x, z, rad, 0xcfe8ff, 0.5);
            fx.shockwave(x, z, rad, 0xcfe8ff, 0x9e8a70, 0.5);
            audio.play('spell', 0.8);
            break;
          case Impact.Blizzard:
            fx.decals.add(x, z, rad, Decal.Pool, dur + 1.5, 0xe3f7ff);
            fx.runes.add(x, z, rad, Decal.Rune, dur, 0x9be7ff, 0.4);
            fx.shards.burst(x, z, rad * 0.8, 10, 0xbfefff, 1.2, 1);
            fx.flashes.flash(x, 1.5, z, 0x9be7ff, 6, 0.4, rad * 4);
            audio.play('frost', 1.1);
            break;
          case Impact.Plague:
            fx.decals.add(x, z, rad, Decal.Pool, dur + 1, 0x6f8a2a);
            fx.runes.add(x, z, rad, Decal.Rune, dur, 0x9ccc65, -0.5);
            fx.smoke(x, 0.3, z, 8, 0x556b2f, rad);
            audio.play('arcane', 0.6);
            break;
          case Impact.Trap:
            fx.decals.add(x, z, rad, Decal.Cracks, dur, 0x8d6e63);
            fx.runes.add(x, z, rad, Decal.Rune, dur, 0xffb74d, 0);
            fx.shards.burst(x, z, rad * 0.8, 8, 0x9e9e9e, 0.6, 0.5);
            audio.play('build');
            break;
          case Impact.Net:
            // filet : un quadrillage de cordes posé au sol pendant l'immobilisation
            fx.runes.add(x, z, rad, Decal.Rune, dur, 0xe0c58a, 0);
            for (let k = -2; k <= 2; k++) {
              const o = (k / 2.5) * rad, h = Math.sqrt(Math.max(0, rad * rad - o * o));
              fx.beams.add(x + o, 0.25, z - h, x + o, 0.25, z + h, dur, 0.05, 0xd7b98a);
              fx.beams.add(x - h, 0.25, z + o, x + h, 0.25, z + o, dur, 0.05, 0xd7b98a);
            }
            fx.burst(x, 1.5, z, 18, 0xd7b98a, 3, 0.1, 0.6);
            audio.play('arrow', 0.8);
            break;
          case Impact.Curse:
            fx.decals.add(x, z, rad, Decal.Pool, dur + 0.5, 0x4a148c);
            fx.runes.add(x, z, rad, Decal.Rune, dur, 0x7b1fa2, -1.2);
            fx.ring(x, z, rad, 0xce93d8, 0.6);
            fx.spiral(x, z, rad, 24, 0xce93d8);
            fx.flashes.flash(x, 1.5, z, 0x9c27b0, 8, 0.4, rad * 4);
            audio.play('arcane', 1);
            break;
          case Impact.Quake:
            fx.decals.add(x, z, rad * 1.1, Decal.Cracks, 4, 0xff9a3c);
            fx.shockwave(x, z, rad, 0xffcc80, 0x8d6e63, 0.6);
            fx.debris(x, z, 12, 0x6d5a48, 6);
            fx.smoke(x, 0.3, z, 6, 0x8d7b68, rad);
            this.r.shake(0.35);
            audio.play('shell', 1.2);
            break;
          case Impact.Wave:
            fx.burst(x, 0.6, z, 16, 0xcfe8ff, 4, 0.1, 0.4, true, 0);
            fx.ring(x, z, 1.5, 0xcfe8ff, 0.4);
            break;
          case Impact.Sanctuary:
            fx.pillar(x, z, 2, 10, 0xb9f6ca, 1.3);
            fx.runes.add(x, z, rad, Decal.Rune, 1.6, 0xfff59d, 1);
            fx.spiral(x, z, rad, 34, 0x69f0ae, 1.4);
            fx.shockwave(x, z, rad, 0xfff3c0, 0xfff3c0, 0.6);
            fx.flashes.flash(x, 3, z, 0xd8ffd8, 14, 0.6, rad * 5);
            audio.play('heal');
            break;
          case Impact.Blades:
            // lames croisées
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * Math.PI, c = Math.cos(a) * Math.max(0.9, rad * 0.4), sn = Math.sin(a) * Math.max(0.9, rad * 0.4);
              fx.beams.add(x - c, 0.9, z - sn, x + c, 1.1, z + sn, 0.22, 0.06, 0xe3f2fd);
            }
            fx.burst(x, 0.9, z, 8, 0xe3f2fd, 3, 0.07, 0.3, true, 0);
            audio.play('hit', 1.6);
            break;
          case Impact.Shell: case Impact.Frag:
            fx.burst(x, 0.3, z, kind === Impact.Frag ? 6 : 14, 0x6d4c41, 4, 0.2, 0.7);
            fx.burst(x, 0.4, z, 8, 0xffb74d, 3, 0.18, 0.3, true, 0);
            fx.ring(x, z, rad, 0xffcc80, 0.35);
            if (kind === Impact.Shell) { fx.decals.add(x, z, rad * 0.55, Decal.Scorch, 2.5, 0xff8f00); fx.smoke(x, 0.4, z, 3, 0x6b6b6b, rad * 0.5); }
            audio.play('explosion', kind === Impact.Frag ? 0.4 : 0.7);
            break;
          case Impact.Rock:
            // rocher de catapulte : éclats de pierre, nuage de poussière, sol fissuré (pas de flammes)
            fx.burst(x, 0.3, z, 12, 0x8a8178, 4.5, 0.2, 0.8);
            fx.burst(x, 0.3, z, 10, 0x6d4c41, 3, 0.16, 0.6);
            fx.ring(x, z, rad, 0xd7c4a1, 0.35);
            fx.decals.add(x, z, rad * 0.5, Decal.Cracks, 3, 0x5d4c3a);
            fx.smoke(x, 0.3, z, 4, 0xa1887f, rad * 0.55);
            audio.play('explosion', 0.45);
            break;
          case Impact.FireShell:
            fx.burst(x, 0.3, z, 18, 0xff6f00, 5, 0.22, 0.6, true, -3);
            fx.burst(x, 0.3, z, 10, 0x3e2723, 3, 0.25, 0.9);
            fx.ring(x, z, rad, 0xff8f00, 0.45);
            fx.decals.add(x, z, rad * 0.75, Decal.Scorch, 3.5, 0xff6f00);
            fx.flashes.flash(x, 1.2, z, 0xff8f00, 6, 0.3, rad * 4);
            fx.smoke(x, 0.5, z, 5, 0x4a4a4a, rad * 0.6);
            audio.play('explosion', 0.8);
            break;
          case Impact.Meteor:
            // impact : éclair, cratère fumant, onde de choc, rochers projetés, colonne de fumée
            fx.burst(x, 0.3, z, 34, 0xff6f00, 7, 0.32, 0.8, true, -4);
            fx.burst(x, 0.4, z, 14, 0xffe082, 9, 0.18, 0.4, true, -2);
            fx.debris(x, z, 12, 0x4e342e, 7);
            fx.shockwave(x, z, rad * 1.4, 0xffab40, 0x7a5a3a, 0.55);
            fx.decals.add(x, z, rad * 0.95, Decal.Scorch, 6, 0xff5a00);
            fx.flashes.flash(x, 2, z, 0xff9a3c, 14, 0.45, rad * 6);
            fx.smoke(x, 0.6, z, 9, 0x3d3d3d, rad * 0.8);
            this.r.shake(0.35);
            audio.play('explosion', 1.2);
            break;
          case Impact.Frost:
            // gel : cristaux de glace qui jaillissent, sol givré, brume froide
            fx.burst(x, 0.5, z, 30, 0xb3e5fc, 4, 0.15, 0.8, true, -1);
            fx.ring(x, z, rad, 0x80deea, 0.7);
            fx.shards.burst(x, z, rad * 0.9, Math.round(8 + rad * 3), 0xbfefff, 1.6, 1.1);
            fx.decals.add(x, z, rad, Decal.Pool, 3, 0xcff4ff);
            fx.pillars.add(x, 0, z, rad * 0.3, rad, 1.4, 0.4, 0.5, 0x80deea, 0);
            fx.flashes.flash(x, 1.5, z, 0x9be7ff, 6, 0.35, rad * 4);
            audio.play('frost', 1.2);
            break;
          case Impact.Arcane:
            // colonne arcanique tournoyante et cercle runique
            fx.burst(x, 0.7, z, 24, 0xea80fc, 5, 0.14, 0.6, true, 2);
            fx.beams.add(x, 0, z, x, 8, z, 0.4, 0.4, 0xea80fc);
            fx.pillar(x, z, Math.max(1, rad * 0.6), 7, 0xd27bff, 0.9);
            fx.runes.add(x, z, rad, Decal.Rune, 1.1, 0xc77dff, 2.4);
            fx.spiral(x, z, rad, 24, 0xea80fc);
            fx.flashes.flash(x, 2, z, 0xd27bff, 8, 0.45, rad * 4);
            audio.play('arcane', 1.2);
            break;
          case Impact.Kamikaze:
            fx.burst(x, 0.4, z, 22, 0x8d9a3a, 5, 0.2, 0.7);
            fx.burst(x, 0.4, z, 12, 0xffb74d, 4, 0.2, 0.3, true, 0);
            fx.ring(x, z, rad, 0xc5e1a5, 0.4);
            fx.decals.add(x, z, rad * 0.7, Decal.Pool, 3, 0x6f8a2a);
            audio.play('explosion', 0.7);
            break;
          case Impact.Hammer:
            // marteau de Brom : le sol se fend, des pics de roche jaillissent
            fx.burst(x, 0.2, z, 24, 0x8d6e63, 5, 0.18, 0.7);
            fx.shockwave(x, z, rad, 0xffcc80, 0x8d6e63, 0.5);
            fx.decals.add(x, z, rad * 1.1, Decal.Cracks, 3.5, 0xff9a3c);
            fx.shards.burst(x, z, rad * 0.85, 10, 0x8a7560, 1.1, 0.9);
            fx.debris(x, z, 8, 0x6d5a48, 5);
            this.r.shake(0.3);
            audio.play('shell', 1.2);
            break;
          case Impact.Holy:
            // lumière sacrée : colonne dorée, rayons, onde et cercle runique
            fx.burst(x, 0.5, z, 40, 0xfff59d, 6, 0.18, 0.9, true, 1);
            fx.pillar(x, z, Math.max(1.2, rad * 0.5), 10, 0xffe58a, 1.2);
            fx.runes.add(x, z, rad, Decal.Rune, 1.5, 0xffe082, 1.2);
            fx.shockwave(x, z, rad, 0xfff3c0, 0xfff3c0, 0.6);
            fx.spiral(x, z, rad, 30, 0xfff59d, 1.4);
            fx.flashes.flash(x, 3, z, 0xfff1b0, 14, 0.6, rad * 5);
            this.r.shake(0.3);
            audio.play('levelup');
            break;
          case Impact.Drain:
            // drain de Nox : filaments verts aspirés vers le centre
            fx.burst(x, 0.8, z, 30, 0x76ff03, 3, 0.12, 0.8, true, 0);
            fx.ring(x, z, rad, 0x76ff03, 0.6, rad);
            fx.runes.add(x, z, rad, Decal.Rune, 1.2, 0x6bff3a, -1.8);
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2 + Math.random() * 0.4;
              fx.beams.add(x + Math.cos(a) * rad, 0.4, z + Math.sin(a) * rad, x, 1.2, z, 0.5, 0.06, 0x9cff57, 0.6);
            }
            for (let k = 0; k < 26; k++) {
              const a = Math.random() * Math.PI * 2;
              fx.glow.spawn(x + Math.cos(a) * rad, 0.3 + Math.random(), z + Math.sin(a) * rad, -Math.cos(a) * rad * 1.6, 1.2, -Math.sin(a) * rad * 1.6, 0.6, 0.1, 0x9cff57, 0);
            }
            fx.flashes.flash(x, 1.5, z, 0x76ff03, 6, 0.4, rad * 4);
            audio.play('arcane', 0.8);
            break;
          case Impact.Lava:
            // flaque de lave qui bouillonne pendant toute sa durée
            fx.ring(x, z, rad, 0xff6f00, 5, rad * 0.98);
            fx.decals.add(x, z, rad, Decal.Pool, 5, 0xff5a10);
            fx.decals.add(x, z, rad * 1.15, Decal.Scorch, 6.5, 0xff3d00);
            for (let k = 0; k < 40; k++) {
              const a = Math.random() * Math.PI * 2, d = Math.random() * rad;
              fx.glow.spawn(x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d, 0, 1, 0, 1 + Math.random() * 4, 0.25, 0xff6f00, 0.2);
            }
            fx.smoke(x, 0.3, z, 8, 0x4a3a30, rad);
            fx.flashes.flash(x, 1, z, 0xff6a00, 8, 1.2, rad * 4);
            audio.play('explosion', 0.8);
            break;
          case Impact.ArrowRain:
            fx.ring(x, z, rad, 0xc5e1a5, 3, rad * 0.98);
            fx.runes.add(x, z, rad, Decal.Rune, 3, 0xb9f6a0, 0.6);
            for (let k = 0; k < 36; k++) {
              const a = Math.random() * Math.PI * 2, d = Math.random() * rad;
              fx.addShot({ kind: 0, sx: x + Math.cos(a) * d - 2, sy: 9, sz: z + Math.sin(a) * d - 2, tx: x + Math.cos(a) * d, ty: 0, tz: z + Math.sin(a) * d, targetId: 0xffff, t0: tick + k * 1.6, dur: 8, arc: 0, x, y: 9, z });
            }
            break;
          case Impact.Dawn:
            // aube de Samuel : explosion de lumière dorée
            fx.ring(x, z, rad, 0xffe082, 0.9);
            fx.burst(x, 1, z, 50, 0xffe082, 8, 0.12, 0.8, true, 0);
            fx.pillar(x, z, 2, 12, 0xffd54f, 1.4);
            fx.shockwave(x, z, rad, 0xffe7a0, 0xfff3c0, 0.7);
            fx.runes.add(x, z, rad, Decal.Rune, 1.6, 0xffd54f, 1);
            fx.flashes.flash(x, 3, z, 0xffe7a0, 16, 0.7, rad * 5);
            this.r.shake(0.25);
            audio.play('spell');
            break;
          case Impact.Charge:
            fx.burst(x, 0.3, z, 18, 0x90caf9, 5, 0.15, 0.5, true, 0);
            fx.shockwave(x, z, rad, 0x90caf9, 0x9e8a70, 0.4);
            audio.play('hit', 1.5);
            break;
          case Impact.Summon:
            fx.burst(x, 0.3, z, 30, 0x76ff03, 3, 0.15, 0.9, true, 2);
            fx.ring(x, z, rad, 0x76ff03, 0.6);
            fx.runes.add(x, z, rad, Decal.Rune, 1.4, 0x76ff03, -1.4);
            fx.pillar(x, z, 0.9, 4, 0x6bff3a, 0.9);
            fx.smoke(x, 0.2, z, 6, 0x2e3b22, rad * 0.6);
            audio.play('arcane', 0.7);
            break;
          case Impact.Turret:
            fx.burst(x, 0.3, z, 16, 0xffb74d, 4, 0.15, 0.5, true, -2);
            fx.shockwave(x, z, 1.4, 0xffcc80, 0x8d6e63, 0.4);
            audio.play('build');
            break;
          case Impact.Rally:
            fx.ring(x, z, 1, 0xfff59d, 0.5);
            break;
        }
        break;
      }
      case Ev.Steal: {
        const [, id, victim, gold] = ev;
        const i = f.enemyIdx(id);
        if (i >= 0) {
          fx.burst(f.eX[i], 1, f.eZ[i], 18, 0xffd54f, 3, 0.1, 0.7, true, 1);
          for (let k = 0; k < 8; k++) fx.sparks.spawn(f.eX[i], 1.2, f.eZ[i], (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.7, 0.09, 0xffd54f);
        }
        if (victim === this.you) {
          if (gold > 0) this.thieves.set(id, gold);
          banner('Au voleur !', gold > 0 ? `Un chapardeur vous a volé ${gold} or : rattrapez-le avant qu’il s’enfuie !` : 'Un chapardeur fouille vos coffres… vides. Il repart bredouille.', 3200);
          audio.play('leak', 0.8);
          if (i >= 0 && gold > 0) this.damageNumber(f.eX[i], 1.8, f.eZ[i], -gold, 'gold');
        } else {
          const who = ui.hud.players.find((p) => p.id === victim);
          if (gold > 0) toast(`Un chapardeur a volé ${gold} or à ${who?.name ?? '?'} ! Rattrapez-le !`, 'danger', 3000);
        }
        this.syncHud();
        break;
      }
      case Ev.Recover: {
        const [, victim, gold, x, z] = ev;
        fx.burst(x, 1, z, 26, 0xffd54f, 4, 0.12, 0.9, true, -3);
        for (let k = 0; k < 14; k++) fx.sparks.spawn(x, 1, z, (Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.9, 0.1, 0xffd54f);
        if (victim === this.you) {
          toast(`Chapardeur rattrapé ! Il vous rend ${gold} or, bonus compris.`, 'good', 3200);
          this.damageNumber(x, 1.8, z, gold, 'gold');
          audio.play('sell');
        } else {
          const who = ui.hud.players.find((p) => p.id === victim);
          toast(`Chapardeur rattrapé : ${who?.name ?? '?'} récupère ${gold} or.`, 'good', 2400);
        }
        break;
      }
      case Ev.Escape: {
        const [, id, victim, gold] = ev;
        const i = f.enemyIdx(id);
        if (i >= 0) fx.burst(f.eX[i], 0.5, f.eZ[i], 12, 0x8d6e63, 2.5, 0.14, 0.6);
        this.thieves.delete(id);
        if (victim === this.you && gold > 0) { toast(`Le chapardeur s’est enfui avec ${gold} or… La prochaine fois, il faudra courir plus vite !`, 'danger', 3600); audio.play('deny'); }
        this.syncHud();
        break;
      }
      case Ev.Prop: {
        const [, i, pid, st, val] = ev;
        const p = this.map.props[i];
        if (!p) break;
        const mine = pid === this.you;
        this.props.poke(i);
        if (p.kind === PropKind.Poudre) {
          fx.burst(p.x, 0.6, p.z, 40, 0xffa726, 6, 0.16, 0.8, true, -3);
          fx.burst(p.x, 0.5, p.z, 24, 0x424242, 3, 0.2, 1.4, false, 1);
          this.r.shake(0.5);
          audio.play('explosion');
          this.floatText(p.x, 1.8, p.z, 'BOUM !', 'name');
        } else if (p.kind === PropKind.Camp) {
          fx.ring(p.x, p.z, 2, 0xffd54f, 0.6);
          audio.play('build');
          this.floatText(p.x, 2.4, p.z, 'Mercenaires engagés !', 'name');
          if (mine) this.damageNumber(p.x, 2, p.z, -PROP_INFO[PropKind.Camp].cost, 'gold');
        } else {
          const def = SECRETS[this.map.def.biome]?.[p.v];
          if (!def) break;
          if (st === PROP_FOUND) {
            fx.burst(p.x, 0.7, p.z, 40, 0xffd54f, 4, 0.12, 1, true, -4);
            for (let k = 0; k < 16; k++) fx.sparks.spawn(p.x, 0.8, p.z, (Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4, 1, 0.1, 0xffd54f);
            if (def.vanish) fx.burst(p.x, 0.5, p.z, 20, 0xffffff, 2, 0.2, 0.8, false, 0.5);
            audio.play('levelup');
            if (mine) {
              this.damageNumber(p.x, 1.6, p.z, val, 'gold');
              if (!progress.secrets.includes(def.id)) {
                progress.secrets.push(def.id);
                saveProgress();
              }
              toast(`${def.done} Secret trouvé ! (${progress.secrets.length}/${SECRET_TOTAL})`, 'good', 6000);
            } else {
              const who = ui.hud.players.find((q) => q.id === pid);
              toast(`${who?.name ?? 'Un allié'} a trouvé un secret : ${def.done}`, 'good', 5000);
            }
          } else {
            this.floatText(p.x, 1.3, p.z, def.steps[Math.min(def.steps.length - 1, st - 1)] ?? '…', 'name');
          }
        }
        this.syncHud();
        break;
      }
      case Ev.Adapt: {
        const [, dom, v] = ev;
        toast(`Kessin s’adapte : les ennemis résistent désormais ${dom ? 'à la magie' : 'aux armes'} (−${v} %), mais craignent ${dom ? 'les armes' : 'la magie'}. Variez vos dégâts !`, 'enemy', 5000);
        ui.hud.adaptFx++;
        break;
      }
      case Ev.Death: {
        const [, id, type, x, z] = ev;
        this.thieves.delete(id);
        const d = ENEMIES[type];
        if (!d) return;
        const ei = f.enemyIdx(id);
        this.ents.killEnemy(id, type, ei >= 0 ? f.eX[ei] : x, ei >= 0 ? f.eZ[ei] : z, ei >= 0 ? f.eY[ei] : d.flying ? 2.4 : 0, this.time);
        const y = d.flying ? 2.4 : 0.5;
        const c = d.flying ? 0x37474f : DEATH_COLORS[d.biome] ?? 0x9e9e9e;
        fx.burst(x, y, z, d.boss ? 60 : Math.round(6 + d.size * 6), c, d.boss ? 7 : 3.5, 0.13 * d.size + 0.05, 0.8);
        fx.burst(x, y, z, 4, 0xffffff, 2, 0.12, 0.35, true, 0);
        if (d.boss) { this.r.shake(0.8); audio.play('bigdeath', 1.5); fx.ring(x, z, 5, 0xffffff, 1); }
        else audio.play(d.size > 1.1 ? 'bigdeath' : 'death', 0.6);
        // pièces d'or
        for (let k = 0; k < Math.min(6, Math.ceil(d.bounty / 8)); k++) fx.sparks.spawn(x, y + 0.3, z, (Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.7, 0.09, 0xffd54f);
        break;
      }
      case Ev.Leak:
        audio.play('leak');
        this.r.shake(0.2);
        fx.ring(this.world.exit.x, this.world.exit.z, 4, 0xef4444, 0.8);
        toast(`−${ev[2]} vie${ev[2] > 1 ? 's' : ''} !`, 'danger', 1400);
        break;
      case Ev.Build: {
        const sl = this.map.slots[ev[2]];
        if (sl) {
          fx.burst(sl.x, 0.3, sl.z, 18, 0xbcaaa4, 3, 0.2, 0.8);
          fx.shockwave(sl.x, sl.z, 2, 0xfff8e1, 0xbcaaa4, 0.45);
        }
        audio.play('build');
        break;
      }
      case Ev.Sell: {
        const sl = this.map.slots[ev[1]];
        if (sl) fx.burst(sl.x, 1, sl.z, 14, 0xffd54f, 4, 0.1, 0.8);
        audio.play('sell');
        break;
      }
      case Ev.Upgrade: {
        const t = this.ents.towerMuzzle.get(ev[1]);
        if (t) {
          fx.burst(t.x, t.y * 0.6, t.z, 26, 0xfff59d, 4, 0.12, 0.9, true, 1);
          fx.ring(t.x, t.z, 2, 0xfff176, 0.6);
          fx.pillars.add(t.x, 0, t.z, 1, 1.6, 2, t.y + 3, 0.8, 0xfff176, 1.2);
          fx.spiral(t.x, t.z, 1.4, 18, 0xfff59d, 1);
        }
        audio.play('upgrade');
        if (ev[3] === this.you && ev[2] !== this.you) {
          const who = ui.hud.players.find((p) => p.id === ev[2]);
          toast(`${who?.name ?? 'Un allié'} améliore votre tour`, 'good', 2500);
        }
        break;
      }
      case Ev.Spell: {
        const [, , owner, x, z, spell] = ev;
        const def = SPELLS[spell];
        if (!def) break;
        const team = PLAYER_COLORS[owner] ?? 0xffffff;
        const vol = owner === this.you ? 1 : 0.6;
        switch (def.id) {
          case 'renfort':
            // renforts : colonne de lumière, cercle aux couleurs du joueur, poussière à l'atterrissage
            fx.burst(x, 0.3, z, 16, 0xfff8e1, 3, 0.18, 0.6);
            fx.pillar(x, z, 1.3, 9, 0xfff1b0, 1.1);
            fx.runes.add(x, z, 2.2, Decal.Rune, 1.6, team, 1.6);
            fx.shockwave(x, z, 2.4, 0xfff3c0, 0x9e8a70, 0.5);
            for (let k = 0; k < 24; k++) fx.glow.spawn(x + (Math.random() - 0.5) * 2.4, 5 + Math.random() * 3, z + (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 0.6, -2.5, (Math.random() - 0.5) * 0.6, 1.4, 0.07, 0xfff59d, 0.6);
            fx.flashes.flash(x, 3, z, 0xfff1b0, 10, 0.6, 10);
            // renforts nommés : leur grade s'affiche au-dessus d'eux
            if (owner === this.you) this.floatText(x, 2.4, z, spellText(spell).name.replace('Renforts : ', '') + ' !', 'name');
            break;
          case 'meteor':
            // pluie de météores : zone d'impact marquée au sol
            fx.runes.add(x, z, 3, Decal.Rune, 1.8, 0xff7a2a, -1.2);
            fx.ring(x, z, 3, 0xff5722, 1.5, 3);
            break;
          case 'soin': break; // l'effet part du héros (impact de sanctuaire)
          default:
            // autres sorts de zone : cercle de lancement aux couleurs du joueur ; l'effet propre au sort vient des impacts
            fx.runes.add(x, z, def.radius, Decal.Rune, 1.0, team, 1.2);
            fx.ring(x, z, def.radius, team, 0.5);
        }
        audio.play('sp_' + def.id, vol);
        break;
      }
      case Ev.HeroSkill: {
        const [, owner, skill, , , hx, hz] = ev;
        let [, , , x, z] = ev;
        const s = this.interp.latest!;
        const hi = s.heroIndex(owner);
        const sk = hi >= 0 ? kitSkills(s.hCls[hi], s.hKit[hi])[skill] : null;
        // flèche perçante : un vrai tir à l'arc (bras en joue), pas le geste de sort levé vers le ciel
        const shot = sk?.id === 'perce' || sk?.id === 'visee';
        const sid = sk?.id ?? '';
        const throwKind = THROW_FX[sid];
        if (hi >= 0) {
          const uid = s.hUnit[hi];
          if (shot || throwKind !== undefined) this.ents.uFireTime[uid] = this.time;
          else if (SPIN_FX.has(sid)) { this.ents.spinTime[uid] = this.time; this.ents.uFireTime[uid] = this.time; }
          else if (SLAM_FX.has(sid)) {
            // bond puis coup au sol : l'onde de choc part quand il retombe
            this.ents.slamTime[uid] = this.time;
            this.pendingFx.push({ tick, x: hx, z: hz, delay: 0.32, made: this.time });
          } else this.ents.castTime[uid] = this.time;
          // sort ciblé : le héros se tourne vers le point visé
          if ((x - hx) ** 2 + (z - hz) ** 2 > 0.25) this.ents.aim(s.hUnit[hi], 0xffff, x, z, this.time, 0.9);
        }
        if (throwKind !== undefined) {
          // bombe, grenades, fioles, sorts lancés : l'objet part de la main et retombe sur la cible
          const pts: [number, number][] = [];
          if (sid === 'grenades') for (let k = 1; k <= 3; k++) pts.push([hx + ((x - hx) * k) / 3, hz + ((z - hz) * k) / 3]);
          else pts.push([x, z]);
          pts.forEach(([tx, tz], k) => {
            const d = Math.hypot(tx - hx, tz - hz);
            const fl = 0.3 + Math.min(0.35, d * 0.04);
            const t0 = tick + k * 2;
            fx.addShot({ kind: throwKind, sx: hx, sy: 1.5, sz: hz, tx, ty: 0.15, tz, targetId: 0xffff, t0, dur: Math.max(2, Math.round(fl * TICK_RATE)), arc: throwKind === 12 || throwKind === 9 ? 1 + d * 0.18 : 0.4 + d * 0.06, x: hx, y: 1.5, z: hz });
            this.pendingFx.push({ tick, x: tx, z: tz, delay: fl + (k * 2) / TICK_RATE, made: this.time });
          });
          audio.play('arrow', 0.8);
        } else if (sk?.id === 'perce') {
          // flèche perçante : trait lumineux et sillage de vent, depuis l'arc
          const dx = x - hx, dz = z - hz, l = Math.sqrt(dx * dx + dz * dz) || 1;
          const b = bowPos(hx, hz, x, z, this.tpos);
          const sx = b.x, sy = b.y, sz = b.z;
          const ex = hx + (dx / l) * 13, ez = hz + (dz / l) * 13;
          fx.beams.add(sx, sy, sz, ex, sy, ez, 0.35, 0.12, 0xc5e1a5);
          fx.beams.add(sx, sy, sz, ex, sy, ez, 0.25, 0.04, 0xffffff);
          fx.burst(sx, sy, sz, 8, 0xe8ffd0, 2.5, 0.08, 0.35, true, 0);
          for (let k = 0; k < 26; k++) {
            const t = k / 26;
            fx.glow.spawn(sx + (ex - sx) * t, sy + (Math.random() - 0.5) * 0.3, sz + (ez - sz) * t, (dx / l) * 2 + (Math.random() - 0.5), Math.random() * 0.8, (dz / l) * 2 + (Math.random() - 0.5), 0.35 + t * 0.3, 0.08, 0xd4f5b0, 0);
          }
          audio.play('arrow', 1.5);
        } else if (sk?.id === 'charge') {
          // charge : traînée bleutée et poussière le long du trajet réel (s'arrête à la portée, pas au curseur)
          const d0 = Math.hypot(x - hx, z - hz), range = sk.range ?? 7;
          const k = d0 > range ? range / d0 : 1;
          x = hx + (x - hx) * k;
          z = hz + (z - hz) * k;
          fx.beams.add(hx, 0.6, hz, x, 0.6, z, 0.3, 0.3, 0x90caf9);
          const l = Math.hypot(x - hx, z - hz);
          for (let k = 0; k < Math.min(30, l * 3); k++) {
            const t = Math.random();
            fx.sparks.spawn(hx + (x - hx) * t, 0.15, hz + (z - hz) * t, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 0.6, 0.18, 0x9e8a70, -3);
          }
        } else if (sk?.id === 'onde') {
          // onde tranchante : une lame d'air qui file sur 8 m
          const dx = x - hx, dz = z - hz, l = Math.hypot(dx, dz) || 1;
          const ex = hx + (dx / l) * 8, ez = hz + (dz / l) * 8;
          fx.beams.add(hx, 0.8, hz, ex, 0.8, ez, 0.3, 0.25, 0xcfe8ff);
          for (let k = 0; k < 24; k++) {
            const t = k / 24;
            fx.glow.spawn(hx + (ex - hx) * t, 0.5 + Math.random() * 0.6, hz + (ez - hz) * t, (dx / l) * 5, 0.5, (dz / l) * 5, 0.25 + t * 0.25, 0.12, 0xe3f2fd, 0);
          }
          audio.play('hit', 1.3);
        } else if (sk?.id === 'ralliement') {
          // cri de ralliement : cercle doré, étincelles qui montent
          fx.ring(hx, hz, 4.5, 0xffcc80, 0.8);
          fx.runes.add(hx, hz, 4.5, Decal.Rune, 1.4, 0xffcc80, 1.4);
          fx.spiral(hx, hz, 3, 30, 0xffe082, 1.2);
          fx.pillars.add(hx, 0, hz, 0.6, 1.2, 1, 3, 0.8, 0xffe082, 1);
          audio.play('heal');
        }
        if (owner === this.you) audio.play('spell', 0.6);
        break;
      }
      case Ev.Dmg: {
        const i = f.enemyIdx(ev[1]);
        this.ents.hitTime[ev[1]] = this.time;
        const fl = ev[3];
        if (fl & 4) {
          // plomb : le coup ricoche (étincelles grises, petit nombre gris de temps en temps)
          if (i >= 0) {
            for (let k = 0; k < 3; k++) fx.sparks.spawn(f.eX[i], f.eY[i] + 0.9, f.eZ[i], (Math.random() - 0.5) * 4, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 4, 0.3, 0.06, 0xe0e0e0);
            if (this.time - this.leadNumT > 0.35) { this.leadNumT = this.time; this.damageNumber(f.eX[i], f.eY[i] + 1.6, f.eZ[i], ev[2], 'lead'); }
          }
          break;
        }
        if (i >= 0 && (ev[2] >= 25 || fl)) this.damageNumber(f.eX[i], f.eY[i] + 1.6, f.eZ[i], ev[2], fl ? 'crit' : '');
        if (fl === 2 && i >= 0) fx.burst(f.eX[i], 0.8, f.eZ[i], 14, 0xea80fc, 3, 0.12, 0.5, true, 0);
        break;
      }
      case Ev.Income: {
        const [, tid, gold, lives] = ev;
        const t = this.ents.towerMuzzle.get(tid);
        if (t) {
          for (let k = 0; k < 10; k++) fx.sparks.spawn(t.x, t.y, t.z, (Math.random() - 0.5) * 2.5, 3 + Math.random() * 2, (Math.random() - 0.5) * 2.5, 0.8, 0.1, 0xffd54f);
          if (t.owner === this.you) this.damageNumber(t.x, t.y + 1, t.z, gold, 'gold');
        }
        if (lives) {
          const c = this.world.castle;
          fx.burst(c.x, 2.5, c.z, 16, 0xff6b81, 2.5, 0.12, 0.8, true, 1.5);
        }
        break;
      }
      case Ev.WaveStart: {
        const [, wave, boss, mut] = ev;
        this.lastWave = wave;
        const total = this.cfg.mode === 'story' ? ` / ${this.interp.latest?.totalWaves ?? ''}` : '';
        const ls = this.interp.latest;
        const sky = ls?.rain && ls.night ? 'Nuit pluvieuse : feux éteints, givre renforcé, archers myopes loin des torches'
          : ls?.rain ? 'Il pleut : les feux faiblissent, le givre est renforcé'
          : ls?.night ? 'La nuit tombe : les archers voient moins loin, sauf près des torches' : '';
        banner(boss ? 'Le boss arrive !' : `Vague ${wave}${total}`, mut !== 255 && MUTATIONS[mut] ? `Mutation : ${MUTATIONS[mut].name} — ${MUTATIONS[mut].desc}` : sky);
        if (sky && mut !== 255 && MUTATIONS[mut]) toast(sky, 'info', 4000);
        audio.play(boss ? 'boss' : 'wave');
        if (this.cfg.mode === 'story' && ui.game) {
          const st = STORY[ui.game.level];
          const lines = st?.waves?.[wave];
          if (lines) this.showDialog(lines);
        }
        break;
      }
      case Ev.LevelUp: {
        if (ev[1] === this.you) {
          const k = SKILL_UNLOCK.indexOf(ev[2]);
          const unlocked = k >= 0 ? hudSkills()[k] : null;
          toast(`Votre héros passe niveau ${ev[2]} !${unlocked ? ` Nouvelle compétence : ${unlocked.name}` : ''}`, 'good', 3000);
          audio.play('levelup');
        }
        const s = this.interp.latest!;
        const hi = s.heroIndex(ev[1]);
        const i = hi >= 0 ? f.unitIdx(s.hUnit[hi]) : -1;
        if (i >= 0) {
          fx.burst(f.uX[i], 1, f.uZ[i], 24, 0xfff176, 3, 0.1, 1, true, 2);
          fx.ring(f.uX[i], f.uZ[i], 1.5, 0xfff176, 0.6);
          fx.pillar(f.uX[i], f.uZ[i], 0.9, 6, 0xfff176, 1.1);
          fx.spiral(f.uX[i], f.uZ[i], 1, 20, 0xfff59d);
          this.ents.castTime[s.hUnit[hi]] = this.time;
        }
        break;
      }
      case Ev.Stun: {
        const t = this.ents.towerMuzzle.get(ev[1]);
        if (t) {
          fx.burst(t.x, t.y, t.z, 16, 0xb2ff59, 2, 0.12, 1, true, 0);
          fx.beams.add(t.x, t.y + 3, t.z, t.x, t.y, t.z, 0.3, 0.15, 0xb2ff59, 0.5);
        }
        audio.play('stun');
        break;
      }
      case Ev.Teleport:
        fx.burst(ev[2], 0.8, ev[3], 18, 0xea80fc, 3, 0.12, 0.6, true, 1);
        break;
      case Ev.BossPhase: {
        const d = ENEMIES[ev[2]];
        const i = f.enemyIdx(ev[1]);
        if (i >= 0) fx.burst(f.eX[i], 1.5, f.eZ[i], 60, 0xff3d00, 7, 0.2, 1, true, 0);
        // nouvelle position : l'événement arrive avant le snapshot qui la porte, on la lit dans le dernier reçu
        const s = this.interp.latest;
        let x = i >= 0 ? f.eX[i] : 0, z = i >= 0 ? f.eZ[i] : 0;
        if (s) for (let k = 0; k < s.eCount; k++) if (s.eId[k] === ev[1]) { const p = this.map.paths[s.ePath[k]]; if (p) { p.at(s.eDist[k], s.eLane[k], this.tmpP); x = this.tmpP.x; z = this.tmpP.z; } break; }
        this.bossEntrance(d?.name ?? 'Le boss se transforme !', d?.desc ?? '', x, z);
        this.r.shake(0.9);
        fx.burst(x, 1.5, z, 50, 0xff6e40, 6, 0.2, 1, true, 1);
        break;
      }
      case Ev.UnitDeath:
        fx.burst(ev[1], 0.5, ev[2], 8, 0xbdbdbd, 2.5, 0.12, 0.6);
        audio.play('hit', 0.5);
        break;
      case Ev.Heal:
        fx.burst(ev[1], 0.8, ev[2], 12, 0x69f0ae, 1.5, 0.1, 0.9, true, 1.5);
        break;
      case Ev.Gift: {
        const from = ui.hud.players.find((p) => p.id === ev[1]);
        const to = ui.hud.players.find((p) => p.id === ev[2]);
        if (ev[2] === this.you) toast(`${from?.name ?? '?'} vous donne ${ev[3]} or`, 'good');
        else if (ev[1] === this.you) toast(`Vous donnez ${ev[3]} or à ${to?.name ?? '?'}`, 'info');
        break;
      }
      case Ev.Spawn:
        fx.burst(ev[2], 0.3, ev[3], 6, 0x8d6e63, 2, 0.12, 0.5);
        break;
      case Ev.HeroDeath:
        if (ev[1] === this.you) {
          toast(`Votre héros est tombé ! Retour dans ${HERO_RESPAWN_S} secondes.`, 'danger', 3000);
        }
        break;
      case Ev.Item: {
        const [, owner, i, x, z] = ev;
        const it = ITEMS[i];
        if (!it) break;
        if (owner === this.you) {
          ui.hud.items[i] = Math.max(0, (ui.hud.items[i] ?? 0) - 1);
          consumeItem(i);
        } else {
          const who = ui.hud.players.find((p) => p.id === owner);
          toast(`${who?.name ?? '?'} utilise : ${it.name}`, 'info', 2200);
        }
        if (i === Item.Bourse) {
          const hp = owner === this.you ? this.heroPos() : null;
          if (hp) fx.burst(hp.x, 1.5, hp.z, 24, 0xffd54f, 4, 0.12, 0.8, true, -4);
          audio.play('sell');
        } else if (i === Item.Potion) {
          const c = this.world.castle;
          fx.burst(c.x, 2.5, c.z, 30, 0xff6b81, 3, 0.14, 1, true, 1.5);
          fx.ring(c.x, c.z, 3, 0xff8a9a, 0.8);
          audio.play('heal');
        } else if (i === Item.Givre) {
          fx.ring(x, z, it.radius, 0xb3e5fc, 1, 2);
          fx.burst(x, 1, z, 40, 0xe1f5fe, 4, 0.12, 1, true, -1);
        } else if (i === Item.Bombe) {
          fx.flashes.flash(x, 2, z, 0xffcc80, 12, 0.5, it.radius * 5);
          this.r.shake(0.35);
        }
        break;
      }
      case Ev.GameEnd:
        audio.play(ev[1] ? 'victory' : 'defeat');
        break;
      case Ev.Skill: {
        const t = this.ents.towerMuzzle.get(ev[1]);
        if (t) fx.burst(t.x, t.y, t.z, 10, 0xfff59d, 2, 0.1, 0.5, true, 1);
        break;
      }
    }
  }

  nextDialog() {
    const d = ui.dialog;
    if (!d) return;
    audio.play('click');
    if (d.i + 1 >= d.lines.length) this.dialogDone();
    else d.i++;
  }

  // ------------------------------------------------------------ fin

  handleEnd(info: import('@dfend/shared').EndInfo) {
    if (this.ended) return;
    this.ended = true;
    ui.end = info;
    audio.intensity = 0;
    // étoiles gagnées pour l'atelier : amélioration du record, ou bonus (survie, niveau déjà parfait)
    ui.starsGained = 0;
    if (info.mode === 'survival') {
      ui.starsGained = survivalStars(info.wave);
      addBonusStars(ui.starsGained);
    }
    ui.heroPointsGained = 0;
    if (info.mode === 'story' && ui.game && info.won) {
      const lv = ui.game.level;
      const ptsBefore = heroPoints(progress.stars);
      progress.stars[lv] ??= [0, 0, 0];
      const before = progress.stars[lv][info.difficulty] ?? 0;
      progress.stars[lv][info.difficulty] = Math.max(before, info.stars);
      ui.starsGained = Math.max(0, info.stars - before);
      if (before >= 3 && info.stars >= 3) {
        ui.starsGained = 1;
        addBonusStars(1);
      }
      ui.heroPointsGained = heroPoints(progress.stars) - ptsBefore;
      if (lv + 1 > progress.unlocked && lv + 1 < STORY.length) progress.unlocked = lv + 1;
      if (lv === STORY.length - 1) progress.finished = true;
      saveProgress();
      const outro = STORY[lv]?.outro;
      if (outro) setTimeout(() => this.showDialog(outro), 900);
    }
    void this.onLeaveRequest;
  }

  private endPrologue() {
    this.prologue?.dispose();
    this.prologue = null;
    this.ents.hideHeroes = false;
  }

  dispose() {
    this.endPrologue();
    for (const d of this.disposers) d();
    this.host.dispose();
    const scene = this.r.scene;
    for (const obj of [this.world.group, this.ents.group, this.fx.group, this.weather.group, this.props.group, this.rangeRing, this.hoverRing, this.aimRing, this.focusRing, this.rallyFlag]) { scene.remove(obj); forgetPools(obj); }
    scene.traverse(() => {});
    const disposeTree = (o: THREE.Object3D) => o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    disposeTree(this.world.group);
    ui.sel = null;
    ui.dialog = null;
  }
}
