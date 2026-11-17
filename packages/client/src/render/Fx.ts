import * as THREE from 'three';
import { GB } from '../art/builder';
import { settings, tuning } from '../settings';

/** quantité de particules des effets composés selon la qualité (au moins une) */
const dens = (n: number) => (n <= 1 ? n : Math.max(1, Math.round(n * tuning().fx)));
import { InstPool } from './InstPool';
import { uniforms } from './materials';

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


// =====================================================================
// Effets 3D des sorts : traces au sol, colonnes de lumière, cristaux, éclairs lumineux
// =====================================================================

/** Types de traces au sol */
export const enum Decal { Scorch = 0, Cracks = 1, Pool = 2, Rune = 3 }

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * Traces au sol procédurales (aucune texture) : brûlure/cratère, fissures, flaque, cercle runique.
 * Deux lots : normal (brûlures, fissures, flaques) et additif (cercles runiques lumineux).
 */
class Decals {
  mesh: THREE.InstancedMesh;
  private data: { x: number; z: number; r: number; rot: number; life: number; max: number; kind: number; c: number; spin: number }[] = [];
  private aD: THREE.InstancedBufferAttribute;
  private aC: THREE.InstancedBufferAttribute;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private yAxis = new THREE.Vector3(0, 1, 0);
  constructor(parent: THREE.Object3D, additive: boolean, private cap = 96) {
    const g = new THREE.PlaneGeometry(2, 2);
    g.rotateX(-Math.PI / 2);
    this.aD = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iDecal', this.aD);
    g.setAttribute('iCol', this.aC);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: /* glsl */ `
        attribute vec4 iDecal; attribute vec3 iCol;
        varying vec2 vUv; varying vec4 vD; varying vec3 vC;
        void main() {
          vUv = uv; vD = iDecal; vC = iCol;
          // le sol ondule : la trace est avancée vers la caméra pour ne pas passer dessous
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          mv.xyz += normalize(-mv.xyz) * 0.7;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv; varying vec4 vD; varying vec3 vC;
        ${NOISE_GLSL}
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float d = length(p);
          if (d > 1.0) discard;
          float a = atan(p.y, p.x);
          float kind = vD.x, fade = vD.y, age = vD.w;
          vec4 col = vec4(0.0);
          if (kind < 0.5) {
            // brûlure : bord déchiqueté, braises qui s'éteignent
            float n = noise(p * 3.0 + vD.z * 3.0) * 0.35;
            float m = 1.0 - smoothstep(0.5 + n * 0.6, 1.0, d);
            float ember = (1.0 - smoothstep(0.0, 0.8, d)) * smoothstep(0.35, 0.9, noise(p * 7.0 + vec2(uTime * 0.4, vD.z)));
            ember *= max(0.0, 1.0 - age * 0.5);
            col = vec4(vec3(0.07, 0.05, 0.04) + vC * ember * 2.2, m * 0.82 * fade);
          } else if (kind < 1.5) {
            // fissures rayonnantes qui rougeoient au début
            float n = noise(vec2(a * 2.5 + vD.z, d * 5.0));
            float lines = 1.0 - smoothstep(0.0, 0.09 * (1.2 - d), abs(sin(a * 4.5 + n * 3.0 + d * 1.2)));
            float m = lines * (1.0 - smoothstep(0.6, 1.0, d)) * smoothstep(0.08, 0.2, d);
            float hole = 1.0 - smoothstep(0.12, 0.3, d);
            vec3 c = mix(vec3(0.1, 0.07, 0.05), vC, max(0.0, 1.0 - age * 1.2) * (1.0 - d));
            col = vec4(c, max(m, hole * 0.75) * fade);
          } else if (kind < 2.5) {
            // flaque animée (lave, glace, poison) : bord irrégulier, reflets mouvants
            float n = noise(p * 2.5 + vec2(uTime * 0.25, vD.z));
            float m = 1.0 - smoothstep(0.7 + n * 0.22, 0.9 + n * 0.22, d);
            float v = noise(p * 4.0 + vec2(uTime * 0.5, -uTime * 0.3));
            float rim = smoothstep(0.55, 0.85, d) * m;
            col = vec4(vC * (0.65 + 0.7 * v) + rim * 0.25, m * fade * 0.92);
          } else {
            // cercle runique lumineux qui tourne
            float r1 = 1.0 - smoothstep(0.0, 0.035, abs(d - 0.92));
            float r2 = 1.0 - smoothstep(0.0, 0.02, abs(d - 0.72));
            float ang = a + uTime * vD.z;
            float ticks = step(0.72, fract(ang * 18.0 / 6.2832)) * step(0.76, d) * step(d, 0.86);
            float star = 0.0;
            for (int k = 0; k < 6; k++) {
              float th = float(k) * 1.0472 - uTime * vD.z * 0.6;
              vec2 nn = vec2(cos(th), sin(th));
              star = max(star, (1.0 - smoothstep(0.0, 0.018, abs(dot(p, nn) - 0.36))) * step(d, 0.72));
            }
            float glow = (1.0 - d) * 0.35;
            float m = max(max(r1, r2), max(ticks, star));
            col = vec4(vC * (m * 1.4 + glow), (m + glow) * fade);
          }
          gl_FragColor = col;
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = additive ? 3 : 1;
    parent.add(this.mesh);
  }
  add(x: number, z: number, r: number, kind: Decal, life: number, c: number, spin = 0.8) {
    if (this.data.length >= this.cap) this.data.shift();
    this.data.push({ x, z, r, rot: Math.random() * Math.PI * 2, life, max: life, kind, c, spin });
  }
  update(dt: number) {
    let w = 0;
    for (const d of this.data) {
      d.life -= dt;
      if (d.life > 0) this.data[w++] = d;
    }
    this.data.length = w;
    const D = this.aD.array as Float32Array, C = this.aC.array as Float32Array;
    for (let i = 0; i < w; i++) {
      const d = this.data[i];
      const age = d.max - d.life;
      const fin = Math.min(1, age / 0.12), fout = Math.min(1, d.life / Math.min(1.2, d.max * 0.4));
      // les cercles runiques s'ouvrent avec un dépassement, les autres grandissent vite
      const g = d.kind === Decal.Rune ? 1 + 2.7 * (Math.min(1, age / 0.3) - 1) ** 3 + 1.7 * (Math.min(1, age / 0.3) - 1) ** 2 : 0.7 + 0.3 * Math.min(1, age / 0.15);
      const r = d.r * Math.max(0.01, g);
      this.q.setFromAxisAngle(this.yAxis, d.rot);
      this.m4.compose(this.v.set(d.x, 0.06 + i * 0.0004, d.z), this.q, this.sc.set(r, 1, r));
      this.mesh.setMatrixAt(i, this.m4);
      D[i * 4] = d.kind; D[i * 4 + 1] = fin * fout; D[i * 4 + 2] = d.kind === Decal.Rune ? d.spin : d.rot; D[i * 4 + 3] = age;
      C[i * 3] = ((d.c >> 16) & 255) / 255; C[i * 3 + 1] = ((d.c >> 8) & 255) / 255; C[i * 3 + 2] = (d.c & 255) / 255;
    }
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aD.needsUpdate = true;
    this.aC.needsUpdate = true;
  }
}

/**
 * Colonnes de lumière et murs d'onde de choc : cylindres ouverts additifs,
 * dégradé vertical et stries qui montent en tournoyant.
 */
class Pillars {
  mesh: THREE.InstancedMesh;
  private data: { x: number; y: number; z: number; r0: number; r1: number; h0: number; h1: number; life: number; max: number; c: number; swirl: number }[] = [];
  private aP: THREE.InstancedBufferAttribute;
  private aC: THREE.InstancedBufferAttribute;
  private m4 = new THREE.Matrix4();
  constructor(parent: THREE.Object3D, private cap = 48) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
    g.translate(0, 0.5, 0);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', this.aP);
    g.setAttribute('iCol', this.aC);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec2 iP; attribute vec3 iCol;
        varying vec2 vUv; varying vec2 vP; varying vec3 vC;
        void main() { vUv = uv; vP = iP; vC = iCol; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv; varying vec2 vP; varying vec3 vC;
        void main() {
          float v = vUv.y;
          float body = pow(1.0 - v, 1.6);
          float stripes = 0.55 + 0.45 * sin(vUv.x * 6.2832 * 5.0 + v * 9.0 * vP.y - uTime * 7.0 * (0.4 + vP.y));
          float base = smoothstep(0.12, 0.0, v) * 0.8;
          float a = (body * stripes + base) * vP.x;
          gl_FragColor = vec4(vC * a * 1.4, a);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 4;
    parent.add(this.mesh);
  }
  /** r0→r1, h0→h1 pendant la vie ; swirl > 0 : stries tournoyantes (colonne), 0 : mur d'onde de choc */
  add(x: number, y: number, z: number, r0: number, r1: number, h0: number, h1: number, life: number, c: number, swirl = 1) {
    if (this.data.length >= this.cap) this.data.shift();
    this.data.push({ x, y, z, r0, r1, h0, h1, life, max: life, c, swirl });
  }
  update(dt: number) {
    let w = 0;
    for (const d of this.data) {
      d.life -= dt;
      if (d.life > 0) this.data[w++] = d;
    }
    this.data.length = w;
    const P = this.aP.array as Float32Array, C = this.aC.array as Float32Array;
    for (let i = 0; i < w; i++) {
      const d = this.data[i];
      const t = 1 - d.life / d.max;
      const e = 1 - (1 - t) ** 3;
      const r = d.r0 + (d.r1 - d.r0) * e;
      const h = d.h0 + (d.h1 - d.h0) * Math.min(1, t * 3);
      this.m4.makeScale(r, h, r).setPosition(d.x, d.y, d.z);
      this.mesh.setMatrixAt(i, this.m4);
      const fade = Math.min(1, t / 0.08) * (1 - t) ** 1.3;
      P[i * 2] = fade; P[i * 2 + 1] = d.swirl;
      C[i * 3] = ((d.c >> 16) & 255) / 255; C[i * 3 + 1] = ((d.c >> 8) & 255) / 255; C[i * 3 + 2] = (d.c & 255) / 255;
    }
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aP.needsUpdate = true;
    this.aC.needsUpdate = true;
  }
}

/** Cristaux / pics qui jaillissent du sol (glace, roche) puis s'y renfoncent. */
class Shards {
  mesh: THREE.InstancedMesh;
  private data: { x: number; z: number; rx: number; rz: number; yaw: number; s: number; h: number; delay: number; life: number; max: number; c: number }[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private col = new THREE.Color();
  constructor(parent: THREE.Object3D, private cap = 160) {
    // facettes franches : géométrie non indexée, normales par face
    const g = new THREE.ConeGeometry(0.28, 1, 5, 1).toNonIndexed();
    g.translate(0, 0.5, 0);
    g.computeVertexNormals();
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x111822 });
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    parent.add(this.mesh);
  }
  /** Couronne de pics autour de (x, z) */
  burst(x: number, z: number, rad: number, n: number, c: number, life = 1.4, h = 1.2) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = rad * (0.25 + Math.random() * 0.75);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (this.data.length >= this.cap) this.data.shift();
      // inclinés vers l'extérieur
      this.data.push({ x: px, z: pz, rx: Math.sin(a) * 0.45, rz: -Math.cos(a) * 0.45, yaw: Math.random() * 6, s: 0.7 + Math.random() * 0.8, h: h * (0.6 + Math.random() * 0.7), delay: (d / Math.max(0.1, rad)) * 0.12, life: life + 0.12, max: life + 0.12, c });
    }
  }
  update(dt: number) {
    let w = 0;
    for (const d of this.data) {
      d.life -= dt;
      if (d.life > 0) this.data[w++] = d;
    }
    this.data.length = w;
    let n = 0;
    for (let i = 0; i < w; i++) {
      const d = this.data[i];
      const age = d.max - d.life - d.delay;
      if (age < 0) continue;
      const rise = Math.min(1, age / 0.14);
      const k = 1 + 2.70158 * (rise - 1) ** 3 + 1.70158 * (rise - 1) ** 2;
      const sink = Math.max(0, 1 - d.life / 0.35);
      this.e.set(d.rx, d.yaw, d.rz);
      this.q.setFromEuler(this.e);
      this.m4.compose(this.v.set(d.x, -0.05 - sink * d.h, d.z), this.q, this.sc.set(d.s, Math.max(0.01, d.h * k), d.s));
      this.mesh.setMatrixAt(n, this.m4);
      this.mesh.setColorAt(n, this.col.setHex(d.c));
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Éclairs lumineux : deux lumières ponctuelles réutilisées (le nombre de lumières reste constant). */
class Flashes {
  private lights: { l: THREE.PointLight; i: number; t: number; max: number }[] = [];
  constructor(parent: THREE.Object3D) {
    if (settings.quality === 'bas') return;
    for (let k = 0; k < 2; k++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 1.2);
      l.castShadow = false;
      parent.add(l);
      this.lights.push({ l, i: 0, t: 0, max: 1 });
    }
  }
  flash(x: number, y: number, z: number, c: number, intensity: number, dur: number, dist = 14) {
    if (!this.lights.length) return;
    // la lumière la plus faible est réutilisée
    let best = this.lights[0];
    for (const s of this.lights) if (s.l.intensity < best.l.intensity) best = s;
    best.l.position.set(x, y, z);
    best.l.color.setHex(c);
    best.l.distance = dist;
    best.i = intensity;
    best.t = dur;
    best.max = dur;
    best.l.intensity = intensity;
  }
  update(dt: number) {
    for (const s of this.lights) {
      if (s.t <= 0) { s.l.intensity = 0; continue; }
      s.t -= dt;
      const k = Math.max(0, s.t / s.max);
      s.l.intensity = s.i * k * k;
    }
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
  // flèche : fût fin, pointe en acier, empennage croisé (lisible sous tous les angles)
  const arrow = new GB(1);
  arrow.ao = false;
  arrow.jitter = 0;
  arrow.box(0.035, 0.035, 0.62, 0xa1785a, 0, 0, 0);
  arrow.cone(0.055, 0.15, 4, 0xe0e6ea, 0, 0, 0.38, Math.PI / 2);
  arrow.box(0.13, 0.012, 0.15, 0xf4f1ea, 0, 0, -0.25);
  arrow.box(0.012, 0.13, 0.15, 0xd84b3b, 0, 0, -0.25);
  arrow.box(0.045, 0.045, 0.03, 0x5d4037, 0, 0, -0.31);
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
  /** traces au sol (brûlures, fissures, flaques) et cercles runiques lumineux */
  readonly decals: Decals;
  readonly runes: Decals;
  readonly pillars: Pillars;
  readonly shards: Shards;
  readonly flashes: Flashes;
  private arrows: InstPool;
  private shells: InstPool;
  private rocks: InstPool;
  shots: Shot[] = [];

  constructor(scene: THREE.Object3D) {
    scene.add(this.group);
    this.sparks = new Particles(this.group, false);
    this.glow = new Particles(this.group, true);
    this.beams = new Beams(this.group);
    this.rings = new Rings(this.group);
    this.decals = new Decals(this.group, false);
    this.runes = new Decals(this.group, true, 32);
    this.pillars = new Pillars(this.group);
    this.shards = new Shards(this.group);
    this.flashes = new Flashes(this.group);
    const g = projGeometries();
    this.arrows = new InstPool(g.arrow, 128, this.group, false);
    this.shells = new InstPool(g.shell, 64, this.group, false);
    this.rocks = new InstPool(g.rock, 16, this.group, false);
  }

  burst(x: number, y: number, z: number, n: number, color: number, speed = 3, size = 0.12, life = 0.6, additive = false, grav = -9) {
    const p = additive ? this.glow : this.sparks;
    n = dens(n);
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
    const tp = this.tp;
    this.arrows.begin();
    this.shells.begin();
    this.rocks.begin();
    let w = 0;
    for (const s of this.shots) {
      const t = (tick - s.t0) / s.dur;
      if (t >= 1) {
        // arrivée : petit éclat à l'impact (flèches, carreaux, éclairs magiques)
        if (s.x !== s.sx || s.z !== s.sz) this.hit(s);
        continue;
      }
      this.shots[w++] = s;
      if (t < 0) continue;
      // la cible bouge : on la suit en douceur (pas de saut de trajectoire quand elle change de direction)
      if (s.targetId !== 0xffff && target(s.targetId, tp)) {
        const f = Math.min(1, dt * 20);
        s.tx += (tp.x - s.tx) * f; s.ty += (tp.y - s.ty) * f; s.tz += (tp.z - s.tz) * f;
      }
      const x = s.sx + (s.tx - s.sx) * t;
      const z = s.sz + (s.tz - s.sz) * t;
      const y = s.sy + (s.ty - s.sy) * t + s.arc * 4 * t * (1 - t);
      const px = s.x, py = s.y, pz = s.z;
      s.x = x; s.y = y; s.z = z;
      // tangente exacte de la parabole : orientation stable même à faible vitesse ou image saccadée
      const dx = s.tx - s.sx, dz = s.tz - s.sz, dy = s.ty - s.sy + s.arc * 4 * (1 - 2 * t);
      const yaw = Math.atan2(dx, dz);
      const k = s.kind;
      if (k === 0 || k === 8 || k === 10) {
        // la flèche suit sa trajectoire (montée puis plongée)
        if (dx * dx + dy * dy + dz * dz > 1e-6) this.arrows.pushDir(x, y, z, dx, dy, dz, k === 10 ? 0.8 : 1);
        else this.arrows.push(x, y, z, yaw, 1);
        // sillage d'air : fins traits clairs le long du chemin parcouru depuis l'image précédente
        const seg = Math.hypot(x - px, y - py, z - pz);
        if (seg > 0.02 && seg < 3) {
          const n = Math.min(3, Math.ceil(seg / 0.35));
          for (let q = 0; q < n; q++) {
            const u = q / n;
            this.glow.spawn(px + (x - px) * u, py + (y - py) * u, pz + (z - pz) * u, 0, 0, 0, 0.16, k === 8 ? 0.07 : 0.05, k === 8 ? 0xe8ffd0 : 0xfff6e0, 0);
          }
        }
      } else if (k === 4 || k === 5 || k === 12) {
        this.shells.push(x, y, z, 0, k === 12 ? 0.6 : 1);
        if (k === 5) this.glow.spawn(x, y, z, 0, 0.5, 0, 0.35, 0.2, 0xff8f00, 0);
        else if (Math.random() < 0.4) this.sparks.spawn(x, y, z, 0, 0.3, 0, 0.5, 0.1, 0x9e9e9e, 0);
      } else if (k === 11) {
        // météore : rocher qui tournoie, traînée de feu et de fumée
        this.rocks.push(x, y, z, tick * 0.45, 1.5);
        for (let n = 0; n < 5; n++) this.glow.spawn(x + (Math.random() - 0.5) * 0.9, y + (Math.random() - 0.5) * 0.9, z + (Math.random() - 0.5) * 0.9, -dx * 4, -dy * 4 + 0.5, -dz * 4, 0.35 + Math.random() * 0.3, 0.3 + Math.random() * 0.3, n < 2 ? 0xffd54f : n < 4 ? 0xff6f00 : 0xff3d00, 0);
        if (Math.random() < 0.7) this.sparks.spawn(x, y + 0.4, z, -dx * 2, 0.8, -dz * 2, 1.1, 0.32 + Math.random() * 0.2, 0x3e3e3e, 0.5);
      } else {
        // projectile magique : cœur lumineux + traînée continue (indépendante de la cadence d'images)
        const c = GLOW[k] ?? 0xffffff;
        this.glow.spawn(x, y, z, 0, 0, 0, 0.12, 0.3, c, 0);
        this.glow.spawn(x, y, z, 0, 0, 0, 0.08, 0.15, 0xffffff, 0);
        const seg = Math.hypot(x - px, y - py, z - pz);
        const n = seg > 0.01 && seg < 3 ? Math.min(5, Math.ceil(seg / 0.18)) : 1;
        for (let q = 0; q < n; q++) {
          const u = q / n;
          this.glow.spawn(px + (x - px) * u, py + (y - py) * u, pz + (z - pz) * u, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 0.28, 0.13, c, 0);
        }
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
    this.decals.update(dt);
    this.runes.update(dt);
    this.pillars.update(dt);
    this.shards.update(dt);
    this.flashes.update(dt);
  }

  private tp = { x: 0, y: 0, z: 0 };

  /** Impact d'un projectile direct à son arrivée. */
  private hit(s: Shot) {
    const k = s.kind;
    if (k === 0 || k === 8 || k === 10) {
      this.sparks.spawn(s.x, s.y, s.z, 0, 0.8, 0, 0.25, 0.09, 0xd7ccc8, -6);
      this.burst(s.x, s.y, s.z, 3, 0xfff3e0, 1.5, 0.06, 0.18, true, 0);
    } else if (k === 1 || k === 2 || k === 9 || k === 13) {
      const c = GLOW[k] ?? 0xffffff;
      this.burst(s.x, s.y, s.z, 7, c, 2.2, 0.12, 0.35, true, 0);
      this.glow.spawn(s.x, s.y, s.z, 0, 0, 0, 0.18, 0.5, c, 0);
    }
  }

  // ------------------------------------------------ recettes composées

  /** Onde de choc : mur lumineux qui s'élargit + anneau au sol + poussière rasante. */
  shockwave(x: number, z: number, r: number, c: number, dust = 0x9e8a70, life = 0.5) {
    this.pillars.add(x, 0, z, r * 0.15, r, 0.9, 0.35, life, c, 0);
    this.rings.add(x, z, r * 0.1, r * 1.05, life * 1.1, c);
    const nd = dens(22);
    for (let k = 0; k < nd; k++) {
      const a = (k / nd) * Math.PI * 2;
      const v = r * (2.2 + Math.random() * 1.4);
      this.sparks.spawn(x + Math.cos(a) * 0.3, 0.15, z + Math.sin(a) * 0.3, Math.cos(a) * v, 0.6 + Math.random(), Math.sin(a) * v, 0.45 + Math.random() * 0.3, 0.16 + Math.random() * 0.12, dust, -2);
    }
  }

  /** Colonne de lumière (renforts, sacré, montée de niveau). */
  pillar(x: number, z: number, r: number, h: number, c: number, life = 1, y = 0) {
    this.pillars.add(x, y, z, r * 0.4, r, h * 0.3, h, life, c, 1);
    this.pillars.add(x, y, z, r * 0.15, r * 0.45, h * 0.5, h * 1.3, life * 0.8, 0xffffff, 1.6);
  }

  /** Étincelles qui montent en spirale (soin, sacré, magie). */
  spiral(x: number, z: number, r: number, n: number, c: number, life = 1.1) {
    n = dens(n);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const d = r * (0.4 + Math.random() * 0.6);
      this.glow.spawn(x + Math.cos(a) * d, 0.1 + Math.random() * 0.4, z + Math.sin(a) * d, -Math.sin(a) * 1.4, 1.8 + Math.random() * 2.2, Math.cos(a) * 1.4, life * (0.6 + Math.random() * 0.5), 0.07 + Math.random() * 0.07, c, 0.4);
    }
  }

  /** Débris lourds (rochers) projetés en l'air. */
  debris(x: number, z: number, n: number, c: number, speed = 6) {
    n = dens(n);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.sparks.spawn(x, 0.3, z, Math.cos(a) * v * 0.6, speed * (0.7 + Math.random() * 0.8), Math.sin(a) * v * 0.6, 1 + Math.random() * 0.5, 0.18 + Math.random() * 0.2, c, -16);
    }
  }

  /** Fumée qui monte lentement. */
  smoke(x: number, y: number, z: number, n: number, c = 0x5d5d5d, spread = 1) {
    n = dens(n);
    for (let k = 0; k < n; k++) {
      this.sparks.spawn(x + (Math.random() - 0.5) * spread, y + Math.random() * 0.5, z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.9, 0.25 + Math.random() * 0.25, c, 0.6);
    }
  }
}
