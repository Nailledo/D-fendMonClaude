import * as THREE from 'three';
import { ENEMIES, buildRuntimeMap, type SampledPath } from '@dfend/shared';
import { enemyGeometry } from '../art/enemies';
import { K, geoFor, model } from '../art/models';
import { towerModel } from '../art/towers';
import { heroGeometry } from '../art/units';
import { settings } from '../settings';
import { Decal, Fx } from './Fx';
import { InstPool, forgetPools } from './InstPool';
import type { Renderer } from './Renderer';
import { buildWorld } from './World';

/**
 * Écran titre : un diorama qui vit tout seul.
 * Des gobelins, loups et brutes avancent vraiment le long du chemin, deux tours leur tirent dessus,
 * Samuel les attend et les combat ; au loin Kessin plane, rugit et lance des boules de feu ;
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
}

const TICK = 20;

export class TitleScene {
  private group = new THREE.Group();
  private t = 0;
  private fx: Fx;
  private path: SampledPath;
  private foes: Foe[] = [];
  private pools = new Map<number, InstPool>();
  private hero: InstPool;
  private heroPos = { x: 0, z: 0, yaw: 0 };
  private heroAtk = 0;
  private heroTarget: Foe | null = null;
  private towers: { pool: InstPool; x: number; z: number; y: number; kind: number; cd: number; fired: number; range: number }[] = [];
  private kessin: InstPool;
  private kessinPos = new THREE.Vector3(-20, 0, -32);
  /** Kessin marche le long de l'horizon : avancement, cap, hauteur de la gueule */
  private kPhase = 0;
  private kYaw = 0;
  private kMouth = 5;
  private heightAt: (x: number, z: number) => number;
  private nextRoar = 4;
  private roar = -99;
  private crows: InstPool;
  private focus = new THREE.Vector3(2, 1, -2);
  private tmp = { x: 0, z: 0 };
  private spawnT = 0;

  constructor(private r: Renderer) {
    const map = buildRuntimeMap('pont', 4);
    const w = buildWorld(map);
    this.group.add(w.group);
    r.applyTheme(w.theme);
    this.heightAt = w.heightAt;
    this.path = map.paths[0];
    this.fx = new Fx(this.group);
    const pool = (key: string, fb: () => THREE.BufferGeometry, cap: number) => {
      const g = geoFor(key, fb);
      return new InstPool(g.geo, cap, this.group, settings.shadows, g.map);
    };
    for (const id of ['gobelin', 'loup', 'brute']) {
      const i = ENEMIES.findIndex((e) => e.id === id);
      this.pools.set(i, pool(K.enemy(id), () => enemyGeometry(id), 12));
    }
    // Samuel garde le chemin, un peu en retrait, aux deux tiers du parcours
    this.path.at(this.path.length * 0.58, 0, this.tmp);
    const k = Math.min(this.path.count - 1, Math.floor((this.path.length * 0.58) / (this.path.length / (this.path.count - 1))));
    this.heroPos.x = this.tmp.x + this.path.nx[k] * 0.4;
    this.heroPos.z = this.tmp.z + this.path.nz[k] * 0.4;
    this.focus.set(this.heroPos.x, 1, this.heroPos.z);
    this.hero = pool(K.hero('samuel'), () => heroGeometry('samuel'), 1);
    // deux tours sur les emplacements les plus proches de Samuel
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
    // Kessin à pied (première forme) : il arpente les collines au loin
    const kg = geoFor(K.enemy('kessin1'), () => enemyGeometry('kessin1'));
    kg.geo.computeBoundingBox();
    this.kMouth = kg.geo.boundingBox!.max.y * 0.82;
    this.kessin = new InstPool(kg.geo, 1, this.group, settings.shadows, kg.map);
    this.crows = pool(K.enemy('corbeau'), () => enemyGeometry('corbeau'), 4);
    // une colonne déjà en route au lancement
    for (let i = 0; i < 6; i++) this.spawn(this.path.length * (0.05 + i * 0.07), -9);
    r.scene.add(this.group);
  }

  private spawn(d = 0, born = this.t) {
    const roll = Math.random();
    const id = roll < 0.65 ? 'gobelin' : roll < 0.88 ? 'loup' : 'brute';
    const type = ENEMIES.findIndex((e) => e.id === id);
    this.foes.push({ type, d, lane: (Math.random() - 0.5) * 1.2, hp: id === 'brute' ? 6 : id === 'loup' ? 2 : 3, x: 0, z: 0, yaw: 0, born, dead: -1, hit: -9, fighting: false, wait: 0 });
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

  update(dt: number) {
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
      // Samuel bloque le premier ennemi qui arrive à sa hauteur
      const dh = Math.hypot(f.x - this.heroPos.x, f.z - this.heroPos.z);
      f.fighting = this.heroTarget === f;
      if (!this.heroTarget && dh < 1.4) { this.heroTarget = f; f.fighting = true; }
      if (!f.fighting) f.d += def.speed * 0.9 * dt;
      this.path.at(f.d, f.lane, this.tmp);
      const nx = this.tmp.x, nz = this.tmp.z;
      if (Math.hypot(nx - f.x, nz - f.z) > 1e-3 && !f.fighting) f.yaw = Math.atan2(nx - f.x, nz - f.z);
      if (f.fighting) f.yaw = Math.atan2(this.heroPos.x - f.x, this.heroPos.z - f.z);
      f.x = nx; f.z = nz;
    }
    this.foes.length = w;
    if (this.heroTarget && (this.heroTarget.dead >= 0 || !this.foes.includes(this.heroTarget))) this.heroTarget = null;

    // ------------------------------------------------ Samuel
    const tg = this.heroTarget;
    if (tg) {
      this.heroPos.yaw = Math.atan2(tg.x - this.heroPos.x, tg.z - this.heroPos.z);
      this.heroAtk += dt;
      if (this.heroAtk > 0.8) {
        this.heroAtk = 0;
        this.damage(tg);
        fx.burst(tg.x, 0.8, tg.z, 6, 0xffffff, 2.5, 0.08, 0.3, true, 0);
      }
    } else {
      this.heroAtk = 0;
      this.heroPos.yaw += (Math.atan2(this.focus.x - this.heroPos.x + 6, this.focus.z - this.heroPos.z - 6) - this.heroPos.yaw) * Math.min(1, dt * 2);
    }
    this.hero.begin();
    const hj = this.hero.push(this.heroPos.x, 0, this.heroPos.z, this.heroPos.yaw, 1.5, 0.3, tg ? 9 : 0, 0, tg ? 1 : 0);
    this.hero.setTeam(hj, 0x3b82f6);
    this.hero.setPose(hj, 0, 0, 0, 1);
    this.hero.end();

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
      const life = f.dead >= 0 ? -Math.min(0.999, Math.max(0.001, (t - f.dead) / 0.9)) : Math.min(1, Math.max(0.001, (t - f.born) / 0.5));
      const flash = Math.max(0, 1 - (t - f.hit) / 0.12) * 0.7;
      const j = p.push(f.x, 0, f.z, f.yaw, def.size, f.d * 3.1, f.dead >= 0 || f.fighting ? 0 : def.speed * 4.5 / Math.max(0.6, def.size), flash, f.fighting ? 1 : 0);
      p.setPose(j, 0, Math.max(0, 1 - (t - f.hit) / 0.22), 0, life);
    }
    for (const p of this.pools.values()) p.end();

    // ------------------------------------------------ Kessin, au loin
    // il reste à l'arrière-plan, à l'opposé de la caméra qui tourne, et marche de long en large sur les collines
    if (t > this.nextRoar) {
      this.roar = t;
      this.nextRoar = t + 7 + Math.random() * 4;
    }
    const rt = t - this.roar;
    const roaring = rt < 1.8;
    const oa = t * 0.05;
    const rx = Math.sin(oa), rz = Math.cos(oa); // direction caméra → scène (radiale)
    const tx0 = rz, tz0 = -rx; // tangente à l'horizon
    if (!roaring) this.kPhase += dt * 0.11;
    const along = Math.sin(this.kPhase) * 9, vel = Math.cos(this.kPhase) * 9 * 0.11;
    const kx = this.focus.x - rx * 23 + tx0 * along, kz = this.focus.z - rz * 23 + tz0 * along;
    const ky = Math.max(0, this.heightAt(kx, kz)) - 0.05;
    this.kessinPos.set(kx, ky, kz);
    const scale = 2.0;
    // cap : dans le sens de la marche, ou face à la scène pour rugir
    const faceScene = Math.atan2(this.focus.x - kx, this.focus.z - kz);
    const walkYaw = Math.atan2(tx0 * Math.sign(vel), tz0 * Math.sign(vel));
    let target = roaring || Math.abs(vel) < 0.25 ? faceScene : walkYaw;
    let dy = target - this.kYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.kYaw += dy * Math.min(1, dt * 2.5);
    const walking = !roaring && Math.abs(vel) > 0.25;
    this.kessin.begin();
    const kj = this.kessin.push(kx, ky, kz, this.kYaw, scale, 0, walking ? 2.4 : 0, 0, 0);
    // rugissement : il se cambre en arrière puis se penche en avant, bras immobiles (le trident ne bouge pas)
    const lean = roaring ? Math.sin(Math.min(1, rt / 1.8) * Math.PI) * 0.55 : 0;
    this.kessin.setPose(kj, 0, lean, 0, 1);
    this.kessin.end();
    if (roaring && rt > 0.35) {
      // gueule : en haut du modèle, un peu en avant dans la direction du regard
      const fwx = Math.sin(this.kYaw), fwz = Math.cos(this.kYaw);
      const mx = kx + fwx * scale * 0.45, my = ky + this.kMouth * scale, mz = kz + fwz * scale * 0.45;
      // souffle de feu
      for (let n = 0; n < 3; n++) fx.glow.spawn(mx, my, mz, fwx * 9 + (Math.random() - 0.5) * 2, -1.5 + Math.random() * 2, fwz * 9 + (Math.random() - 0.5) * 2, 0.5, 0.35, n ? 0xff6f00 : 0xffd54f, 0);
      if (rt - dt < 0.35) {
        fx.flashes.flash(mx, my, mz, 0xff5a00, 12, 1.2, 20);
        // une boule de feu s'abat sur le chemin, loin devant Samuel
        this.path.at(this.path.length * (0.15 + Math.random() * 0.25), 0, this.tmp);
        const tx = this.tmp.x + (Math.random() - 0.5) * 3, tz = this.tmp.z + (Math.random() - 0.5) * 3;
        fx.addShot({ kind: 11, sx: mx, sy: my, sz: mz, tx, ty: 0, tz, targetId: 0xffff, t0: tick, dur: 28, arc: 3, x: mx, y: my, z: mz });
        setTimeout(() => {
          fx.burst(tx, 0.3, tz, 26, 0xff6f00, 6, 0.28, 0.8, true, -4);
          fx.debris(tx, tz, 8, 0x4e342e, 6);
          fx.shockwave(tx, tz, 2.6, 0xffab40, 0x7a5a3a, 0.5);
          fx.decals.add(tx, tz, 1.6, Decal.Scorch, 5, 0xff5a00);
          fx.smoke(tx, 0.5, tz, 6, 0x3d3d3d, 1.2);
          fx.flashes.flash(tx, 2, tz, 0xff9a3c, 10, 0.4, 10);
          for (const f of this.foes) if ((f.x - tx) ** 2 + (f.z - tz) ** 2 < 5) this.damage(f, 9);
        }, (28 / TICK) * 1000);
      }
    }

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

    // ------------------------------------------------ caméra : lente orbite autour de la scène
    const a = t * 0.05;
    const cam = this.r.camera;
    const f = this.focus;
    const place = () => {
      cam.position.set(f.x + Math.sin(a) * 13, 5.2 + Math.sin(t * 0.2) * 0.5, f.z + Math.cos(a) * 13);
      cam.lookAt(f.x - Math.sin(a) * 5, f.y + 1.6, f.z - Math.cos(a) * 5);
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
