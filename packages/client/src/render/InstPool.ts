import * as THREE from 'three';
import { animDepthMaterial, animMaterial } from './materials';

let sharedMat: THREE.MeshToonMaterial | null = null;
let sharedDepth: THREE.MeshDepthMaterial | null = null;
export function sharedAnimMaterial() {
  return (sharedMat ??= animMaterial());
}
function sharedDepthMat() {
  return (sharedDepth ??= animDepthMaterial());
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
  private mat!: Float32Array;
  private aAnim!: THREE.InstancedBufferAttribute;
  private aTint!: THREE.InstancedBufferAttribute;
  private aTeam!: THREE.InstancedBufferAttribute;
  count = 0;
  cap = 0;

  constructor(private src: THREE.BufferGeometry, cap: number, private parent: THREE.Object3D, private shadow = true) {
    this.alloc(cap);
  }

  private alloc(cap: number) {
    const old = this.mesh;
    this.cap = cap;
    this.geo = new THREE.BufferGeometry();
    for (const k of Object.keys(this.src.attributes)) this.geo.setAttribute(k, this.src.attributes[k]);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.anim = new Float32Array(cap * 4);
    this.tint = new Float32Array(cap * 4);
    this.team = new Float32Array(cap * 3);
    this.aAnim = new THREE.InstancedBufferAttribute(this.anim, 4).setUsage(THREE.DynamicDrawUsage);
    this.aTint = new THREE.InstancedBufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage);
    this.aTeam = new THREE.InstancedBufferAttribute(this.team, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iAnim', this.aAnim);
    this.geo.setAttribute('iTint', this.aTint);
    this.geo.setAttribute('iTeam', this.aTeam);
    this.mesh = new THREE.InstancedMesh(this.geo, sharedAnimMaterial(), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.shadow;
    this.mesh.receiveShadow = false;
    this.mesh.customDepthMaterial = sharedDepthMat();
    this.mesh.count = 0;
    this.mat = this.mesh.instanceMatrix.array as Float32Array;
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
    for (const [attr, n] of [[this.aAnim, 4], [this.aTint, 4], [this.aTeam, 3]] as const) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * n);
      attr.needsUpdate = true;
    }
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.geo.dispose();
    this.mesh.dispose();
  }
}

/** Instances statiques (décor) : écrites une seule fois. */
export function staticInstances(geo: THREE.BufferGeometry, items: { x: number; y: number; z: number; yaw: number; s: number }[], parent: THREE.Object3D, shadow: boolean) {
  const p = new InstPool(geo, Math.max(1, items.length), parent, shadow);
  p.begin();
  for (const it of items) p.push(it.x, it.y, it.z, it.yaw, it.s, it.x * 1.3 + it.z * 0.7, 0, 0, 0);
  p.end();
  p.mesh.receiveShadow = true;
  p.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  return p;
}
