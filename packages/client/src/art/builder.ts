import * as THREE from 'three';

/**
 * Constructeur de modèles low-poly « faits main » : on assemble des primitives
 * colorées (couleurs de sommets), fusionnées en une seule géométrie.
 * Chaque sommet porte un attribut aAnim = (partie, pivot x, pivot y, pivot z)
 * utilisé par le vertex shader pour animer bras, jambes, ailes et végétation.
 */
export const enum Part {
  Body = 0,
  LegL = 1,
  LegR = 2,
  ArmL = 3,
  ArmR = 4,
  WingL = 5,
  WingR = 6,
  Team = 7,
  Sway = 8,
  Spin = 9,
  /** 10, 11 : armes tenues (héros) */
  /** roue, ailes de moulin (rotation autour de z) */
  Wheel = 12,
  /** wagonnet qui entre et sort (le long de z) */
  Cart = 13,
  /** flamme qui vacille */
  Flame = 14,
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

// Géométries de base mises en cache (non indexées)
const baseCache = new Map<string, THREE.BufferGeometry>();
function base(key: string, make: () => THREE.BufferGeometry) {
  let g = baseCache.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    baseCache.set(key, g);
  }
  return g;
}

let seed = 1;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

/** couleur de peau des personnages construits en code */
export const SKIN_COLOR = 0xf2c9a0;

export class GB {
  private pos: number[] = [];
  private col: number[] = [];
  private anim: number[] = [];
  /** sommets de peau (couleur SKIN_COLOR) : teintés par la couleur de peau choisie */
  private skin: number[] = [];
  private part = 0;
  private pivot: [number, number, number] = [0, 0, 0];
  /** variation aléatoire de luminosité par face (aspect peint à la main) */
  jitter = 0.06;
  /** assombrit le bas des objets (occlusion ambiante peinte) */
  ao = true;
  aoHeight = 0.6;

  constructor(s = 1) {
    seed = s;
  }

  setPart(part: number, px = 0, py = 0, pz = 0) {
    this.part = part;
    this.pivot = [px, py, pz];
    return this;
  }

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _s.set(sx, sy, sz);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    const src = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    _c.set(color);
    const skin = _c.getHex() === SKIN_COLOR ? 1 : 0;
    const n = src.count;
    let faceShade = 1;
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) faceShade = 1 + (rand() * 2 - 1) * this.jitter;
      v.fromBufferAttribute(src, i).applyMatrix4(_m);
      this.pos.push(v.x, v.y, v.z);
      let k = faceShade;
      if (this.ao) k *= 0.72 + 0.28 * Math.min(1, Math.max(0, v.y / this.aoHeight));
      this.col.push(_c.r * k, _c.g * k, _c.b * k);
      this.anim.push(this.part, this.pivot[0], this.pivot[1], this.pivot[2]);
      this.skin.push(skin);
    }
    return this;
  }

  box(w: number, h: number, d: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(base('box', () => new THREE.BoxGeometry(1, 1, 1)), c, x, y, z, rx, ry, rz, w, h, d);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = base(`cyl${seg}_${rTop}_${rBot}`, () => new THREE.CylinderGeometry(rTop, rBot, 1, seg, 1));
    return this.add(g, c, x, y, z, rx, ry, rz, 1, h, 1);
  }

  cone(r: number, h: number, seg: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = base(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1));
    return this.add(g, c, x, y, z, rx, ry, rz, r, h, r);
  }

  ball(r: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0) {
    const g = base(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
    return this.add(g, c, x, y, z, 0, 0, 0, r * sx, r * sy, r * sz);
  }

  rock(r: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0) {
    const g = base('dodeca', () => new THREE.DodecahedronGeometry(1, 0));
    return this.add(g, c, x, y, z, 0, ry, 0, r * sx, r * sy, r * sz);
  }

  /** anneau (épaisseur relative au rayon : 0.18) */
  torus(r: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = base(`torus`, () => new THREE.TorusGeometry(1, 0.18, 4, 12));
    return this.add(g, c, x, y, z, rx, ry, rz, r, r, r);
  }

  /** prisme triangulaire (toits) */
  roof(w: number, h: number, d: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, ry = 0) {
    const g = base('roof', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0);
      s.lineTo(0.5, 0);
      s.lineTo(0, 1);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      geo.translate(0, 0, -0.5);
      return geo;
    });
    return this.add(g, c, x, y, z, 0, ry, 0, w, h, d);
  }

  /** extrusion d'une forme 2D (lames, ailes...) dans le plan XY */
  shape(points: [number, number][], depth: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    const key = 'shape' + points.map((p) => p.join(',')).join(';') + depth;
    const g = base(key, () => {
      const sh = new THREE.Shape();
      sh.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) sh.lineTo(points[i][0], points[i][1]);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      return geo;
    });
    return this.add(g, c, x, y, z, rx, ry, rz, s, s, s);
  }

  get vertexCount() {
    return this.pos.length / 3;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aAnim', new THREE.Float32BufferAttribute(this.anim, 4));
    g.setAttribute('aWeight', new THREE.Float32BufferAttribute(new Float32Array(this.pos.length / 3).fill(1), 1));
    g.setAttribute('aSkin', new THREE.Float32BufferAttribute(this.skin, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Couleur plus claire / plus sombre */
export function shade(hex: number, k: number): number {
  _c.set(hex);
  _c.r = Math.min(1, _c.r * k);
  _c.g = Math.min(1, _c.g * k);
  _c.b = Math.min(1, _c.b * k);
  return _c.getHex();
}
