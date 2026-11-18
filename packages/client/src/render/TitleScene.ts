import * as THREE from 'three';
import { ENEMIES, buildRuntimeMap, classLook, classOf, type SampledPath } from '@dfend/shared';
import { enemyGeometry } from '../art/enemies';
import { K, geoFor, model } from '../art/models';
import { towerModel } from '../art/towers';
import { heroGeometry } from '../art/units';
import { WEAPON_STYLE, heroWeapon } from '../art/weapons';
import { settings } from '../settings';
import { progress, ui } from '../state.svelte';
import { Decal, Fx } from './Fx';
import { InstPool, forgetPools } from './InstPool';
import type { Renderer } from './Renderer';
import { stride } from './stride';
import { buildWorld } from './World';

/**
 * Écran titre : un diorama qui vit tout seul.
 * Des gobelins, loups et brutes avancent vraiment le long du chemin, deux tours leur tirent dessus,
 * le héros les attend et les combat ;
 * des corbeaux tournent dans le ciel et des lucioles flottent.
 */
interface Foe {
  type: number;
  d: number;
  lane: number;
  hp: number;
  x: number;
  z: number;
  yaw: number;
  born: number;
  dead: number;
  hit: number;
  fighting: boolean;
  wait: number;
  /** phase de marche cumulée */
  ph: number;
}

const TICK = 20;

export class TitleScene {
  private group = new THREE.Group();
  private t = 0;
  private fx: Fx;
  private path: SampledPath;
  private foes: Foe[] = [];
  private pools = new Map<number, InstPool>();
  private hero!: InstPool;
  /** personnage affiché (apparence choisie, arme de sa classe) */
  private skin = '';
  private weaponKind = -1;
  private heroWeapon: InstPool | null = null;
  private heroStyle = 0;
  /** poste de garde du héros (devant la tour), sa position et son cap */
  private post = { x: 0, z: 0 };
  private heroPos = { x: 0, z: 0, yaw: 0 };
  private heroMoving = false;
  private heroPhase = 0;
  /** avancement sur le chemin du poste du héros, et cap de base de la caméra */
  private postD = 40;
  private camBase = 0;
  private heroAtk = 0;
  private heroTarget: Foe | null = null;
  private towers: { pool: InstPool; x: number; z: number; y: number; kind: number; cd: number; fired: number; range: number }[] = [];
  private heightAt: (x: number, z: number) => number;
  private crows: InstPool;
  private focus = new THREE.Vector3(2, 1, -2);
  private tmp = { x: 0, z: 0 };
  private spawnT = 0;
  /** avancement sur le chemin du fond de la galerie d'entrée */
  private tunnelD = -1;

  constructor(private r: Renderer) {
    const map = buildRuntimeMap('pont', 4);
    const w = buildWorld(map, { surround: true });
    this.group.add(w.group);
    r.applyTheme(w.theme);
    this.heightAt = w.heightAt;
    // les ennemis sortent de la galerie : avant sa bouche, ils sont encore sous la colline
    const e0 = w.entries[0];
    this.tunnelD = e0 ? (e0.i / Math.max(1, map.paths[0].count - 1)) * map.paths[0].length - 2.4 : -1;
    this.path = map.paths[0];
    this.fx = new Fx(this.group);
    this.fx.setGround(w.ground);
    const pool = (key: string, fb: () => THREE.BufferGeometry, cap: number) => {
      const g = geoFor(key, fb);
      return new InstPool(g.geo, cap, this.group, settings.shadows, g.map);
    };
    for (const id of ['gobelin', 'loup', 'brute']) {
      const i = ENEMIES.findIndex((e) => e.id === id);
      this.pools.set(i, pool(K.enemy(id), () => enemyGeometry(id), 12));
    }
    // point de garde de départ : aux deux tiers du parcours
    this.path.at(this.path.length * 0.58, 0, this.tmp);
    const k = Math.min(this.path.count - 1, Math.floor((this.path.length * 0.58) / (this.path.length / (this.path.count - 1))));
    this.heroPos.x = this.tmp.x + this.path.nx[k] * 0.4;
    this.heroPos.z = this.tmp.z + this.path.nz[k] * 0.4;
    this.syncHero();
    // deux tours sur les emplacements les plus proches du héros
    const slots = [...map.slots].filter((s) => !s.locked && (s.x - this.heroPos.x) ** 2 + (s.z - this.heroPos.z) ** 2 > 16).sort((a, b) => (a.x - this.heroPos.x) ** 2 + (a.z - this.heroPos.z) ** 2 - ((b.x - this.heroPos.x) ** 2 + (b.z - this.heroPos.z) ** 2));
    [[0, 2], [2, 2]].forEach(([fam, lvl], i) => {
      const s = slots[i];
      if (!s) return;
      const m = model(K.tower(fam, lvl));
      const tm = m ? null : towerModel(fam, lvl);
      const p = new InstPool(m ? m.geo : tm!.base, 1, this.group, settings.shadows, m ? m.map : null);
      const y = m ? (m.meta.muzzleY ?? m.meta.height * 0.8) : tm!.muzzleY;
      this.towers.push({ pool: p, x: s.x, z: s.z, y, kind: fam === 0 ? 0 : fam === 2 ? 1 : 4, cd: fam === 0 ? 0.9 : fam === 2 ? 1.4 : 2.4, fired: -9, range: fam === 3 ? 9 : 8 });
    });
    // le héros monte la garde devant la première tour : entre elle et le chemin, au bord de la terre battue
    const t0 = this.towers[0];
    if (t0) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < this.path.count; i++) {
        const d = (this.path.xs[i] - t0.x) ** 2 + (this.path.zs[i] - t0.z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      const px = this.path.xs[best], pz = this.path.zs[best];
      this.postD = (best / Math.max(1, this.path.count - 1)) * this.path.length;
      const dx = t0.x - px, dz = t0.z - pz, l = Math.hypot(dx, dz) || 1;
      this.post.x = px + (dx / l) * 1.6;
      this.post.z = pz + (dz / l) * 1.6;
      // la caméra reste du côté du chemin (le héros entre elle et la tour)
      this.camBase = Math.atan2(-dx, -dz);
    } else {
      this.post.x = this.heroPos.x;
      this.post.z = this.heroPos.z;
    }
    this.heroPos.x = this.post.x;
    this.heroPos.z = this.post.z;
    this.focus.set(this.post.x, 1, this.post.z);
    this.crows = pool(K.enemy('corbeau'), () => enemyGeometry('corbeau'), 4);
    // une colonne déjà en route au lancement : la tête arrive au poste du héros en quelques secondes
    for (let i = 0; i < 6; i++) this.spawn(Math.max(0.5, this.postD - 5 - i * 3.2), -9);
    r.scene.add(this.group);
  }

  private spawn(d = 0, born = this.t) {
    const roll = Math.random();
    const id = roll < 0.65 ? 'gobelin' : roll < 0.88 ? 'loup' : 'brute';
    const type = ENEMIES.findIndex((e) => e.id === id);
    this.foes.push({ type, d, lane: (Math.random() - 0.5) * 1.2, hp: id === 'brute' ? 6 : id === 'loup' ? 2 : 3, x: 0, z: 0, yaw: 0, born, dead: -1, hit: -9, fighting: false, wait: 0, ph: 0 });
  }

  private damage(f: Foe, n = 1) {
    if (f.dead >= 0) return;
    f.hp -= n;
    f.hit = this.t;
    if (f.hp <= 0) {
      f.dead = this.t;
      this.fx.burst(f.x, 0.6, f.z, 10, 0x6d8f3a, 3, 0.12, 0.6);
      for (let k = 0; k < 4; k++) this.fx.sparks.spawn(f.x, 0.9, f.z, (Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.7, 0.09, 0xffd54f);
    }
  }

  /** Personnage choisi par le joueur (apparence + arme de sa classe) : maillages refaits s'il a changé. */
  private syncHero() {
    const id = ui.hero;
    const weapon = classLook(classOf(progress.hero) ? progress.hero.cls : -1).weapon;
    if (id === this.skin && weapon === this.weaponKind) return;
    this.skin = id;
    this.weaponKind = weapon;
    this.hero?.dispose();
    this.heroWeapon?.dispose();
    this.heroWeapon = null;
    this.heroStyle = 0;
    const g = geoFor(K.hero(id), () => heroGeometry(id));
    this.hero = new InstPool(g.geo, 1, this.group, settings.shadows, g.map);
    // arme et animation de combat (modèle importé)
    const hm = model(K.hero(id));
    const wg = hm ? heroWeapon(id, hm.geo, weapon) : null;
    if (wg) {
      this.heroWeapon = new InstPool(wg, 1, this.group, settings.shadows);
      this.heroStyle = WEAPON_STYLE[weapon];
    }
  }

  update(dt: number) {
    this.syncHero();
    this.t += dt;
    const t = this.t, fx = this.fx;
    const tick = t * TICK;
    // ------------------------------------------------ ennemis
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.foes.filter((f) => f.dead < 0).length < 9) {
      this.spawn();
      this.spawnT = 1.1 + Math.random() * 1.4;
    }
    const L = this.path.length;
    let w = 0;
    for (const f of this.foes) {
      const def = ENEMIES[f.type];
      if (f.dead >= 0 && t - f.dead > 0.9) continue;
      if (f.d > L - 1) continue;
      this.foes[w++] = f;
      if (f.dead >= 0) continue;
      // le héros choisit le premier ennemi qui approche de son poste ; celui-ci s'arrête quand le héros est au contact
      const dp = Math.hypot(f.x - this.post.x, f.z - this.post.z);
      if (!this.heroTarget && dp < 4.2) this.heroTarget = f;
      const dh = Math.hypot(f.x - this.heroPos.x, f.z - this.heroPos.z);
      f.fighting = this.heroTarget === f && dh < 1.5;
      if (!f.fighting) f.d += def.speed * 0.9 * dt;
      this.path.at(f.d, f.lane, this.tmp);
      const nx = this.tmp.x, nz = this.tmp.z;
      if (Math.hypot(nx - f.x, nz - f.z) > 1e-3 && !f.fighting) f.yaw = Math.atan2(nx - f.x, nz - f.z);
      if (f.fighting) f.yaw = Math.atan2(this.heroPos.x - f.x, this.heroPos.z - f.z);
      f.x = nx; f.z = nz;
    }
    this.foes.length = w;
    if (this.heroTarget && (this.heroTarget.dead >= 0 || !this.foes.includes(this.heroTarget))) this.heroTarget = null;

    // ------------------------------------------------ le héros : va au-devant de l'ennemi, se bat, puis regagne son poste
    const tg = this.heroTarget;
    const hp = this.heroPos;
    let gx = this.post.x, gz = this.post.z;
    if (tg) {
      const dx = hp.x - tg.x, dz = hp.z - tg.z, l = Math.hypot(dx, dz) || 1;
      gx = tg.x + (dx / l) * 1.05;
      gz = tg.z + (dz / l) * 1.05;
    }
    const hmx = gx - hp.x, hmz = gz - hp.z, ml = Math.hypot(hmx, hmz);
    const step = 2.8 * dt;
    this.heroMoving = ml > 0.08;
    if (this.heroMoving) {
      const k = Math.min(1, step / ml);
      hp.x += hmx * k;
      hp.z += hmz * k;
    }
    const fighting = !!tg && Math.hypot(tg.x - hp.x, tg.z - hp.z) < 1.5;
    // cap : vers l'ennemi au combat, dans le sens de la marche, sinon vers le chemin (face aux arrivants)
    let yawT = hp.yaw;
    if (tg) yawT = Math.atan2(tg.x - hp.x, tg.z - hp.z);
    else if (this.heroMoving) yawT = Math.atan2(hmx, hmz);
    else {
      this.path.at(this.path.length * 0.3, 0, this.tmp);
      yawT = Math.atan2(this.tmp.x - hp.x, this.tmp.z - hp.z);
    }
    let hdy = yawT - hp.yaw;
    while (hdy > Math.PI) hdy -= Math.PI * 2;
    while (hdy < -Math.PI) hdy += Math.PI * 2;
    hp.yaw += hdy * Math.min(1, dt * 9);
    // coups synchronisés avec l'animation : dégâts au moment où la lame s'abat (phase ~0,6 du cycle)
    const phase0 = 0.3;
    const atk = (((t * 1.0 + phase0 * 0.37) % 1) + 1) % 1;
    if (fighting && tg) {
      const prev = this.heroAtk;
      this.heroAtk = atk;
      if (prev < 0.6 && atk >= 0.6) {
        this.damage(tg);
        fx.burst(tg.x, 0.8, tg.z, 6, 0xffffff, 2.5, 0.08, 0.3, true, 0);
      }
    } else this.heroAtk = atk;
    const mode = (fighting ? 1 : 0) + this.heroStyle * 2;
    this.heroPhase = stride(this.heroPhase, this.heroMoving || fighting ? 9 : 0, dt);
    for (const p of this.heroWeapon ? [this.hero, this.heroWeapon] : [this.hero]) {
      p.begin();
      const hj = p.push(hp.x, 0, hp.z, hp.yaw, 1.5, phase0, this.heroPhase, 0, mode);
      p.setTeam(hj, 0x3b82f6);
      p.setPose(hj, 0, 0, 0, 1);
      p.end();
    }

    // ------------------------------------------------ tours
    for (const tw of this.towers) {
      tw.pool.begin();
      const j = tw.pool.push(tw.x, 0, tw.z, 0, 1, 0, 0, 0, 0);
      tw.pool.setTeam(j, 0x3b82f6);
      const rec = t - tw.fired < 0.3 ? Math.max(0.001, (t - tw.fired) / 0.3) : 0;
      if (rec) tw.pool.setPose(j, rec, 0, 0, 0);
      tw.pool.end();
      if (t - tw.fired < tw.cd) continue;
      // cible : l'ennemi vivant le plus avancé à portée
      let best: Foe | null = null;
      for (const f of this.foes) if (f.dead < 0 && (f.x - tw.x) ** 2 + (f.z - tw.z) ** 2 < tw.range ** 2 && (!best || f.d > best.d)) best = f;
      if (!best) continue;
      tw.fired = t;
      const dur = tw.kind === 4 ? 20 : 9;
      const target = best;
      fx.addShot({ kind: tw.kind, sx: tw.x, sy: tw.y, sz: tw.z, tx: target.x, ty: 0.7, tz: target.z, targetId: 0xffff, t0: tick, dur, arc: tw.kind === 4 ? 4 : tw.kind === 0 ? 1.2 : 0.3, x: tw.x, y: tw.y, z: tw.z });
      setTimeout(() => {
        if (tw.kind === 4) {
          fx.burst(target.x, 0.3, target.z, 12, 0x6d4c41, 4, 0.2, 0.6);
          fx.burst(target.x, 0.4, target.z, 8, 0xffb74d, 3, 0.18, 0.3, true, 0);
          fx.decals.add(target.x, target.z, 0.9, Decal.Scorch, 2, 0xff8f00);
          for (const f of this.foes) if ((f.x - target.x) ** 2 + (f.z - target.z) ** 2 < 2.2) this.damage(f, 2);
        } else {
          if (tw.kind === 1) fx.burst(target.x, 0.8, target.z, 8, 0xea80fc, 2.5, 0.1, 0.35, true, 0);
          this.damage(target);
        }
      }, (dur / TICK) * 1000);
    }

    // ------------------------------------------------ dessin des ennemis
    for (const p of this.pools.values()) p.begin();
    for (const f of this.foes) {
      const def = ENEMIES[f.type];
      const p = this.pools.get(f.type)!;
      if (f.d < this.tunnelD) continue;
      const life = f.dead >= 0 ? -Math.min(0.999, Math.max(0.001, (t - f.dead) / 0.9)) : Math.min(1, Math.max(0.001, (t - f.born) / 0.5));
      const flash = Math.max(0, 1 - (t - f.hit) / 0.1) * 0.35;
      f.ph = stride(f.ph, f.dead >= 0 || f.fighting ? 0 : (def.speed * 4.5) / Math.max(0.6, def.size), dt);
      const j = p.push(f.x, 0, f.z, f.yaw, def.size, f.d * 3.1, f.ph, flash, f.fighting ? 1 : 0);
      p.setPose(j, 0, Math.max(0, 1 - (t - f.hit) / 0.22), 0, life);
    }
    for (const p of this.pools.values()) p.end();

    // ------------------------------------------------ corbeaux et lucioles
    this.crows.begin();
    for (let c = 0; c < 3; c++) {
      const w = 0.25 + c * 0.07, a = t * w + c * 2.1, rad = 9 + c * 3;
      const x = this.focus.x + Math.cos(a) * rad, z = this.focus.z - 4 + Math.sin(a) * rad * 0.7;
      // cap = direction de la trajectoire ; penché vers l'intérieur du virage ; léger rebond à chaque battement
      const yaw = Math.atan2(-Math.sin(a), Math.cos(a) * 0.7);
      const y = 6 + c * 1.2 + Math.sin(t * 0.6 + c) * 0.5 + Math.sin(t * 7 + c) * 0.06;
      const j = this.crows.push(x, y, z, yaw, 0.9, c, 1, 0, 0);
      this.crows.setPose(j, 0, 0, 0.3, 1);
    }
    this.crows.end();
    if (Math.random() < dt * 6) fx.glow.spawn(this.focus.x + (Math.random() - 0.5) * 30, 0.3 + Math.random() * 2, this.focus.z + (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 0.4, 0.25, (Math.random() - 0.5) * 0.4, 3, 0.05, 0xfff3a0, -0.05);

    fx.update(dt, tick, () => false);

    // ------------------------------------------------ caméra : lent balancement devant la scène (jamais derrière les tours)
    const a = this.camBase + Math.sin(t * 0.07) * 0.75;
    const cam = this.r.camera;
    const f = this.focus;
    // téléphone en portrait : le menu couvre le bas de l'écran ; on vise plus bas pour remonter le héros
    // dans la bande visible entre le logo et le menu
    const tall = (cam as THREE.PerspectiveCamera).aspect < 0.8;
    const dist = tall ? 15 : 13, lookY = tall ? f.y - 2.2 : f.y + 1.6;
    const place = () => {
      cam.position.set(f.x + Math.sin(a) * dist, (tall ? 6 : 5.2) + Math.sin(t * 0.2) * 0.5, f.z + Math.cos(a) * dist);
      cam.lookAt(f.x - Math.sin(a) * 5, lookY, f.z - Math.cos(a) * 5);
    };
    place();
    this.r.update(dt, t);
    place();
  }

  dispose() {
    this.r.scene.remove(this.group);
    forgetPools(this.group);
  }
}
