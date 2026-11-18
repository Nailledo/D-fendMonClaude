import * as THREE from 'three';
import {
  ET_FLEEING, ET_REVEALED, ET_REGROWING, EF_BURROWED, EF_DOT, EF_ENRAGED, EF_FIGHTING, EF_SHIELDED, EF_SLOWED, EF_STUNNED, ENEMIES, HERO_IDS, HERO_UNIT,
  PLAYER_COLORS, UF_BUFF, UF_DEAD, UF_FIGHTING, UF_SHIELD, type RuntimeMap, type Snapshot,
} from '@dfend/shared';
import { enemyGeometry, lootSackGeometry, stunStarsGeometry } from '../art/enemies';
import { ARM_RELEASE, ARM_THROW, armAngle, machineOf, rockLoaded, seatAt, type CatapultArm, type Machine, type Muzzle } from '../art/machines';
import { K, geoFor, model } from '../art/models';
import { towerModel } from '../art/towers';
import { heroGeometry, soldierGeometry, turretGeometry } from '../art/units';
import { DEFAULT_WEAPON, WEAPON_STYLE, heroWeapon } from '../art/weapons';
import type { Frame } from '../game/Interp';
import { settings } from '../settings';
import { drape } from './drape';
import { GroundSpeed, stride } from './stride';
import { GB } from '../art/builder';
import { InstPool, skinMul } from './InstPool';
import { hpBarMaterial } from './materials';

const N = 65536;

interface TowerView {
  base: THREE.BufferGeometry;
  map: THREE.Texture | null;
  /** tête orientable (art en code, ou tête d'une machine importée) */
  turret: THREE.BufferGeometry | null;
  turretY: number;
  muzzleY: number;
  /** machine importée : canons qui reculent, bras de catapulte */
  machine: Machine | null;
  /** bas de la tête importée (elle suit l'écrasement du socle au tir) */
  headMinY: number;
}

/** Point du repère d'un modèle (tourné de `yaw`, échelle `s`) → monde ; même convention que InstPool.push. */
function toWorld(m: Muzzle, x: number, z: number, yaw: number, s: number, out: { x: number; y: number; z: number }) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  out.x = x + (m.x * c + m.z * sn) * s;
  out.y = m.y * s;
  out.z = z + (-m.x * sn + m.z * c) * s;
  return out;
}

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
  /** arme de chaque apparence × style d'arme (classe) : index type * 5 + style */
  /** armes par apparence × arme (créées à la demande) */
  private weaponPools = new Map<number, InstPool | null>();
  private heroGeo: (THREE.BufferGeometry | null)[] = [];
  /** le modèle importé de l'apparence peut porter une arme (sinon pas d'animation de combat) */
  private heroArmed: boolean[] = [];
  /** tourelle de Matéo : socle fixe et tête orientable (pas d'animation de personnage) */
  private turretBase: InstPool;
  private turretHead: InstPool;
  /** sac d'or sur le dos des chapardeurs en fuite */
  private sacks: InstPool;
  /** étoiles au-dessus des ennemis étourdis */
  private stars: InstPool;
  private eTop: number[] = [];
  /** bouches des canons de la tourelle (repère du modèle, échelle comprise) ; les deux canons tirent à tour de rôle */
  private turretMuzzles: Muzzle[] = [{ x: 0, y: 0.8, z: 0.8 }];
  /** canon qui a tiré en dernier (1 droit, 2 gauche) par unité et par tour */
  private uBarrel = new Uint8Array(N);
  private tBarrel = new Map<number, number>();
  /** catapultes : angle du bras au début du lancer, rocher posé dans le godet */
  private armFrom = new Map<number, number>();
  private rocks: InstPool;
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
  /** compétences du héros : tour sur lui-même (tourbillon, lames) et bond suivi d'un coup au sol (marteau, séisme) */
  spinTime = new Float32Array(N).fill(-99);
  slamTime = new Float32Array(N).fill(-99);
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
  private corpses: { pool: InstPool; weapon?: InstPool | null; style?: number; x: number; y: number; z: number; yaw: number; s: number; t0: number; team: number; dur: number; skin?: number }[] = [];
  /** couleur de peau de chaque joueur (index de SKIN_TONES), appliquée à son héros */
  playerSkin = new Uint8Array(8);
  private frameNo = 0;
  /** phase de marche et vitesse au sol mesurée, par ennemi et par unité */
  private ePhase = new Float32Array(N);
  private uPhase = new Float32Array(N);
  private eGround = new GroundSpeed(N);
  private uGround = new GroundSpeed(N);
  /** hauteur du canon de chaque tour (pour l'origine des tirs) */
  towerMuzzle = new Map<number, { x: number; y: number; z: number; fam: number; level: number; owner: number; slot: number }>();
  heroTypeByUnit = new Map<number, number>();
  /** style d'arme (classe) de chaque héros : 1 épée, 2 arc, 3 marteau, 4 bâton */
  /** arme tenue par chaque héros (selon sa classe) */
  heroWeaponByUnit = new Map<number, number>();
  /** joueur local : son héros reçoit un halo pour qu'on le repère d'un coup d'œil */
  you = -1;
  /** pendant une cinématique, les héros de la partie sont masqués (les acteurs prennent leur place) */
  hideHeroes = false;
  /** hauteur du terrain (pour poser les marques au sol sur le relief) */
  heightAt: ((x: number, z: number) => number) | null = null;
  /** bouches des galeries d'entrée : un ennemi encore dans la galerie (sous la colline) n'est pas dessiné */
  tunnels: { x: number; z: number; ox: number; oz: number }[] = [];
  /** porte du château : les monstres qui la franchissent disparaissent à l'intérieur (et le château réagit) */
  castleGate: { x: number; z: number; dx: number; dz: number } | null = null;
  /** des monstres sont devant la porte (la herse se lève) */
  castleNear = false;
  /** monstres entrés depuis la dernière lecture */
  castleEntered = 0;
  private eIn = new Uint8Array(N);
  /** adversaire de chaque ennemi au corps à corps (image où il a été trouvé, position, héros ?, distance²) */
  private foeStamp = new Uint32Array(N);
  private foeX = new Float32Array(N);
  private foeZ = new Float32Array(N);
  private foeHero = new Uint8Array(N);
  private foeD2 = new Float32Array(N);
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
    const tm = model(K.soldier(7));
    const tg = turretGeometry(tm?.geo);
    this.turretBase = new InstPool(tg.base, 8, this.group, settings.shadows, tm?.map ?? null);
    this.turretHead = new InstPool(tg.head, 8, this.group, settings.shadows, tm?.map ?? null);
    this.sacks = new InstPool(lootSackGeometry(), 8, this.group, settings.shadows);
    this.stars = new InstPool(stunStarsGeometry(), 64, this.group, false);
    this.eTop = this.enemyPools.map((p) => p.top());
    // bouches des canons (modèle importé découpé), sinon avant de la tête à mi-hauteur
    const tmach = tm ? machineOf(tm.geo) : null;
    if (tmach?.muzzles.length) this.turretMuzzles = tmach.muzzles.map((m) => ({ x: m.x * 1.1, y: m.y * 1.1, z: m.z * 1.1 }));
    else {
      tg.head.computeBoundingBox();
      const hb = tg.head.boundingBox!;
      this.turretMuzzles = [{ x: 0, y: ((hb.min.y + hb.max.y) / 2) * 1.1, z: hb.max.z * 1.1 }];
    }
    const rock = new GB(17);
    rock.rock(1, 0x8a8178, 0, 0, 0, 1, 0.85, 1);
    this.rocks = new InstPool(rock.build(), 16, this.group, settings.shadows);
    for (const h of HERO_IDS) {
      this.heroPools.push(pool(K.hero(h), () => heroGeometry(h), 4));
      // modèle importé : on lui met son arme en main et son animation de combat
      const m = model(K.hero(h));
      this.heroArmed.push(!!m);
      this.heroGeo.push(m ? m.geo : null);
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

  /** Rocher posé dans le godet d'une catapulte (il suit le bras ; `load` < 1 : il tombe dans le godet au rechargement). */
  private rockInBucket(arm: CatapultArm, ang: number, x: number, y: number, z: number, yaw: number, s: number, load: number, id: number) {
    const m = toWorld(seatAt(arm, ang, this.tmpM), x, z, yaw, s, this.tmpW);
    const drop = (1 - load) * 0.5 * s;
    this.rocks.push(m.x, y + m.y + drop, m.z, id * 1.7 + ang, arm.rockR * s * (0.4 + 0.6 * load), 0, 0, 0, 0);
  }
  private tmpW = { x: 0, y: 0, z: 0 };

  private towerPool(map: Map<number, InstPool>, key: number, geo: THREE.BufferGeometry, tex: THREE.Texture | null = null) {
    let p = map.get(key);
    if (!p) {
      p = new InstPool(geo, 8, this.group, settings.shadows, tex);
      map.set(key, p);
    }
    return p;
  }

  /** orientation de chaque emplacement : la façade (+z du modèle) regarde le point de chemin le plus proche */
  private slotYaw = new Map<number, number>();
  yawOfSlot(si: number) {
    let y = this.slotYaw.get(si);
    if (y === undefined) {
      const s = this.map.slots[si];
      let best = Infinity;
      const pt = { x: 0, z: 0 };
      y = 0;
      for (const p of this.map.paths) {
        const pr = p.project(s.x, s.z);
        if (pr.dist2 < best) {
          best = pr.dist2;
          p.at(pr.d, 0, pt);
          y = Math.atan2(pt.x - s.x, pt.z - s.z);
        }
      }
      this.slotYaw.set(si, y);
    }
    return y;
  }

  private towerViews = new Map<number, TowerView>();
  /**
   * Modèle d'une tour : GLB importé (statique, ou découpé en socle + tête orientable quand c'est une machine)
   * ou art en code (socle + tourelle orientable).
   */
  private towerView(fam: number, level: number) {
    const key = fam * 10 + level;
    let v = this.towerViews.get(key);
    if (!v) {
      const m = model(K.tower(fam, level));
      if (m) {
        const mach = machineOf(m.geo);
        let headMinY = 0;
        if (mach) { mach.head.computeBoundingBox(); headMinY = mach.head.boundingBox!.min.y; }
        v = { base: mach?.base ?? m.geo, map: m.map, turret: mach?.head ?? null, turretY: 0, muzzleY: m.meta.muzzleY ?? m.meta.height * 0.8, machine: mach, headMinY };
      } else {
        const t = towerModel(fam, level);
        v = { base: t.base, map: null, turret: t.turret, turretY: t.turretY, muzzleY: t.muzzleY, machine: null, headMinY: 0 };
      }
      this.towerViews.set(key, v);
    }
    return v;
  }

  /**
   * Tir d'une tour (événement) : départ du lancer ou du recul, canon suivant pour un double canon.
   * Écrit dans `out` le point de départ du projectile (bouche du canon, godet au lâcher) ;
   * renvoie le délai (s) avant que le projectile ne parte (le temps que le bras de la catapulte bascule).
   */
  towerShot(id: number, tx: number, tz: number, time: number, out: { x: number; y: number; z: number }): number {
    const t = this.towerMuzzle.get(id);
    const prev = this.towerFire.get(id);
    const mach = t ? this.towerView(t.fam, t.level).machine : null;
    if (mach?.arm) this.armFrom.set(id, prev === undefined ? 0 : armAngle(time - prev, this.armFrom.get(id) ?? 0));
    this.towerFire.set(id, time);
    if (!t || !mach) return 0;
    const yaw = Math.atan2(tx - t.x, tz - t.z);
    if (mach.arm) {
      toWorld(seatAt(mach.arm, ARM_RELEASE, this.tmpM), t.x, t.z, yaw, 1, out);
      return ARM_THROW;
    }
    let k = 0;
    if (mach.muzzles.length > 1) k = this.tBarrel.get(id) === 1 ? 2 : 1;
    this.tBarrel.set(id, k);
    const m = mach.muzzles[k ? k - 1 : 0];
    if (m) toWorld(m, t.x, t.z, yaw, 1, out);
    return 0;
  }

  /** Tir de la tourelle de l'artificier : ses deux canons tirent à tour de rôle ; `out` = bouche du canon. */
  turretShot(id: number, x: number, z: number, tx: number, tz: number, out: { x: number; y: number; z: number }) {
    const ms = this.turretMuzzles;
    const k = ms.length > 1 ? (this.uBarrel[id] === 1 ? 2 : 1) : 0;
    this.uBarrel[id] = k;
    toWorld(ms[k ? k - 1 : 0], x, z, Math.atan2(tx - x, tz - z), 1, out);
  }
  private tmpM: Muzzle = { x: 0, y: 0, z: 0 };

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

  /** Arme `kind` en main de l'apparence `ht` (pool créé au premier besoin) ; null si le modèle n'en porte pas. */
  private weaponPool(ht: number, kind: number): InstPool | null {
    const key = ht * 16 + kind;
    let p = this.weaponPools.get(key);
    if (p === undefined) {
      const geo = this.heroArmed[ht] ? this.heroGeo[ht] : null;
      const wg = geo ? heroWeapon(HERO_IDS[ht], geo, kind) : null;
      p = wg ? new InstPool(wg, 4, this.group, settings.shadows) : null;
      this.weaponPools.set(key, p);
    }
    return p;
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
    // ------------------------------------------------ adversaires au corps à corps
    // la simulation n'envoie pas la cible d'un ennemi ; mais ses bloqueurs (soldats, héros) le visent :
    // chaque ennemi au combat se tourne vers celui qui le vise (un héros en priorité, sinon le plus proche)
    for (let i = 0; i < f.uN; i++) {
      const tg = f.uTarget[i];
      if (tg === 0xffff || f.uFlags[i] & UF_DEAD) continue;
      const ei = f.enemyIdx(tg);
      if (ei < 0) continue;
      const d2 = (f.uX[i] - f.eX[ei]) ** 2 + (f.uZ[i] - f.eZ[ei]) ** 2;
      // trop loin pour être au contact (héros qui accourt, archer qui vise sa cible de loin)
      if (d2 > 6.25) continue;
      const hero = f.uKind[i] === HERO_UNIT ? 1 : 0;
      if (this.foeStamp[tg] === this.frameNo && (this.foeHero[tg] > hero || (this.foeHero[tg] === hero && this.foeD2[tg] <= d2))) continue;
      this.foeStamp[tg] = this.frameNo;
      this.foeHero[tg] = hero;
      this.foeD2[tg] = d2;
      this.foeX[tg] = f.uX[i];
      this.foeZ[tg] = f.uZ[i];
    }
    // ------------------------------------------------ ennemis
    for (const p of this.enemyPools) p.begin();
    this.sacks.begin();
    this.stars.begin();
    this.castleNear = false;
    for (let i = 0; i < f.eN; i++) {
      const id = f.eId[i];
      const def = ENEMIES[f.eType[i]];
      if (!def) continue;
      const flags = f.eFlags[i];
      // mort déjà jouée par un corps : on ne redessine pas l'ennemi pendant le retard d'interpolation
      if (time - this.eDeadAt[id] < 1.2) continue;
      let target = Math.atan2(f.eDx[i], f.eDz[i]);
      let turn = k;
      if (flags & EF_FIGHTING) {
        // face à l'adversaire : celui qui le vise, sinon l'unité au combat la plus proche
        let fx = 0, fz = 0, ok = this.foeStamp[id] === this.frameNo;
        if (ok) { fx = this.foeX[id]; fz = this.foeZ[id]; }
        else {
          let best = (1.6 + def.size * 0.4) ** 2;
          for (let u = 0; u < f.uN; u++) {
            if (f.uFlags[u] & UF_DEAD) continue;
            const d2 = (f.uX[u] - f.eX[i]) ** 2 + (f.uZ[u] - f.eZ[i]) ** 2;
            if (d2 < best) { best = d2; fx = f.uX[u]; fz = f.uZ[u]; ok = true; }
          }
        }
        if (ok && (fx - f.eX[i]) ** 2 + (fz - f.eZ[i]) ** 2 > 0.01) { target = Math.atan2(fx - f.eX[i], fz - f.eZ[i]); turn = Math.min(1, dt * 12); }
      }
      const fresh = this.eSeen[id] !== this.frameNo - 1;
      this.eSeen[id] = this.frameNo;
      if (!this.eKnown[id]) { this.eKnown[id] = 1; this.eBorn[id] = time; }
      const prevYaw = this.eYaw[id];
      this.eYaw[id] = fresh ? target : lerpAngle(this.eYaw[id], target, turn);
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
      const cg = this.castleGate;
      if (cg) {
        if (fresh) this.eIn[id] = 0;
        const ox = f.eX[i] - cg.x, oz = f.eZ[i] - cg.z;
        const a = ox * cg.dx + oz * cg.dz;
        if (Math.abs(ox * -cg.dz + oz * cg.dx) < 3.5 && a > -3.5) {
          if (a < 1.2) this.castleNear = true;
          else {
            // dans le passage sombre de la porte : il entre dans le château
            if (!this.eIn[id]) { this.eIn[id] = 1; this.castleEntered++; }
            continue;
          }
        }
      }
      if (!this.inView(f.eX[i], y + def.size * 0.7, f.eZ[i], def.size * 1.6 + 2)) continue;
      if (this.inTunnel(f.eX[i], f.eZ[i])) continue;
      const pool = this.enemyPools[f.eType[i]];
      const j = pool.push(f.eX[i], y, f.eZ[i], this.eYaw[id], def.size, id * 1.37, speed, flash, fighting ? 1 : 0);
      const hit = Math.max(0, 1 - (time - this.hitTime[id]) / 0.22);
      const gest = time - this.fireTime[id] < 0.45 ? (time - this.fireTime[id]) / 0.45 : 0;
      pool.setPose(j, gest, hit, this.eRoll[id], Math.min(1, Math.max(0.001, (time - this.eBorn[id]) / 0.45)));
      const tr = f.eTraits[i];
      // camouflé non repéré : tramé (à moitié transparent), teinte de sous-bois
      const hidden = (tr & 1) !== 0 && !(tr & ET_REVEALED);
      if (stunned) {
        pool.setTint(j, 0.6, 0.85, 1, 0.45);
        // des étoiles tournent au-dessus de la tête, comme dans les dessins animés
        const sk = Math.sqrt(def.size);
        const st = this.stars.push(f.eX[i], y + this.eTop[f.eType[i]] * def.size + 0.12 * sk, f.eZ[i], 0, sk * 1.3, id * 0.7, 0, 0, 0);
        this.stars.setPose(st, 0, 0, 0, 1);
      }
      else if (flags & EF_SLOWED) pool.setTint(j, 0.45, 0.75, 1, 0.35);
      else if (flags & EF_DOT) pool.setTint(j, 1, 0.55, 0.15, 0.25);
      else if (flags & EF_ENRAGED) pool.setTint(j, 1, 0.15, 0.1, 0.3);
      else if (tr & ET_REGROWING) pool.setTint(j, 0.35, 1, 0.45, 0.22 + 0.16 * Math.sin(time * 9 + id));
      else if (tr & 2) pool.setTint(j, 0.52, 0.57, 0.68, 0.7);
      else if (tr & 1) pool.setTint(j, 0.45, 0.58, 0.36, 0.4);
      else if (flags & EF_SHIELDED) pool.setTint(j, 1, 0.9, 0.5, 0.18);
      else if (def.ab.thief) pool.setTint(j, 0.5, 0.36, 0.72, 0.38);
      if (tr & ET_FLEEING) {
        // butin sur le dos, et un éclat doré qui attire l'œil
        pool.setTint(j, 1, 0.8, 0.25, 0.25 + 0.15 * Math.sin(time * 10 + id));
        const sj = this.sacks.push(f.eX[i], y + Math.abs(Math.sin(this.ePhase[id] * Math.PI)) * 0.05, f.eZ[i], this.eYaw[id], def.size, 0, 0, 0, 0);
        this.sacks.setPose(sj, 0, hit, this.eRoll[id], 1);
      }
      if (hidden) {
        const o = j * 4;
        pool.setTint(j, 0.45, 0.58, 0.36, -Math.max(0.01, Math.abs(pool.tintAlpha(o))));
      }
      if (!burrowed && (f.eHp[i] < 0.999 || def.boss)) this.hpBar(f.eX[i], y + def.size * 1.45 + 0.35, f.eZ[i], f.eHp[i], def.boss ? 2.2 : 0.9);
    }

    // ------------------------------------------------ unités et héros
    for (const p of this.soldierPools) p.begin();
    for (const p of this.heroPools) p.begin();
    for (const p of this.weaponPools.values()) p?.begin();
    this.turretBase.begin();
    this.turretHead.begin();
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
          const wk = this.heroWeaponByUnit.get(id) ?? DEFAULT_WEAPON;
          const wp = hero ? this.weaponPool(ht, wk) : null;
          const pool = hero ? this.heroPools[ht] : this.soldierPools[kind] ?? this.soldierPools[0];
          this.corpses.push({ pool, weapon: wp, style: wp ? WEAPON_STYLE[wk] : 0, x: f.uX[i], y: 0, z: f.uZ[i], yaw: this.uYaw[id], s: hero ? 1.25 : kind === 7 ? 1.1 : 1, t0: time, team: PLAYER_COLORS[f.uOwner[i]] ?? 0xffffff, dur: hero ? 1.2 : 0.9, skin: hero ? this.playerSkin[f.uOwner[i]] : 0 });
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
        const wk = this.heroWeaponByUnit.get(id) ?? DEFAULT_WEAPON;
        pool = this.heroPools[ht];
        weapon = this.weaponPool(ht, wk);
        style = weapon ? WEAPON_STYLE[wk] : 0;
        scale = 1.25;
        if (f.uOwner[i] === this.you) this.placeGlow(f.uX[i], f.uZ[i], team, time);
      } else {
        pool = this.soldierPools[kind] ?? this.soldierPools[0];
        if (kind === 7) scale = 1.1;
      }
      if (!this.inView(f.uX[i], 0.8, f.uZ[i], 3.5)) continue;
      if (kind === 7) {
        // tourelle : surgit du sol, la tête pivote vers sa cible et recule à chaque tir
        const age = (time - this.uBorn[id]) / 0.35;
        const s = age < 1 ? scale * (0.6 + 0.4 * Math.sin(age * Math.PI * 0.5) + Math.sin(age * Math.PI) * 0.12) : scale;
        // tête d'un seul bloc posée sur son pivot : seul le canon qui tire recule (les deux tirent à tour de rôle)
        const ft = time - this.uFireTime[id];
        const recoil = ft < 0.45 ? Math.max(0.001, ft / 0.45) : 0;
        const b = this.turretBase.push(f.uX[i], 0, f.uZ[i], 0, s, id, 0, flash, 0);
        this.turretBase.setTeam(b, team);
        const h = this.turretHead.push(f.uX[i], 0, f.uZ[i], this.uYaw[id], s, id, 0, flash, 0);
        this.turretHead.setTeam(h, team);
        if (recoil) this.turretHead.setPose(h, recoil, this.uBarrel[id], 0, 0);
        if (f.uHp[i] < 0.999) this.hpBar(f.uX[i], 1.45, f.uZ[i], f.uHp[i], 0.7);
        continue;
      }
      const mode = (fighting ? 1 : 0) + style * 2;
      const uhit = Math.max(0, 1 - (time - this.hitTime[id]) / 0.22);
      let cast: number;
      if (style) {
        // héros armés : 0..1 = tir (l'arc reste en joue plus longtemps), 1..2 = sort
        const castDur = style === 3 ? 0.7 : 0.6, fireDur = style === 2 ? 1.2 : style === 4 || style === 5 ? 0.55 : style === 6 ? 0.5 : 0.35;
        const ct = time - this.castTime[id], ft = time - this.uFireTime[id];
        cast = ct < castDur ? 1 + Math.max(0.001, ct / castDur) : ft < fireDur ? Math.max(0.001, ft / fireDur) : 0;
      } else cast = time - this.castTime[id] < 0.6 ? (time - this.castTime[id]) / 0.6 : time - this.uFireTime[id] < 0.35 ? (time - this.uFireTime[id]) / 0.35 : 0;
      const life = Math.min(1, Math.max(0.001, (time - this.uBorn[id]) / 0.4));
      // pas au rythme de la vitesse mesurée ; en combat, piétinement régulier
      this.uPhase[id] = stride(this.uPhase[id], fighting ? 9 : moving || uv > 0.3 ? Math.max(5, (uv * 3.6) / scale) : 0, dt);
      const skin = kind === HERO_UNIT ? skinMul(this.playerSkin[f.uOwner[i]] ?? 0) : null;
      // mouvements de compétence : pirouette complète, ou bond puis retombée lourde
      let yawX = 0, hop = 0;
      if (kind === HERO_UNIT) {
        const sp = (time - this.spinTime[id]) / 0.55;
        if (sp >= 0 && sp < 1) yawX = (1 - (1 - sp) ** 3) * Math.PI * 2;
        const sl = (time - this.slamTime[id]) / 0.5;
        if (sl >= 0 && sl < 1) hop = sl < 0.6 ? Math.sin((sl / 0.6) * Math.PI * 0.5) * 0.7 : 0.7 * (1 - ((sl - 0.6) / 0.4) ** 2);
        if (hop > 0 && style) cast = 1 + Math.min(0.999, Math.max(0.001, sl));
      }
      for (const p of weapon ? [pool, weapon] : [pool]) {
        const j = p.push(f.uX[i], hop, f.uZ[i], this.uYaw[id] + yawX, scale, id * 0.71, this.uPhase[id], flash, mode);
        p.setTeam(j, team);
        if (skin) p.setSkin(j, skin);
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
        if (c.skin) pool.setSkin(j, skinMul(c.skin));
        pool.setPose(j, 0, 0, 0, -Math.max(0.001, p));
      }
    }
    this.corpses.length = w;
    for (const p of this.enemyPools) p.end();
    this.sacks.end();
    this.stars.end();
    for (const p of this.soldierPools) p.end();
    for (const p of this.heroPools) p.end();
    for (const p of this.weaponPools.values()) p?.end();
    this.turretBase.end();
    this.turretHead.end();

    // ------------------------------------------------ tours
    for (const p of this.towerBase.values()) p.begin();
    for (const p of this.towerTop.values()) p.begin();
    this.rocks.begin();
    this.towerMuzzle.clear();
    for (let i = 0; i < snap.tCount; i++) {
      const id = snap.tId[i];
      const slot = this.map.slots[snap.tSlot[i]];
      if (!slot) continue;
      const fam = snap.tFam[i], level = snap.tLevel[i];
      const model = this.towerView(fam, level);
      const key = fam * 10 + level;
      let born = this.tBorn.get(id);
      const yaw = this.yawOfSlot(snap.tSlot[i]);
      if (born === undefined) { born = time; this.tBorn.set(id, born); this.tYaw[id] = yaw; }
      const age = time - born;
      const pop = age < 0.35 ? 0.6 + 0.4 * Math.sin((age / 0.35) * Math.PI * 0.5) + Math.sin((age / 0.35) * Math.PI) * 0.12 : 1;
      const team = PLAYER_COLORS[snap.tOwner[i]] ?? 0xffffff;
      const stunned = snap.tStun[i] > 0;
      if (!this.inView(slot.x, 2, slot.z, 6)) {
        this.towerMuzzle.set(id, { x: slot.x, y: model.muzzleY, z: slot.z, fam, level, owner: snap.tOwner[i], slot: snap.tSlot[i] });
        continue;
      }
      const base = this.towerPool(this.towerBase, key, model.base, model.map);
      const b = base.push(slot.x, 0, slot.z, yaw, pop, id * 0.9, 0, id === selectedTower ? 0.18 : 0, 0);
      base.setTeam(b, team);
      const ft = this.towerFire.get(id);
      // la catapulte ne secoue la tour qu'au lâcher du rocher, à la fin de sa bascule
      const rft = ft !== undefined ? time - ft - (model.machine?.arm ? ARM_THROW : 0) : -1;
      // l'artillerie ne s'écrase pas au tir : sa catapulte ou ses canons bougent déjà
      const recoil = fam !== 3 && rft >= 0 && rft < 0.3 ? Math.max(0.001, rft / 0.3) : 0;
      if (recoil) base.setPose(b, recoil, 0, 0, 0);
      if (stunned) base.setTint(b, 0.55, 0.7, 0.55, 0.45);
      if (model.turret) {
        const aim = snap.tAim[i];
        const ai = aim !== 0xffff ? f.enemyIdx(aim) : -1;
        if (ai >= 0) this.tYaw[id] = lerpAngle(this.tYaw[id], Math.atan2(f.eX[ai] - slot.x, f.eZ[ai] - slot.z), Math.min(1, dt * 8));
        const top = this.towerPool(this.towerTop, key, model.turret, model.map);
        const mach = model.machine;
        // tête importée : elle ne s'écrase pas (ses canons ou son bras bougent), elle suit le haut du socle qui s'écrase
        const k = mach && recoil ? Math.sin(recoil * Math.PI) * (1 - recoil) * 0.16 : 0;
        const ty = model.turretY * pop - model.headMinY * k * pop;
        const t = top.push(slot.x, ty, slot.z, this.tYaw[id], pop, id, 0, 0, 0);
        top.setTeam(t, team);
        if (mach) {
          const fired = ft !== undefined ? time - ft : 99;
          const gun = fired < 0.45 ? Math.max(0.001, fired / 0.45) : 0;
          let ang = 0;
          if (mach.arm) {
            ang = ft !== undefined ? armAngle(fired, this.armFrom.get(id) ?? 0) : 0;
            const load = ft !== undefined ? rockLoaded(fired) : 1;
            if (load > 0) this.rockInBucket(mach.arm, ang, slot.x, ty, slot.z, this.tYaw[id], pop, load, id);
          }
          top.setPose(t, gun, this.tBarrel.get(id) ?? 0, ang, 0);
        } else if (recoil) top.setPose(t, recoil, 0, 0, 0);
        if (stunned) top.setTint(t, 0.55, 0.7, 0.55, 0.45);
      }
      this.towerMuzzle.set(id, { x: slot.x, y: model.muzzleY, z: slot.z, fam, level, owner: snap.tOwner[i], slot: snap.tSlot[i] });
    }
    for (const p of this.towerBase.values()) p.end();
    for (const p of this.towerTop.values()) p.end();
    this.rocks.end();
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
