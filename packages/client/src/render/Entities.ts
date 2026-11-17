import * as THREE from 'three';
import {
  EF_BURROWED, EF_DOT, EF_ENRAGED, EF_FIGHTING, EF_SHIELDED, EF_SLOWED, EF_STUNNED, ENEMIES, HERO_IDS, HERO_UNIT,
  PLAYER_COLORS, UF_BUFF, UF_DEAD, UF_FIGHTING, UF_SHIELD, type RuntimeMap, type Snapshot,
} from '@dfend/shared';
import { enemyGeometry } from '../art/enemies';
import { K, geoFor, model } from '../art/models';
import { towerModel } from '../art/towers';
import { heroGeometry, soldierGeometry } from '../art/units';
import type { Frame } from '../game/Interp';
import { settings } from '../settings';
import { InstPool } from './InstPool';
import { hpBarMaterial } from './materials';

const N = 65536;

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export class Entities {
  readonly group = new THREE.Group();
  private enemyPools: InstPool[] = [];
  private soldierPools: InstPool[] = [];
  private heroPools: InstPool[] = [];
  private towerBase = new Map<number, InstPool>();
  private towerTop = new Map<number, InstPool>();
  private hp: THREE.InstancedMesh;
  private hpAttr: THREE.InstancedBufferAttribute;
  private hpN = 0;
  private eYaw = new Float32Array(N);
  private eSeen = new Uint32Array(N);
  private uYaw = new Float32Array(N);
  private tYaw = new Float32Array(N);
  private tBorn = new Map<number, number>();
  hitTime = new Float32Array(N);
  /** dernier tir / geste (ennemis, unités) et dernier tir des tours */
  fireTime = new Float32Array(N);
  uFireTime = new Float32Array(N);
  castTime = new Float32Array(N);
  towerFire = new Map<number, number>();
  private eBorn = new Float32Array(N);
  private eKnown = new Uint8Array(N);
  private eDeadAt = new Float32Array(N).fill(-99);
  private eRoll = new Float32Array(N);
  private uBorn = new Float32Array(N);
  private uKnown = new Uint8Array(N);
  private uDead = new Uint8Array(N);
  private uRoll = new Float32Array(N);
  /** corps qui tombent : rendus avec l'animation de mort après la disparition de l'entité */
  private corpses: { pool: InstPool; x: number; y: number; z: number; yaw: number; s: number; t0: number; team: number; dur: number }[] = [];
  private frameNo = 0;
  /** hauteur du canon de chaque tour (pour l'origine des tirs) */
  towerMuzzle = new Map<number, { x: number; y: number; z: number; fam: number; level: number; owner: number; slot: number }>();
  heroTypeByUnit = new Map<number, number>();
  /** joueur local : son héros reçoit un halo pour qu'on le repère d'un coup d'œil */
  you = -1;
  /** pendant une cinématique, les héros de la partie sont masqués (les acteurs prennent leur place) */
  hideHeroes = false;
  private glow: THREE.Group;
  private glowHalo: THREE.MeshBasicMaterial;
  private glowRing: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, private map: RuntimeMap) {
    scene.add(this.group);
    // halo au sol sous le héros du joueur : tache lumineuse douce + anneau fin qui respire
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cx = c.getContext('2d')!;
    const grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grd;
    cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
    this.glowHalo = new THREE.MeshBasicMaterial({ map: tex, opacity: 1, ...additive });
    this.glowRing = new THREE.MeshBasicMaterial({ opacity: 0.9, side: THREE.DoubleSide, ...additive });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), this.glowHalo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 48), this.glowRing);
    halo.rotation.x = ring.rotation.x = -Math.PI / 2;
    halo.position.y = 0.04;
    ring.position.y = 0.05;
    halo.renderOrder = ring.renderOrder = 2;
    this.glow = new THREE.Group();
    this.glow.add(halo, ring);
    this.glow.visible = false;
    this.group.add(this.glow);
    // modèles importés (GLB cuits) quand ils existent, sinon art construit en code
    const pool = (key: string, fb: () => THREE.BufferGeometry, cap: number) => {
      const g = geoFor(key, fb);
      return new InstPool(g.geo, cap, this.group, settings.shadows, g.map);
    };
    ENEMIES.forEach((d) => this.enemyPools.push(pool(K.enemy(d.id), () => enemyGeometry(d.id), d.boss ? 2 : 48)));
    for (let k = 0; k < 8; k++) this.soldierPools.push(pool(K.soldier(k), () => soldierGeometry(k), 24));
    for (const h of HERO_IDS) this.heroPools.push(pool(K.hero(h), () => heroGeometry(h), 4));
    const g = new THREE.PlaneGeometry(1, 1);
    this.hp = new THREE.InstancedMesh(g, hpBarMaterial(), 1024);
    this.hpAttr = new THREE.InstancedBufferAttribute(new Float32Array(1024 * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iHp', this.hpAttr);
    this.hp.frustumCulled = false;
    this.hp.renderOrder = 10;
    this.hp.count = 0;
    this.group.add(this.hp);
  }

  private towerPool(map: Map<number, InstPool>, key: number, geo: THREE.BufferGeometry, tex: THREE.Texture | null = null) {
    let p = map.get(key);
    if (!p) {
      p = new InstPool(geo, 8, this.group, settings.shadows, tex);
      map.set(key, p);
    }
    return p;
  }

  private towerViews = new Map<number, { base: THREE.BufferGeometry; map: THREE.Texture | null; turret: THREE.BufferGeometry | null; turretY: number; muzzleY: number }>();
  /** Modèle d'une tour : GLB importé (statique, sans tourelle) ou art en code (socle + tourelle orientable). */
  private towerView(fam: number, level: number) {
    const key = fam * 10 + level;
    let v = this.towerViews.get(key);
    if (!v) {
      const m = model(K.tower(fam, level));
      if (m) v = { base: m.geo, map: m.map, turret: null, turretY: 0, muzzleY: m.meta.muzzleY ?? m.meta.height * 0.8 };
      else {
        const t = towerModel(fam, level);
        v = { base: t.base, map: null, turret: t.turret, turretY: t.turretY, muzzleY: t.muzzleY };
      }
      this.towerViews.set(key, v);
    }
    return v;
  }

  private hpBar(x: number, y: number, z: number, frac: number, width: number) {
    if (this.hpN >= 1024) return;
    const i = this.hpN++;
    const m = this.hp.instanceMatrix.array as Float32Array;
    const o = i * 16;
    m[o] = 1; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = 1; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = 1; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    const a = this.hpAttr.array as Float32Array;
    a[i * 2] = frac;
    a[i * 2 + 1] = width;
  }

  private placeGlow(x: number, z: number, team: number, time: number) {
    const col = new THREE.Color(team).lerp(new THREE.Color(0xffffff), 0.2);
    this.glowHalo.color.copy(col);
    this.glowRing.color.copy(col);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    this.glowRing.opacity = 0.55 + 0.4 * pulse;
    this.glow.children[1].scale.setScalar(1 + 0.08 * pulse);
    this.glow.position.set(x, 0, z);
    this.glow.visible = true;
  }

  /** Mort d'un ennemi (événement) : son corps bascule et s'enfonce au lieu de disparaître. */
  killEnemy(id: number, type: number, x: number, z: number, y: number, time: number) {
    const def = ENEMIES[type];
    const pool = this.enemyPools[type];
    if (!def || !pool) return;
    this.eDeadAt[id] = time;
    this.eKnown[id] = 0;
    this.corpses.push({ pool, x, y, z, yaw: this.eYaw[id], s: def.size, t0: time, team: 0xffffff, dur: def.boss ? 1.6 : 0.85 });
  }

  update(f: Frame, snap: Snapshot, dt: number, time: number, hoverSlot: number, selectedTower: number) {
    this.frameNo++;
    const k = Math.min(1, dt * 10);
    this.hpN = 0;
    // ------------------------------------------------ ennemis
    for (const p of this.enemyPools) p.begin();
    for (let i = 0; i < f.eN; i++) {
      const id = f.eId[i];
      const def = ENEMIES[f.eType[i]];
      if (!def) continue;
      const flags = f.eFlags[i];
      // mort déjà jouée par un corps : on ne redessine pas l'ennemi pendant le retard d'interpolation
      if (time - this.eDeadAt[id] < 1.2) continue;
      const target = Math.atan2(f.eDx[i], f.eDz[i]);
      const fresh = this.eSeen[id] !== this.frameNo - 1;
      this.eSeen[id] = this.frameNo;
      if (!this.eKnown[id]) { this.eKnown[id] = 1; this.eBorn[id] = time; }
      const prevYaw = this.eYaw[id];
      this.eYaw[id] = fresh ? target : lerpAngle(this.eYaw[id], target, k);
      // roulis : on se penche dans les virages (fort pour les volants)
      let dy = this.eYaw[id] - prevYaw;
      if (dy > Math.PI) dy -= Math.PI * 2; else if (dy < -Math.PI) dy += Math.PI * 2;
      const rollMax = def.flying ? 0.55 : 0.2;
      const rollT = fresh ? 0 : Math.max(-rollMax, Math.min(rollMax, (-dy / Math.max(dt, 1e-3)) * (def.flying ? 0.35 : 0.1)));
      this.eRoll[id] += (rollT - this.eRoll[id]) * Math.min(1, dt * 6);
      const burrowed = (flags & EF_BURROWED) !== 0;
      const stunned = (flags & EF_STUNNED) !== 0;
      const fighting = (flags & EF_FIGHTING) !== 0;
      let y = f.eY[i];
      if (burrowed) y = -0.55 * def.size;
      const flash = Math.max(0, 1 - (time - this.hitTime[id]) / 0.12) * 0.7;
      const speed = stunned ? 0 : def.speed * 4.5 / Math.max(0.6, def.size);
      const pool = this.enemyPools[f.eType[i]];
      const j = pool.push(f.eX[i], y, f.eZ[i], this.eYaw[id], def.size, id * 1.37, speed, flash, fighting ? 1 : 0);
      const hit = Math.max(0, 1 - (time - this.hitTime[id]) / 0.22);
      const gest = time - this.fireTime[id] < 0.45 ? (time - this.fireTime[id]) / 0.45 : 0;
      pool.setPose(j, gest, hit, this.eRoll[id], Math.min(1, Math.max(0.001, (time - this.eBorn[id]) / 0.45)));
      if (stunned) pool.setTint(j, 0.6, 0.85, 1, 0.45);
      else if (flags & EF_SLOWED) pool.setTint(j, 0.45, 0.75, 1, 0.35);
      else if (flags & EF_DOT) pool.setTint(j, 1, 0.55, 0.15, 0.25);
      else if (flags & EF_ENRAGED) pool.setTint(j, 1, 0.15, 0.1, 0.3);
      else if (flags & EF_SHIELDED) pool.setTint(j, 1, 0.9, 0.5, 0.18);
      if (!burrowed && (f.eHp[i] < 0.999 || def.boss)) this.hpBar(f.eX[i], y + def.size * 1.45 + 0.35, f.eZ[i], f.eHp[i], def.boss ? 2.2 : 0.9);
    }

    // ------------------------------------------------ unités et héros
    for (const p of this.soldierPools) p.begin();
    for (const p of this.heroPools) p.begin();
    this.glow.visible = false;
    for (let i = 0; i < f.uN; i++) {
      const flags = f.uFlags[i];
      const id = f.uId[i];
      const kind = f.uKind[i];
      if (flags & UF_DEAD) {
        // première image de la mort : le corps tombe
        if (!this.uDead[id] && this.uKnown[id]) {
          this.uDead[id] = 1;
          const hero = kind === HERO_UNIT;
          const pool = hero ? this.heroPools[this.heroTypeByUnit.get(id) ?? 0] : this.soldierPools[kind] ?? this.soldierPools[0];
          this.corpses.push({ pool, x: f.uX[i], y: 0, z: f.uZ[i], yaw: this.uYaw[id], s: hero ? 1.25 : kind === 7 ? 1.1 : 1, t0: time, team: PLAYER_COLORS[f.uOwner[i]] ?? 0xffffff, dur: hero ? 1.2 : 0.9 });
        }
        continue;
      }
      if (this.uDead[id] || !this.uKnown[id]) { this.uDead[id] = 0; this.uKnown[id] = 1; this.uBorn[id] = time; }
      if (this.hideHeroes && kind === HERO_UNIT) { this.uBorn[id] = time; continue; }
      let yawT = this.uYaw[id];
      const tg = f.uTarget[i];
      const ti = tg !== 0xffff ? f.enemyIdx(tg) : -1;
      if (ti >= 0) yawT = Math.atan2(f.eX[ti] - f.uX[i], f.eZ[ti] - f.uZ[i]);
      else if (f.uDx[i] * f.uDx[i] + f.uDz[i] * f.uDz[i] > 0.0004) yawT = Math.atan2(f.uDx[i], f.uDz[i]);
      const prevYaw = this.uYaw[id];
      this.uYaw[id] = lerpAngle(this.uYaw[id], yawT, k);
      let dyw = this.uYaw[id] - prevYaw;
      if (dyw > Math.PI) dyw -= Math.PI * 2; else if (dyw < -Math.PI) dyw += Math.PI * 2;
      const rollT = Math.max(-0.18, Math.min(0.18, (-dyw / Math.max(dt, 1e-3)) * 0.08));
      this.uRoll[id] += (rollT - this.uRoll[id]) * Math.min(1, dt * 6);
      const moving = f.uDx[i] * f.uDx[i] + f.uDz[i] * f.uDz[i] > 0.0004;
      const fighting = (flags & UF_FIGHTING) !== 0;
      const flash = Math.max(0, 1 - (time - this.hitTime[id]) / 0.12) * 0.5;
      const team = PLAYER_COLORS[f.uOwner[i]] ?? 0xffffff;
      let pool: InstPool;
      let scale = 1;
      if (kind === HERO_UNIT) {
        pool = this.heroPools[this.heroTypeByUnit.get(id) ?? 0];
        scale = 1.25;
        if (f.uOwner[i] === this.you) this.placeGlow(f.uX[i], f.uZ[i], team, time);
      } else {
        pool = this.soldierPools[kind] ?? this.soldierPools[0];
        if (kind === 7) scale = 1.1;
      }
      const j = pool.push(f.uX[i], 0, f.uZ[i], this.uYaw[id], scale, id * 0.71, moving || fighting ? 9 : 0, flash, fighting ? 1 : 0);
      pool.setTeam(j, team);
      const uhit = Math.max(0, 1 - (time - this.hitTime[id]) / 0.22);
      const cast = time - this.castTime[id] < 0.6 ? (time - this.castTime[id]) / 0.6 : time - this.uFireTime[id] < 0.35 ? (time - this.uFireTime[id]) / 0.35 : 0;
      pool.setPose(j, cast, uhit, this.uRoll[id], Math.min(1, Math.max(0.001, (time - this.uBorn[id]) / 0.4)));
      if (flags & UF_SHIELD) pool.setTint(j, 1, 0.95, 0.6, 0.3);
      else if (flags & UF_BUFF) pool.setTint(j, 1, 0.7, 0.3, 0.2);
      if (kind === HERO_UNIT || f.uHp[i] < 0.999) this.hpBar(f.uX[i], 1.75 * scale, f.uZ[i], f.uHp[i], kind === HERO_UNIT ? 1.1 : 0.7);
    }
    // ------------------------------------------------ corps (animation de mort)
    let w = 0;
    for (const c of this.corpses) {
      const p = (time - c.t0) / c.dur;
      if (p >= 1) continue;
      this.corpses[w++] = c;
      // les volants tombent au sol avant de basculer
      const y = c.y > 0.05 ? c.y * Math.max(0, 1 - (p / 0.4) ** 2) : 0;
      const j = c.pool.push(c.x, y, c.z, c.yaw, c.s, 0, 0, p < 0.08 ? 0.6 : 0, 0);
      c.pool.setTeam(j, c.team);
      c.pool.setPose(j, 0, 0, 0, -Math.max(0.001, p));
    }
    this.corpses.length = w;
    for (const p of this.enemyPools) p.end();
    for (const p of this.soldierPools) p.end();
    for (const p of this.heroPools) p.end();

    // ------------------------------------------------ tours
    for (const p of this.towerBase.values()) p.begin();
    for (const p of this.towerTop.values()) p.begin();
    this.towerMuzzle.clear();
    for (let i = 0; i < snap.tCount; i++) {
      const id = snap.tId[i];
      const slot = this.map.slots[snap.tSlot[i]];
      if (!slot) continue;
      const fam = snap.tFam[i], level = snap.tLevel[i];
      const model = this.towerView(fam, level);
      const key = fam * 10 + level;
      let born = this.tBorn.get(id);
      if (born === undefined) { born = time; this.tBorn.set(id, born); }
      const age = time - born;
      const pop = age < 0.35 ? 0.6 + 0.4 * Math.sin((age / 0.35) * Math.PI * 0.5) + Math.sin((age / 0.35) * Math.PI) * 0.12 : 1;
      const team = PLAYER_COLORS[snap.tOwner[i]] ?? 0xffffff;
      const stunned = snap.tStun[i] > 0;
      const base = this.towerPool(this.towerBase, key, model.base, model.map);
      const b = base.push(slot.x, 0, slot.z, 0, pop, id * 0.9, 0, id === selectedTower ? 0.18 : 0, 0);
      base.setTeam(b, team);
      const ft = this.towerFire.get(id);
      const recoil = ft !== undefined && time - ft < 0.3 ? Math.max(0.001, (time - ft) / 0.3) : 0;
      if (recoil) base.setPose(b, recoil, 0, 0, 0);
      if (stunned) base.setTint(b, 0.55, 0.7, 0.55, 0.45);
      if (model.turret) {
        const aim = snap.tAim[i];
        const ai = aim !== 0xffff ? f.enemyIdx(aim) : -1;
        if (ai >= 0) this.tYaw[id] = lerpAngle(this.tYaw[id], Math.atan2(f.eX[ai] - slot.x, f.eZ[ai] - slot.z), Math.min(1, dt * 8));
        const top = this.towerPool(this.towerTop, key, model.turret);
        const t = top.push(slot.x, model.turretY * pop, slot.z, this.tYaw[id], pop, id, 0, 0, 0);
        top.setTeam(t, team);
        if (recoil) top.setPose(t, recoil, 0, 0, 0);
        if (stunned) top.setTint(t, 0.55, 0.7, 0.55, 0.45);
      }
      this.towerMuzzle.set(id, { x: slot.x, y: model.muzzleY, z: slot.z, fam, level, owner: snap.tOwner[i], slot: snap.tSlot[i] });
    }
    for (const p of this.towerBase.values()) p.end();
    for (const p of this.towerTop.values()) p.end();
    if (this.tBorn.size > 200) {
      const alive = new Set<number>();
      for (let i = 0; i < snap.tCount; i++) alive.add(snap.tId[i]);
      for (const id of this.tBorn.keys()) if (!alive.has(id)) this.tBorn.delete(id);
    }
    void hoverSlot;

    this.hp.count = this.hpN;
    this.hp.visible = this.hpN > 0;
    this.hp.instanceMatrix.needsUpdate = true;
    this.hpAttr.needsUpdate = true;
  }
}
