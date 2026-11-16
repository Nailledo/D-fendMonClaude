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
  private frameNo = 0;
  /** hauteur du canon de chaque tour (pour l'origine des tirs) */
  towerMuzzle = new Map<number, { x: number; y: number; z: number; fam: number; level: number; owner: number; slot: number }>();
  heroTypeByUnit = new Map<number, number>();

  constructor(scene: THREE.Scene, private map: RuntimeMap) {
    scene.add(this.group);
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
      const target = Math.atan2(f.eDx[i], f.eDz[i]);
      const fresh = this.eSeen[id] !== this.frameNo - 1;
      this.eSeen[id] = this.frameNo;
      this.eYaw[id] = fresh ? target : lerpAngle(this.eYaw[id], target, k);
      const burrowed = (flags & EF_BURROWED) !== 0;
      const stunned = (flags & EF_STUNNED) !== 0;
      const fighting = (flags & EF_FIGHTING) !== 0;
      let y = f.eY[i];
      if (burrowed) y = -0.55 * def.size;
      const flash = Math.max(0, 1 - (time - this.hitTime[id]) / 0.12) * 0.7;
      const speed = stunned ? 0 : def.speed * 4.5 / Math.max(0.6, def.size);
      const pool = this.enemyPools[f.eType[i]];
      const j = pool.push(f.eX[i], y, f.eZ[i], this.eYaw[id], def.size, id * 1.37, speed, flash, fighting ? 1 : 0);
      if (stunned) pool.setTint(j, 0.6, 0.85, 1, 0.45);
      else if (flags & EF_SLOWED) pool.setTint(j, 0.45, 0.75, 1, 0.35);
      else if (flags & EF_DOT) pool.setTint(j, 1, 0.55, 0.15, 0.25);
      else if (flags & EF_ENRAGED) pool.setTint(j, 1, 0.15, 0.1, 0.3);
      else if (flags & EF_SHIELDED) pool.setTint(j, 1, 0.9, 0.5, 0.18);
      if (!burrowed && (f.eHp[i] < 0.999 || def.boss)) this.hpBar(f.eX[i], y + def.size * 1.45 + 0.35, f.eZ[i], f.eHp[i], def.boss ? 2.2 : 0.9);
    }
    for (const p of this.enemyPools) p.end();

    // ------------------------------------------------ unités et héros
    for (const p of this.soldierPools) p.begin();
    for (const p of this.heroPools) p.begin();
    for (let i = 0; i < f.uN; i++) {
      const flags = f.uFlags[i];
      if (flags & UF_DEAD) continue;
      const id = f.uId[i];
      const kind = f.uKind[i];
      let yawT = this.uYaw[id];
      const tg = f.uTarget[i];
      const ti = tg !== 0xffff ? f.enemyIdx(tg) : -1;
      if (ti >= 0) yawT = Math.atan2(f.eX[ti] - f.uX[i], f.eZ[ti] - f.uZ[i]);
      else if (f.uDx[i] * f.uDx[i] + f.uDz[i] * f.uDz[i] > 0.0004) yawT = Math.atan2(f.uDx[i], f.uDz[i]);
      this.uYaw[id] = lerpAngle(this.uYaw[id], yawT, k);
      const moving = f.uDx[i] * f.uDx[i] + f.uDz[i] * f.uDz[i] > 0.0004;
      const fighting = (flags & UF_FIGHTING) !== 0;
      const flash = Math.max(0, 1 - (time - this.hitTime[id]) / 0.12) * 0.5;
      const team = PLAYER_COLORS[f.uOwner[i]] ?? 0xffffff;
      let pool: InstPool;
      let scale = 1;
      if (kind === HERO_UNIT) {
        pool = this.heroPools[this.heroTypeByUnit.get(id) ?? 0];
        scale = 1.25;
      } else {
        pool = this.soldierPools[kind] ?? this.soldierPools[0];
        if (kind === 7) scale = 1.1;
      }
      const j = pool.push(f.uX[i], 0, f.uZ[i], this.uYaw[id], scale, id * 0.71, moving || fighting ? 9 : 0, flash, fighting ? 1 : 0);
      pool.setTeam(j, team);
      if (flags & UF_SHIELD) pool.setTint(j, 1, 0.95, 0.6, 0.3);
      else if (flags & UF_BUFF) pool.setTint(j, 1, 0.7, 0.3, 0.2);
      if (kind === HERO_UNIT || f.uHp[i] < 0.999) this.hpBar(f.uX[i], 1.75 * scale, f.uZ[i], f.uHp[i], kind === HERO_UNIT ? 1.1 : 0.7);
    }
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
      if (stunned) base.setTint(b, 0.55, 0.7, 0.55, 0.45);
      if (model.turret) {
        const aim = snap.tAim[i];
        const ai = aim !== 0xffff ? f.enemyIdx(aim) : -1;
        if (ai >= 0) this.tYaw[id] = lerpAngle(this.tYaw[id], Math.atan2(f.eX[ai] - slot.x, f.eZ[ai] - slot.z), Math.min(1, dt * 8));
        const top = this.towerPool(this.towerTop, key, model.turret);
        const t = top.push(slot.x, model.turretY * pop, slot.z, this.tYaw[id], pop, id, 0, 0, 0);
        top.setTeam(t, team);
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
