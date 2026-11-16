import * as THREE from 'three';
import { GB } from '../art/builder';
import { InstPool } from './InstPool';

const MAX_P = 2400;

/** Particules CPU instanciées : deux lots (opaque et additif). */
class Particles {
  mesh: THREE.InstancedMesh;
  px = new Float32Array(MAX_P);
  py = new Float32Array(MAX_P);
  pz = new Float32Array(MAX_P);
  vx = new Float32Array(MAX_P);
  vy = new Float32Array(MAX_P);
  vz = new Float32Array(MAX_P);
  life = new Float32Array(MAX_P);
  max = new Float32Array(MAX_P);
  size = new Float32Array(MAX_P);
  grav = new Float32Array(MAX_P);
  col = new Float32Array(MAX_P * 3);
  n = 0;
  private mat: Float32Array;
  private colors: THREE.InstancedBufferAttribute;

  constructor(parent: THREE.Object3D, additive: boolean) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const m = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: additive, depthWrite: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
    this.mesh = new THREE.InstancedMesh(geo, m, MAX_P);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = this.colors;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mat = this.mesh.instanceMatrix.array as Float32Array;
    parent.add(this.mesh);
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav = -9) {
    let i = this.n;
    if (i >= MAX_P) i = Math.floor(Math.random() * MAX_P);
    else this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grav[i] = grav;
    this.col[i * 3] = ((color >> 16) & 255) / 255;
    this.col[i * 3 + 1] = ((color >> 8) & 255) / 255;
    this.col[i * 3 + 2] = (color & 255) / 255;
  }

  update(dt: number) {
    const m = this.mat;
    const c = this.colors.array as Float32Array;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i] - dt;
      if (l <= 0) continue;
      // compactage
      if (w !== i) {
        this.px[w] = this.px[i]; this.py[w] = this.py[i]; this.pz[w] = this.pz[i];
        this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; this.vz[w] = this.vz[i];
        this.max[w] = this.max[i]; this.size[w] = this.size[i]; this.grav[w] = this.grav[i];
        this.col[w * 3] = this.col[i * 3]; this.col[w * 3 + 1] = this.col[i * 3 + 1]; this.col[w * 3 + 2] = this.col[i * 3 + 2];
      }
      this.life[w] = l;
      this.vy[w] += this.grav[w] * dt;
      this.px[w] += this.vx[w] * dt;
      this.py[w] += this.vy[w] * dt;
      this.pz[w] += this.vz[w] * dt;
      if (this.py[w] < 0.02) { this.py[w] = 0.02; this.vy[w] *= -0.3; this.vx[w] *= 0.6; this.vz[w] *= 0.6; }
      const s = this.size[w] * Math.min(1, (l / this.max[w]) * 1.6);
      const o = w * 16;
      m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s; m[o + 11] = 0;
      m[o + 12] = this.px[w]; m[o + 13] = this.py[w]; m[o + 14] = this.pz[w]; m[o + 15] = 1;
      c[w * 3] = this.col[w * 3]; c[w * 3 + 1] = this.col[w * 3 + 1]; c[w * 3 + 2] = this.col[w * 3 + 2];
      w++;
    }
    this.n = w;
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colors.needsUpdate = true;
  }
}

/** Segments lumineux (éclairs, rayons). */
class Beams {
  mesh: THREE.InstancedMesh;
  private data: { ax: number; ay: number; az: number; bx: number; by: number; bz: number; life: number; max: number; w: number; c: number }[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private d = new THREE.Vector3();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  constructor(parent: THREE.Object3D) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1);
    g.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(g, mat, 256);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(256 * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    parent.add(this.mesh);
  }
  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, life: number, w: number, c: number, jag = 0) {
    if (jag > 0) {
      // éclair en zigzag
      const n = 4;
      let px = ax, py = ay, pz = az;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const j = k === n ? 0 : jag;
        const nx = ax + (bx - ax) * t + (Math.random() - 0.5) * j;
        const ny = ay + (by - ay) * t + (Math.random() - 0.5) * j;
        const nz = az + (bz - az) * t + (Math.random() - 0.5) * j;
        this.add(px, py, pz, nx, ny, nz, life, w, c);
        px = nx; py = ny; pz = nz;
      }
      return;
    }
    if (this.data.length >= 256) this.data.shift();
    this.data.push({ ax, ay, az, bx, by, bz, life, max: life, w, c });
  }
  update(dt: number) {
    let w = 0;
    for (const b of this.data) {
      b.life -= dt;
      if (b.life <= 0) continue;
      this.data[w++] = b;
    }
    this.data.length = w;
    for (let i = 0; i < w; i++) {
      const b = this.data[i];
      this.d.set(b.bx - b.ax, b.by - b.ay, b.bz - b.az);
      const len = this.d.length() || 0.001;
      this.q.setFromUnitVectors(this.up, this.d.divideScalar(len));
      const k = b.life / b.max;
      this.s.set(b.w * k, len, b.w * k);
      this.p.set(b.ax, b.ay, b.az);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
      this.col.setHex(b.c).multiplyScalar(0.6 + k);
      this.mesh.setColorAt(i, this.col);
    }
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Anneaux au sol (impacts, ralliement, sélection). */
class Rings {
  mesh: THREE.InstancedMesh;
  private data: { x: number; z: number; r0: number; r1: number; life: number; max: number; c: number }[] = [];
  private m4 = new THREE.Matrix4();
  private col = new THREE.Color();
  constructor(parent: THREE.Object3D) {
    const g = new THREE.RingGeometry(0.86, 1, 32);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(g, mat, 128);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(128 * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 2;
    parent.add(this.mesh);
  }
  add(x: number, z: number, r0: number, r1: number, life: number, c: number) {
    if (this.data.length >= 128) this.data.shift();
    this.data.push({ x, z, r0, r1, life, max: life, c });
  }
  update(dt: number) {
    let w = 0;
    for (const r of this.data) {
      r.life -= dt;
      if (r.life > 0) this.data[w++] = r;
    }
    this.data.length = w;
    for (let i = 0; i < w; i++) {
      const r = this.data[i];
      const t = 1 - r.life / r.max;
      const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t));
      this.m4.makeScale(s, 1, s).setPosition(r.x, 0.08, r.z);
      this.mesh.setMatrixAt(i, this.m4);
      this.col.setHex(r.c).multiplyScalar(1 - t);
      this.mesh.setColorAt(i, this.col);
    }
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export interface Shot {
  kind: number;
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  targetId: number;
  t0: number;
  dur: number;
  arc: number;
  x: number;
  y: number;
  z: number;
}

function projGeometries() {
  const arrow = new GB(1);
  arrow.ao = false;
  arrow.box(0.05, 0.05, 0.75, 0x8d6e63, 0, 0, 0);
  arrow.cone(0.07, 0.18, 4, 0xcfd8dc, 0, 0, 0.45, Math.PI / 2);
  arrow.box(0.12, 0.02, 0.12, 0xffffff, 0, 0, -0.33);
  const shell = new GB(2);
  shell.ao = false;
  shell.ball(0.22, 0x263238, 0, 0, 0);
  const rock = new GB(3);
  rock.ao = false;
  rock.rock(0.6, 0x5d4037, 0, 0, 0);
  rock.ball(0.45, 0xff6f00, 0, 0, -0.2);
  return { arrow: arrow.build(), shell: shell.build(), rock: rock.build() };
}

const GLOW: Record<number, number> = { 1: 0xd500f9, 2: 0x80deea, 3: 0xea80fc, 9: 0x76ff03, 13: 0x76ff03 };

export class Fx {
  readonly group = new THREE.Group();
  readonly sparks: Particles;
  readonly glow: Particles;
  readonly beams: Beams;
  readonly rings: Rings;
  private arrows: InstPool;
  private shells: InstPool;
  private rocks: InstPool;
  shots: Shot[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.sparks = new Particles(this.group, false);
    this.glow = new Particles(this.group, true);
    this.beams = new Beams(this.group);
    this.rings = new Rings(this.group);
    const g = projGeometries();
    this.arrows = new InstPool(g.arrow, 128, this.group, false);
    this.shells = new InstPool(g.shell, 64, this.group, false);
    this.rocks = new InstPool(g.rock, 16, this.group, false);
  }

  burst(x: number, y: number, z: number, n: number, color: number, speed = 3, size = 0.12, life = 0.6, additive = false, grav = -9) {
    const p = additive ? this.glow : this.sparks;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      p.spawn(x, y, z, Math.cos(a) * v, speed * (0.4 + Math.random()), Math.sin(a) * v, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, grav);
    }
  }

  ring(x: number, z: number, r: number, color: number, life = 0.5, r0 = 0.2) {
    this.rings.add(x, z, r0, r, life, color);
  }

  addShot(s: Shot) {
    this.shots.push(s);
  }

  /**
   * @param tick temps de rendu (en ticks)
   * @param target fonction donnant la position actuelle d'une cible (ou null)
   */
  update(dt: number, tick: number, target: (id: number, out: { x: number; y: number; z: number }) => boolean) {
    const tp = { x: 0, y: 0, z: 0 };
    this.arrows.begin();
    this.shells.begin();
    this.rocks.begin();
    let w = 0;
    for (const s of this.shots) {
      const t = (tick - s.t0) / s.dur;
      if (t >= 1) continue;
      this.shots[w++] = s;
      if (t < 0) continue;
      if (s.targetId !== 0xffff && target(s.targetId, tp)) { s.tx = tp.x; s.ty = tp.y; s.tz = tp.z; }
      const x = s.sx + (s.tx - s.sx) * t;
      const z = s.sz + (s.tz - s.sz) * t;
      const y = s.sy + (s.ty - s.sy) * t + s.arc * 4 * t * (1 - t);
      const dx = x - s.x, dy = y - s.y, dz = z - s.z;
      s.x = x; s.y = y; s.z = z;
      const yaw = Math.atan2(dx, dz);
      const k = s.kind;
      if (k === 0 || k === 8 || k === 10) {
        const i = this.arrows.push(x, y, z, yaw, 1);
        // inclinaison de la flèche selon la trajectoire : approximée via écrasement léger
        void dy;
        void i;
      } else if (k === 4 || k === 5 || k === 12) {
        this.shells.push(x, y, z, 0, k === 12 ? 0.6 : 1);
        if (k === 5) this.glow.spawn(x, y, z, 0, 0.5, 0, 0.35, 0.2, 0xff8f00, 0);
        else if (Math.random() < 0.4) this.sparks.spawn(x, y, z, 0, 0.3, 0, 0.5, 0.1, 0x9e9e9e, 0);
      } else if (k === 11) {
        this.rocks.push(x, y, z, tick * 0.3, 1);
        for (let n = 0; n < 3; n++) this.glow.spawn(x + Math.random() - 0.5, y, z + Math.random() - 0.5, 0, 1, 0, 0.5, 0.35, n ? 0xff6f00 : 0xffd54f, 0);
        this.sparks.spawn(x, y + 0.5, z, 0, 1, 0, 0.8, 0.3, 0x424242, 0);
      } else {
        const c = GLOW[k] ?? 0xffffff;
        this.glow.spawn(x, y, z, 0, 0, 0, 0.18, 0.22, c, 0);
        this.glow.spawn(x, y, z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.3, 0.1, c, 0);
      }
    }
    this.shots.length = w;
    this.arrows.end();
    this.shells.end();
    this.rocks.end();
    this.sparks.update(dt);
    this.glow.update(dt);
    this.beams.update(dt);
    this.rings.update(dt);
  }
}
