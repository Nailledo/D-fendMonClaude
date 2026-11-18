import * as THREE from 'three';
import { SKIN_BASE, SKIN_TONES } from '@dfend/shared';
import { animDepthMaterial, animMaterial } from './materials';

let sharedDepth: THREE.MeshDepthMaterial | null = null;
const matByMap = new Map<THREE.Texture | null, THREE.MeshToonMaterial>();
/** Matériau animé partagé : un par texture (null = couleurs de sommets seules). */
export function sharedAnimMaterial(map: THREE.Texture | null = null) {
  let m = matByMap.get(map);
  if (!m) {
    m = animMaterial(map);
    matByMap.set(map, m);
  }
  return m;
}
function sharedDepthMat() {
  return (sharedDepth ??= animDepthMaterial());
}

/** Modèles sans peau marquée (décor, tours, ennemis) : attribut aSkin nul, partagé par modèle. */
const noSkins = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
function noSkin(src: THREE.BufferGeometry) {
  let a = src.getAttribute('aSkin') as THREE.BufferAttribute | undefined;
  if (a) return a;
  a = noSkins.get(src);
  if (!a) noSkins.set(src, (a = new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count), 1)));
  return a;
}

const SKIN_ONE: readonly [number, number, number] = [1, 1, 1];
const skinMuls = new Map<number, readonly [number, number, number]>();
/**
 * Multiplicateur de couleur des sommets de peau pour une couleur de peau (index de SKIN_TONES) :
 * rapport, en espace linéaire, entre la couleur voulue et la peau des modèles (l'ombrage peint est conservé).
 */
export function skinMul(skin: number): readonly [number, number, number] {
  if (!skin) return SKIN_ONE;
  let m = skinMuls.get(skin);
  if (!m) {
    const to = new THREE.Color(SKIN_TONES[skin]?.color ?? SKIN_BASE), base = new THREE.Color(SKIN_BASE);
    m = [to.r / base.r, to.g / base.g, to.b / base.b];
    skinMuls.set(skin, m);
  }
  return m;
}

/** Lots dont le modèle a des niveaux de détail (voir `applyLods`). */
const withLods = new Set<InstPool>();
let globalLod = 0;

/**
 * Choisit le niveau de détail de tous les modèles selon leur taille à l'écran :
 * `ppu` = pixels par unité de monde au centre de la vue, `bias` < 1 favorise les modèles simplifiés.
 */
export function applyLods(ppu: number, bias = 1) {
  const p = ppu * bias;
  // un personnage fait ~1,5 unité : modèle complet au-delà de ~110 px, version légère sous ~50 px
  const want = p > 72 ? 0 : p > 34 ? 1 : 2;
  // hystérésis : on ne repasse au niveau supérieur qu'avec une marge (pas de clignotement en zoomant)
  if (want < globalLod && p < [72, 34][want] * 1.12) return globalLod;
  globalLod = want;
  for (const pool of withLods) pool.setLod(globalLod);
  return globalLod;
}

/** Oublie les lots rattachés à `root` (scène quittée), pour qu'ils ne restent pas en mémoire. */
export function forgetPools(root: THREE.Object3D) {
  for (const pool of withLods) {
    for (let o: THREE.Object3D | null = pool.mesh; o; o = o.parent) if (o === root) { withLods.delete(pool); break; }
  }
}

/**
 * Lot d'instances d'un même modèle. Une seule draw call par modèle,
 * attributs par instance (animation, teinte, couleur d'équipe), aucune allocation par frame.
 */
export class InstPool {
  mesh!: THREE.InstancedMesh;
  private geo!: THREE.BufferGeometry;
  private anim!: Float32Array;
  private tint!: Float32Array;
  private team!: Float32Array;
  private pose!: Float32Array;
  private skin!: Float32Array;
  private mat!: Float32Array;
  private aPose!: THREE.InstancedBufferAttribute;
  private aAnim!: THREE.InstancedBufferAttribute;
  private aTint!: THREE.InstancedBufferAttribute;
  private aTeam!: THREE.InstancedBufferAttribute;
  private aSkin!: THREE.InstancedBufferAttribute;
  count = 0;
  cap = 0;
  private lods: THREE.BufferAttribute[] | null;
  private lod = 0;

  constructor(private src: THREE.BufferGeometry, cap: number, private parent: THREE.Object3D, private shadow = true, private map: THREE.Texture | null = null) {
    this.lods = (src.userData.lods as THREE.BufferAttribute[] | undefined) ?? null;
    this.alloc(cap);
    if (this.lods && this.lods.length > 1) {
      withLods.add(this);
      this.setLod(globalLod);
    }
  }

  /** Niveau de détail : même sommets, index simplifié (aussi utilisé pour les ombres). */
  setLod(l: number) {
    if (!this.lods) return;
    const lv = Math.min(l, this.lods.length - 1);
    if (lv === this.lod && this.geo.index === this.lods[lv]) return;
    this.lod = lv;
    this.geo.setIndex(this.lods[lv]);
  }

  private alloc(cap: number) {
    const old = this.mesh;
    // agrandissement en cours d'image : on garde les instances déjà posées (sinon elles disparaissent une image)
    const keep = old ? { mat: this.mat, anim: this.anim, tint: this.tint, team: this.team, pose: this.pose, skin: this.skin } : null;
    this.cap = cap;
    this.geo = new THREE.BufferGeometry();
    for (const k of Object.keys(this.src.attributes)) this.geo.setAttribute(k, this.src.attributes[k]);
    if (!this.geo.getAttribute('aSkin')) this.geo.setAttribute('aSkin', noSkin(this.src));
    if (this.src.index) this.geo.setIndex(this.lods?.[this.lod] ?? this.src.index);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.anim = new Float32Array(cap * 4);
    this.tint = new Float32Array(cap * 4);
    this.team = new Float32Array(cap * 3);
    this.pose = new Float32Array(cap * 4);
    this.skin = new Float32Array(cap * 3).fill(1);
    this.aAnim = new THREE.InstancedBufferAttribute(this.anim, 4).setUsage(THREE.DynamicDrawUsage);
    this.aTint = new THREE.InstancedBufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage);
    this.aTeam = new THREE.InstancedBufferAttribute(this.team, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iAnim', this.aAnim);
    this.geo.setAttribute('iTint', this.aTint);
    this.aPose = new THREE.InstancedBufferAttribute(this.pose, 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iTeam', this.aTeam);
    this.geo.setAttribute('iPose', this.aPose);
    this.aSkin = new THREE.InstancedBufferAttribute(this.skin, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iSkin', this.aSkin);
    this.mesh = new THREE.InstancedMesh(this.geo, sharedAnimMaterial(this.map), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.shadow;
    this.mesh.receiveShadow = false;
    this.mesh.customDepthMaterial = sharedDepthMat();
    this.mesh.count = 0;
    this.mat = this.mesh.instanceMatrix.array as Float32Array;
    if (keep) {
      this.mat.set(keep.mat.subarray(0, Math.min(keep.mat.length, this.mat.length)));
      this.anim.set(keep.anim); this.tint.set(keep.tint); this.team.set(keep.team); this.pose.set(keep.pose); this.skin.set(keep.skin);
    }
    if (old) {
      this.parent.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
    this.parent.add(this.mesh);
  }

  begin() {
    this.count = 0;
  }

  /** Ajoute une instance : position, orientation (lacet), échelle. */
  push(x: number, y: number, z: number, yaw: number, s: number, phase = 0, speed = 0, flash = 0, mode = 0): number {
    if (this.count >= this.cap) this.alloc(this.cap * 2);
    const i = this.count++;
    const c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s;
    const m = this.mat, o = i * 16;
    m[o] = c; m[o + 1] = 0; m[o + 2] = -sn; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    const a = i * 4;
    this.anim[a] = phase; this.anim[a + 1] = speed; this.anim[a + 2] = flash; this.anim[a + 3] = mode;
    this.tint[a + 3] = 0;
    this.pose[a] = 0; this.pose[a + 1] = 0; this.pose[a + 2] = 0; this.pose[a + 3] = 0;
    const k = i * 3;
    this.skin[k] = 1; this.skin[k + 1] = 1; this.skin[k + 2] = 1;
    return i;
  }

  /** Pose d'une instance vivante : geste (0..1), recul au coup (0..1), roulis (rad), vie (1 normal, 0..1 apparition, -1..0 mort). */
  setPose(i: number, gesture: number, hit: number, roll: number, life: number) {
    const o = i * 4;
    this.pose[o] = gesture; this.pose[o + 1] = hit; this.pose[o + 2] = roll; this.pose[o + 3] = life;
  }

  /** Ajoute une instance orientée selon une direction (projectiles) : l'axe +z du modèle suit (dx, dy, dz). */
  pushDir(x: number, y: number, z: number, dx: number, dy: number, dz: number, s: number): number {
    const i = this.push(x, y, z, 0, s);
    const l = Math.hypot(dx, dy, dz) || 1;
    const fx = dx / l, fy = dy / l, fz = dz / l;
    // droite = haut × avant (le haut du monde, sauf trajectoire verticale)
    let rx = fz, rz = -fx;
    const rl = Math.hypot(rx, rz);
    if (rl < 1e-4) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
    // haut = avant × droite
    const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
    const m = this.mat, o = i * 16;
    m[o] = rx * s; m[o + 1] = 0; m[o + 2] = rz * s;
    m[o + 4] = ux * s; m[o + 5] = uy * s; m[o + 6] = uz * s;
    m[o + 8] = fx * s; m[o + 9] = fy * s; m[o + 10] = fz * s;
    return i;
  }

  /** Échelle non uniforme (apparition/écrasement). */
  squash(i: number, sy: number) {
    const o = i * 16;
    this.mat[o + 4] *= 1; this.mat[o + 5] *= sy;
  }

  setTint(i: number, r: number, g: number, b: number, a: number) {
    const o = i * 4;
    this.tint[o] = r; this.tint[o + 1] = g; this.tint[o + 2] = b; this.tint[o + 3] = a;
  }

  /** Opacité de teinte stockée à l'offset `o` (= instance × 4). */
  tintAlpha(o: number) {
    return this.tint[o + 3];
  }

  /** Couleur de peau (multiplicateur linéaire des sommets de peau, voir skinMul). */
  setSkin(i: number, m: readonly [number, number, number]) {
    const o = i * 3;
    this.skin[o] = m[0]; this.skin[o + 1] = m[1]; this.skin[o + 2] = m[2];
  }

  setTeam(i: number, hex: number) {
    const o = i * 3;
    this.team[o] = ((hex >> 16) & 255) / 255;
    this.team[o + 1] = ((hex >> 8) & 255) / 255;
    this.team[o + 2] = (hex & 255) / 255;
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count === 0) return;
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, this.count * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const [attr, n] of [[this.aAnim, 4], [this.aTint, 4], [this.aTeam, 3], [this.aPose, 4], [this.aSkin, 3]] as const) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * n);
      attr.needsUpdate = true;
    }
  }

  dispose() {
    withLods.delete(this);
    this.parent.remove(this.mesh);
    this.geo.dispose();
    this.mesh.dispose();
  }
}

/** Instances statiques (décor) : écrites une seule fois. */
export function staticInstances(geo: THREE.BufferGeometry, items: { x: number; y: number; z: number; yaw: number; s: number }[], parent: THREE.Object3D, shadow: boolean, map: THREE.Texture | null = null) {
  const p = new InstPool(geo, Math.max(1, items.length), parent, shadow, map);
  p.begin();
  for (const it of items) p.push(it.x, it.y, it.z, it.yaw, it.s, it.x * 1.3 + it.z * 0.7, 0, 0, 0);
  p.end();
  p.mesh.receiveShadow = true;
  p.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  return p;
}
