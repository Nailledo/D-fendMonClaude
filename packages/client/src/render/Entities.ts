import * as THREE from 'three';
import {
  EF_BURROWED, EF_DOT, EF_ENRAGED, EF_FIGHTING, EF_SHIELDED, EF_SLOWED, EF_STUNNED, ENEMIES, HERO_IDS, HERO_UNIT,
  PLAYER_COLORS, UF_BUFF, UF_DEAD, UF_FIGHTING, UF_SHIELD, type RuntimeMap, type Snapshot,
} from '@dfend/shared';
import { enemyGeometry } from '../art/enemies';
import { K, geoFor, model } from '../art/models';
import { towerModel } from '../art/towers';
import { heroGeometry, soldierGeometry } from '../art/units';
import { HERO_STYLE, heroWeapon } from '../art/weapons';
import type { Frame } from '../game/Interp';
import { settings } from '../settings';
import { drape } from './drape';
import { GroundSpeed, stride } from './stride';
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
  /** arme tenue par chaque héros importé (null : art en code, l'arme fait partie du modèle) */
  private weaponPools: (InstPool | null)[] = [];
  private heroStyle: number[] = [];
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
  /** cible visée par un tir ou un sort (le tireur se tourne vers elle) : ennemi suivi, sinon point fixe */
  private aimId = new Uint16Array(N).fill(0xffff);
  private aimX = new Float32Array(N);
  private aimZ = new Float32Array(N);
  private aimUntil = new Float32Array(N);
  /** corps qui tombent : rendus avec l'animation de mort après la disparition de l'entité */
  private corpses: { pool: InstPool; weapon?: InstPool | null; style?: number; x: number; y: number; z: number; yaw: number; s: number; t0: number; team: number; dur: number }[] = [];
  private frameNo = 0;
  /** phase de marche et vitesse au sol mesurée, par ennemi et par unité */
  private ePhase = new Float32Array(N);
  private uPhase = new Float32Array(N);
  private eGround = new GroundSpeed(N);
  private uGround = new GroundSpeed(N);
  /** hauteur du canon de chaque tour (pour l'origine des tirs) */
  towerMuzzle = new Map<number, { x: number; y: number; z: number; fam: number; level: number; owner: number; slot: number }>();
  heroTypeByUnit = new Map<number, number>();
  /** joueur local : son héros reçoit un halo pour qu'on le repère d'un coup d'œil */
  you = -1;
  /** pendant une cinématique, les héros de la partie sont masqués (les acteurs prennent leur place) */
  hideHeroes = false;
  /** hauteur du terrain (pour poser les marques au sol sur le relief) */
  heightAt: ((x: number, z: number) => number) | null = null;
  /** bouches des galeries d'entrée : un ennemi encore dans la galerie (sous la colline) n'est pas dessiné */
  tunnels: { x: number; z: number; ox: number; oz: number }[] = [];
  /** champ de la caméra : les entités hors de l'écran (et de la portée de leur ombre) ne sont pas dessinées */
  readonly frustum = new THREE.Frustum();
  cullOn = false;
  private sphere = new THREE.Sphere();
  private inView(x: number, y: number, z: number, r: number) {
    if (!this.cullOn) return true;
    this.sphere.center.set(x, y, z);
    this.sphere.radius = r;
    return this.frustum.intersectsSphere(this.sphere);
  }
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
    this.glowHalo = new THREE.MeshBasicMaterial({ map: tex, opacity: 0.4, ...additive });
    this.glowRing = new THREE.MeshBasicMaterial({ opacity: 0.9, side: THREE.DoubleSide, ...additive });
    // géométries horizontales et subdivisées : elles épousent le relief (voir placeGlow)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2, 8, 8).rotateX(-Math.PI / 2), this.glowHalo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 48).rotateX(-Math.PI / 2), this.glowRing);
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
    for (const h of HERO_IDS) {
      this.heroPools.push(pool(K.hero(h), () => heroGeometry(h), 4));
      // modèle importé : on lui met son arme en main et son animation de combat
      const m = model(K.hero(h));
      const wg = m ? heroWeapon(h, m.geo) : null;
      this.weaponPools.push(wg ? new InstPool(wg, 4, this.group, settings.shadows) : null);
      this.heroStyle.push(wg ? HERO_STYLE[h] ?? 0 : 0);
    }
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
    this.glowRing.opacity = 0.25 + 0.2 * pulse;
    this.glow.children[1].scale.setScalar(1 + 0.08 * pulse);
    this.glow.position.set(x, 0, z);
    this.glow.visible = true;
    if (this.heightAt) for (const m of this.glow.children) drape(m as THREE.Mesh, this.heightAt, m === this.glow.children[1] ? 0.06 : 0.04);
  }

  /** Un tireur (unité ou héros) vise : il se tourne vers l'ennemi `target` (ou le point x, z) pendant `dur` secondes. */
  aim(unitId: number, target: number, x: number, z: number, time: number, dur = 1.2) {
    this.aimId[unitId] = target;
    this.aimX[unitId] = x;
    this.aimZ[unitId] = z;
    this.aimUntil[unitId] = time + dur;
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

  /** dans la galerie, au-delà de son fond sombre (l'ennemi en sort comme de l'obscurité) */
  private inTunnel(x: number, z: number) {
    for (const t of this.tunnels) {
      const dx = x - t.x, dz = z - t.z;
      const a = dx * t.ox + dz * t.oz;
      if (a > 2.5 && Math.abs(dx * t.oz - dz * t.ox) < 4 + a * 0.5) return true;
    }
    return false;
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
      // volants : petit rebond du corps au rythme des battements
      if (def.flying) y += Math.sin(time * 7 + id * 1.37 * 3.1) * 0.06 * def.size;
      if (burrowed) y = -0.55 * def.size;
      const flash = Math.max(0, 1 - (time - this.hitTime[id]) / 0.12) * 0.7;
      // cadence des pas = vitesse réellement parcourue (ralentis, arrêts, reprises sans à-coup)
      const v = this.eGround.measure(id, f.eX[i], f.eZ[i], dt, this.frameNo, def.speed * 3);
      const base = (def.speed * 4.5) / Math.max(0.6, def.size);
      const cadence = stunned ? 0 : def.flying || fighting ? base : (v * 4.5) / Math.max(0.6, def.size);
      this.ePhase[id] = stride(this.ePhase[id], cadence, dt);
      const speed = this.ePhase[id];
      if (!this.inView(f.eX[i], y + def.size * 0.7, f.eZ[i], def.size * 1.6 + 2)) continue;
      if (this.inTunnel(f.eX[i], f.eZ[i])) continue;
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
    for (const p of this.weaponPools) p?.begin();
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
          const ht = this.heroTypeByUnit.get(id) ?? 0;
          const pool = hero ? this.heroPools[ht] : this.soldierPools[kind] ?? this.soldierPools[0];
          this.corpses.push({ pool, weapon: hero ? this.weaponPools[ht] : null, style: hero ? this.heroStyle[ht] : 0, x: f.uX[i], y: 0, z: f.uZ[i], yaw: this.uYaw[id], s: hero ? 1.25 : kind === 7 ? 1.1 : 1, t0: time, team: PLAYER_COLORS[f.uOwner[i]] ?? 0xffffff, dur: hero ? 1.2 : 0.9 });
        }
        continue;
      }
      if (this.uDead[id] || !this.uKnown[id]) { this.uDead[id] = 0; this.uKnown[id] = 1; this.uBorn[id] = time; }
      if (this.hideHeroes && kind === HERO_UNIT) { this.uBorn[id] = time; continue; }
      let yawT = this.uYaw[id];
      const tg = f.uTarget[i];
      const ti = tg !== 0xffff ? f.enemyIdx(tg) : -1;
      const walking = f.uDx[i] * f.uDx[i] + f.uDz[i] * f.uDz[i] > 0.0004;
      let turn = k;
      if (ti >= 0) { yawT = Math.atan2(f.eX[ti] - f.uX[i], f.eZ[ti] - f.uZ[i]); turn = Math.min(1, dt * 14); }
      else if (time < this.aimUntil[id] && !walking) {
        // tir ou sort : face à la cible (suivie tant qu'elle vit), sinon vers le point visé
        const ai = this.aimId[id] !== 0xffff ? f.enemyIdx(this.aimId[id]) : -1;
        if (ai >= 0) { this.aimX[id] = f.eX[ai]; this.aimZ[id] = f.eZ[ai]; }
        const ax = this.aimX[id] - f.uX[i], az = this.aimZ[id] - f.uZ[i];
        if (ax * ax + az * az > 0.01) yawT = Math.atan2(ax, az);
        turn = Math.min(1, dt * 16);
      } else if (walking) yawT = Math.atan2(f.uDx[i], f.uDz[i]);
      const prevYaw = this.uYaw[id];
      this.uYaw[id] = lerpAngle(this.uYaw[id], yawT, turn);
      let dyw = this.uYaw[id] - prevYaw;
      if (dyw > Math.PI) dyw -= Math.PI * 2; else if (dyw < -Math.PI) dyw += Math.PI * 2;
      const rollT = Math.max(-0.18, Math.min(0.18, (-dyw / Math.max(dt, 1e-3)) * 0.08));
      this.uRoll[id] += (rollT - this.uRoll[id]) * Math.min(1, dt * 6);
      const moving = walking;
      const uv = this.uGround.measure(id, f.uX[i], f.uZ[i], dt, this.frameNo, 12);
      const fighting = (flags & UF_FIGHTING) !== 0;
      const flash = Math.max(0, 1 - (time - this.hitTime[id]) / 0.12) * 0.5;
      const team = PLAYER_COLORS[f.uOwner[i]] ?? 0xffffff;
      let pool: InstPool;
      let weapon: InstPool | null = null;
      let style = 0;
      let scale = 1;
      if (kind === HERO_UNIT) {
        const ht = this.heroTypeByUnit.get(id) ?? 0;
        pool = this.heroPools[ht];
        weapon = this.weaponPools[ht];
        style = this.heroStyle[ht];
        scale = 1.25;
        if (f.uOwner[i] === this.you) this.placeGlow(f.uX[i], f.uZ[i], team, time);
      } else {
        pool = this.soldierPools[kind] ?? this.soldierPools[0];
        if (kind === 7) scale = 1.1;
      }
      if (!this.inView(f.uX[i], 0.8, f.uZ[i], 3.5)) continue;
      const mode = (fighting ? 1 : 0) + style * 2;
      const uhit = Math.max(0, 1 - (time - this.hitTime[id]) / 0.22);
      let cast: number;
      if (style) {
        // héros armés : 0..1 = tir (l'arc reste en joue plus longtemps), 1..2 = sort
        const castDur = style === 3 ? 0.7 : 0.6, fireDur = style === 2 ? 1.2 : style === 4 ? 0.55 : 0.35;
        const ct = time - this.castTime[id], ft = time - this.uFireTime[id];
        cast = ct < castDur ? 1 + Math.max(0.001, ct / castDur) : ft < fireDur ? Math.max(0.001, ft / fireDur) : 0;
      } else cast = time - this.castTime[id] < 0.6 ? (time - this.castTime[id]) / 0.6 : time - this.uFireTime[id] < 0.35 ? (time - this.uFireTime[id]) / 0.35 : 0;
      const life = Math.min(1, Math.max(0.001, (time - this.uBorn[id]) / 0.4));
      // pas au rythme de la vitesse mesurée ; en combat, piétinement régulier
      this.uPhase[id] = stride(this.uPhase[id], fighting ? 9 : moving || uv > 0.3 ? Math.max(5, (uv * 3.6) / scale) : 0, dt);
      for (const p of weapon ? [pool, weapon] : [pool]) {
        const j = p.push(f.uX[i], 0, f.uZ[i], this.uYaw[id], scale, id * 0.71, this.uPhase[id], flash, mode);
        p.setTeam(j, team);
        p.setPose(j, cast, uhit, this.uRoll[id], life);
        if (flags & UF_SHIELD) p.setTint(j, 1, 0.95, 0.6, 0.3);
        else if (flags & UF_BUFF) p.setTint(j, 1, 0.7, 0.3, 0.2);
      }
      if (kind === HERO_UNIT || f.uHp[i] < 0.999) this.hpBar(f.uX[i], 1.75 * scale, f.uZ[i], f.uHp[i], kind === HERO_UNIT ? 1.1 : 0.7);
    }
    // ------------------------------------------------ corps (animation de mort)
    let w = 0;
    for (const c of this.corpses) {
      const p = (time - c.t0) / c.dur;
      if (p >= 1) continue;
      this.corpses[w++] = c;
      if (!this.inView(c.x, c.y + 0.6, c.z, c.s * 1.6 + 2)) continue;
      // les volants tombent au sol avant de basculer
      const y = c.y > 0.05 ? c.y * Math.max(0, 1 - (p / 0.4) ** 2) : 0;
      for (const pool of c.weapon ? [c.pool, c.weapon] : [c.pool]) {
        const j = pool.push(c.x, y, c.z, c.yaw, c.s, 0, 0, p < 0.08 ? 0.6 : 0, (c.style ?? 0) * 2);
        pool.setTeam(j, c.team);
        pool.setPose(j, 0, 0, 0, -Math.max(0.001, p));
      }
    }
    this.corpses.length = w;
    for (const p of this.enemyPools) p.end();
    for (const p of this.soldierPools) p.end();
    for (const p of this.heroPools) p.end();
    for (const p of this.weaponPools) p?.end();

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
      if (!this.inView(slot.x, 2, slot.z, 6)) {
        this.towerMuzzle.set(id, { x: slot.x, y: model.muzzleY, z: slot.z, fam, level, owner: snap.tOwner[i], slot: snap.tSlot[i] });
        continue;
      }
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
