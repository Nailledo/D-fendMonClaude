/**
 * Personnages composés à partir de modèles déjà cuits (même style KayKit que les héros) :
 *   pnpm tsx tools/models/kitbash.ts
 *
 * - recolore des zones choisies par la couleur de leur texture et leur hauteur
 *   (le sommet pointe alors vers le texel le plus blanc de l'atlas et prend la couleur voulue en couleur de sommet,
 *   l'occlusion cuite est conservée) ;
 * - ajoute des accessoires construits ici (couronne, diadème, cape, robe, barbe), partie « corps » de l'animation.
 *
 * Sorties : packages/client/public/models/hero-ethan.glb, hero-roi.glb et hero-narrateur.glb, référencés dans manifest.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

type RGB = [number, number, number];
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

interface Img { w: number; h: number; data: Uint8Array }
function decode(bytes: Uint8Array, mime: string): Img {
  if (mime === 'image/png') {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { w: p.width, h: p.height, data: p.data };
  }
  const j = jpeg.decode(bytes, { useTArray: true });
  return { w: j.width, h: j.height, data: j.data };
}
function sample(img: Img, u: number, v: number): RGB {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.w)));
  const y = Math.min(img.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.h)));
  const o = (y * img.w + x) * 4;
  return [img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255];
}
function whitest(img: Img): [number, number] {
  let best = -1, bu = 0, bv = 0;
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) {
    const o = (y * img.w + x) * 4;
    const s = img.data[o] + img.data[o + 1] + img.data[o + 2] - Math.abs(img.data[o] - img.data[o + 2]);
    if (s > best) { best = s; bu = (x + 0.5) / img.w; bv = (y + 0.5) / img.h; }
  }
  return [bu, bv];
}
function hsv([r, g, b]: RGB): RGB {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-5) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx > 0 ? d / mx : 0, mx];
}

/** Maillage en cours d'édition (tableaux plats, indexés). */
class Mesh {
  pos: number[]; nrm: number[]; col: number[]; uv: number[]; anim: number[]; weight: number[]; idx: number[];
  constructor(p: Primitive) {
    // getElement dénormalise les attributs quantifiés (UV et couleurs souvent stockés en entiers normalisés)
    const arr = (s: string) => {
      const a = p.getAttribute(s)!;
      const out: number[] = [], e: number[] = new Array(a.getElementSize()).fill(0);
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); out.push(...e); }
      return out;
    };
    this.pos = arr('POSITION'); this.nrm = arr('NORMAL'); this.col = arr('COLOR_0'); this.uv = arr('TEXCOORD_0');
    this.anim = arr('_ANIM'); this.weight = arr('_WEIGHT');
    this.idx = Array.from(p.getIndices()!.getArray() as ArrayLike<number>);
    this.baseTris = this.idx.length / 3;
    // couleurs RGBA éventuelles → RGB
    const n = this.pos.length / 3;
    if (this.col.length === n * 4) this.col = this.col.filter((_, i) => i % 4 !== 3);
  }
  get n() { return this.pos.length / 3; }
  /** zone de hauteur [y0, y1] : étendue horizontale (pour placer les accessoires) */
  slab(y0: number, y1: number) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, c = 0;
    for (let i = 0; i < this.n; i++) {
      const y = this.pos[i * 3 + 1];
      if (y < y0 || y > y1) continue;
      x0 = Math.min(x0, this.pos[i * 3]); x1 = Math.max(x1, this.pos[i * 3]);
      z0 = Math.min(z0, this.pos[i * 3 + 2]); z1 = Math.max(z1, this.pos[i * 3 + 2]);
      c++;
    }
    return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, c };
  }
  /**
   * Lancer de rayon sur les triangles d'origine (Möller–Trumbore) : distance du premier impact, ou -1.
   * Sert à poser les accessoires au contact de la surface (couronne sur les cheveux, barbe sur le visage).
   */
  ray(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxTri = this.baseTris): number {
    let best = -1;
    const P = this.pos;
    for (let t = 0; t < maxTri; t++) {
      const a = this.idx[t * 3] * 3, b = this.idx[t * 3 + 1] * 3, c = this.idx[t * 3 + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-9) continue;
      const inv = 1 / det;
      const tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2];
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (d > 1e-5 && (best < 0 || d < best)) best = d;
    }
    return best;
  }
  /** nombre de triangles du modèle d'origine (les accessoires ajoutés ne comptent pas pour les rayons) */
  baseTris = 0;
  /** rayon de la surface autour de l'axe vertical (cx, cz) à la hauteur y (moyenne sur n directions) */
  radiusAt(cx: number, cz: number, y: number, n = 12) {
    let s = 0, c = 0;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const d = this.ray(cx + dx * 2, y, cz + dz * 2, -dx, 0, -dz);
      if (d > 0) { s += 2 - d; c++; }
    }
    return c ? s / c : 0;
  }
  /** rayon maximal de la surface autour de l'axe vertical à la hauteur y */
  radiusMax(cx: number, cz: number, y: number, n = 24) {
    let r = 0;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const d = this.ray(cx + dx * 2, y, cz + dz * 2, -dx, 0, -dz);
      if (d > 0) r = Math.max(r, 2 - d);
    }
    return r;
  }
  /** étendue des jambes (sans les bras) */
  legs() {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < this.n; i++) {
      const p = this.anim[i * 4];
      if (p !== 1 && p !== 2) continue;
      x0 = Math.min(x0, this.pos[i * 3]); x1 = Math.max(x1, this.pos[i * 3]);
      z0 = Math.min(z0, this.pos[i * 3 + 2]); z1 = Math.max(z1, this.pos[i * 3 + 2]);
    }
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, r: Math.max(x1 - x0, z1 - z0) / 2 };
  }
  /** hauteur du pivot des jambes (hanches) */
  hipY() {
    let s = 0, c = 0;
    for (let i = 0; i < this.n; i++) if (this.anim[i * 4] === 1 || this.anim[i * 4] === 2) { s += this.anim[i * 4 + 2]; c++; }
    return c ? s / c : 0.45;
  }
  /** Recolore les sommets choisis : texel blanc + couleur de sommet (occlusion conservée). */
  recolor(img: Img, white: [number, number], pick: (tex: RGB, h: RGB, x: number, y: number, z: number, part: number) => RGB | null) {
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      const tex = sample(img, this.uv[i * 2], this.uv[i * 2 + 1]);
      const to = pick(tex, hsv(tex), this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], this.anim[i * 4]);
      if (!to) continue;
      // occlusion cuite : luminosité de la couleur de sommet existante, nuance de la texture conservée
      const ao = Math.max(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]);
      const shade = 0.75 + 0.25 * Math.min(1, hsv(tex)[2] / 0.75);
      this.uv[i * 2] = white[0]; this.uv[i * 2 + 1] = white[1];
      for (let c = 0; c < 3; c++) this.col[i * 3 + c] = to[c] * ao * shade;
      k++;
    }
    return k;
  }
  /** Ajoute un triangle à facettes franches (normale par face). */
  private tri(a: number[], b: number[], c: number[], col: RGB, white: [number, number]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    // occlusion peinte : plus sombre vers le bas
    for (const p of [a, b, c]) {
      const i = this.n;
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(nx, ny, nz);
      const ao = 0.72 + 0.28 * Math.min(1, Math.max(0, p[1] / 1.2));
      this.col.push(col[0] * ao, col[1] * ao, col[2] * ao);
      this.uv.push(white[0], white[1]);
      this.anim.push(0, 0, 0, 0);
      this.weight.push(1);
      this.idx.push(i);
    }
  }
  quad(a: number[], b: number[], c: number[], d: number[], col: RGB, white: [number, number]) {
    this.tri(a, b, c, col, white);
    this.tri(a, c, d, col, white);
  }
  /** Tronc de cône fermé (robe, couronne), axe vertical. */
  frustum(cx: number, cz: number, y0: number, y1: number, r0: number, r1: number, seg: number, col: RGB, white: [number, number], cap = true, sx = 1, sz = 1) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const p = (a: number, r: number, y: number) => [cx + Math.cos(a) * r * sx, y, cz + Math.sin(a) * r * sz];
      this.quad(p(a0, r0, y0), p(a0, r1, y1), p(a1, r1, y1), p(a1, r0, y0), col, white);
      if (cap) this.tri([cx, y1, cz], p(a1, r1, y1), p(a0, r1, y1), col, white);
    }
  }
  /** Pointe (pyramide) */
  spike(x: number, y: number, z: number, r: number, h: number, seg: number, col: RGB, white: [number, number]) {
    for (let k = 0; k < seg; k++) {
      let a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      if (h < 0) [a0, a1] = [a1, a0]; // pointe vers le bas : faces retournées
      this.tri([x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x, y + h, z], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], col, white);
    }
  }
  /** Pierre précieuse (octaèdre) */
  gem(x: number, y: number, z: number, r: number, col: RGB, white: [number, number]) {
    const P = [[x + r, y, z], [x, y, z + r], [x - r, y, z], [x, y, z - r]];
    for (let k = 0; k < 4; k++) {
      const a = P[k], b = P[(k + 1) % 4];
      this.tri(a, [x, y + r * 1.3, z], b, col, white);
      this.tri(b, [x, y - r * 1.3, z], a, col, white);
    }
  }
  /** Boîte orientée selon les axes */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: RGB, white: [number, number]) {
    const v = (x: number, y: number, z: number) => [x, y, z];
    this.quad(v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1), col, white); // avant
    this.quad(v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), col, white); // arrière
    this.quad(v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0), col, white);
    this.quad(v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), col, white);
    this.quad(v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y1, z0), col, white);
    this.quad(v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), col, white);
  }
  /** Cape : coque épaisse incurvée derrière le corps, des épaules jusqu'au sol, évasée vers le bas. */
  /**
   * Cape : coque épaisse qui part du haut du dos et tombe jusqu'au sol en s'évasant.
   * Chaque colonne suit la surface du dos mesurée par un rayon tiré de derrière : le haut est collé au corps,
   * et plus bas la cape ne s'en écarte que de ce qu'il faut pour ne jamais le traverser.
   */
  cape(cx: number, yTop: number, yBot: number, wTop: number, wBot: number, col: RGB, inner: RGB, white: [number, number]) {
    const seg = 10, rows = 7, th = 0.025, gap = 0.012;
    const backZ = (x: number, y: number) => { const d = this.ray(x, y, -2, 0, 0, 1); return d > 0 ? -2 + d : NaN; };
    const grid: number[][][] = [];
    for (let j = 0; j <= rows; j++) {
      const r = j / rows, y = yTop + (yBot - yTop) * r;
      const row: number[][] = [];
      for (let i = 0; i <= seg; i++) {
        const u = (i / seg) * 2 - 1;
        const x = cx + u * (wTop + (wBot - wTop) * r);
        // en haut : collée au dos ; vers le bas : elle ne fait que reculer (chute régulière, jamais dans le corps)
        const top = backZ(cx + u * wTop, yTop);
        let z = (Number.isNaN(top) ? -0.2 : top) - gap - r * r * 0.1 - Math.abs(u) * r * 0.04;
        const here = backZ(x, y);
        if (!Number.isNaN(here)) z = Math.min(z, here - gap * 2);
        if (j > 0) z = Math.min(z, grid[j - 1][i][2]);
        row.push([x, y, z]);
      }
      grid.push(row);
    }
    // lissage horizontal sous la première rangée (le tissu ne suit pas chaque facette du dos)
    for (let j = 1; j <= rows; j++) {
      const zs = grid[j].map((g) => g[2]);
      for (let i = 0; i <= seg; i++) {
        const a = zs[Math.max(0, i - 1)], b = zs[i], c = zs[Math.min(seg, i + 1)];
        grid[j][i][2] = Math.min(b, (a + 2 * b + c) / 4);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rows; j++) {
      const p = (jj: number, ii: number, off: number) => { const g = grid[jj][ii]; return [g[0], g[1], g[2] - off]; };
      // extérieur (rouge, tourné vers l'arrière) et doublure (or, tournée vers le corps)
      this.quad(p(j, i + 1, th), p(j + 1, i + 1, th), p(j + 1, i, th), p(j, i, th), col, white);
      this.quad(p(j, i, 0), p(j + 1, i, 0), p(j + 1, i + 1, 0), p(j, i + 1, 0), inner, white);
      // tranches latérales et bas
      if (i === 0) this.quad(p(j, 0, th), p(j + 1, 0, th), p(j + 1, 0, 0), p(j, 0, 0), inner, white);
      if (i === seg - 1) this.quad(p(j, seg, 0), p(j + 1, seg, 0), p(j + 1, seg, th), p(j, seg, th), inner, white);
      if (j === rows - 1) this.quad(p(rows, i, 0), p(rows, i + 1, 0), p(rows, i + 1, th), p(rows, i, th), col, white);
    }
  }
  /**
   * Barbe : coque posée sur le bas du visage (points mesurés par des rayons de face), plus épaisse au menton,
   * prolongée en pointe sous le menton ; moustache en deux mèches sous le nez.
   */
  beard(hx: number, yTop: number, yChin: number, yTip: number, bx: number, col: RGB, white: [number, number]) {
    const cols = 7, rows = Math.max(6, Math.round((yTop - yTip) / 0.04));
    const grid: number[][][] = [];
    let lastZ = 0.2;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, y = yTop + (yTip - yTop) * t;
      const row: number[][] = [];
      for (let i = 0; i <= cols; i++) {
        const u = (i / cols) * 2 - 1;
        // la barbe se resserre en pointe vers le bas, et s'affine près du nez
        const x = hx + u * bx * (1 - Math.max(0, (yChin - y) / (yChin - yTip)) * 0.75) * Math.min(1, 0.8 + (yTop - y) * 4);
        const d = this.ray(x, y, 2, 0, 0, -1);
        // sous le menton le rayon touche le torse : on prolonge la surface du visage
        let z = d > 0 ? 2 - d : lastZ;
        if (y < yChin) z = Math.max(z, lastZ - 0.02);
        if (Math.abs(u) < 0.2) lastZ = z;
        const thick = 0.025 + Math.max(0, Math.min(1, (yTop - y) / (yTop - yChin))) * 0.06 * (1 - u * u * 0.6);
        row.push([x, y, z - 0.03, z + thick]);
      }
      grid.push(row);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const p = (jj: number, ii: number, outer: boolean) => { const g = grid[jj][ii]; return [g[0], g[1], outer ? g[3] : g[2]]; };
      this.quad(p(j, i, true), p(j + 1, i, true), p(j + 1, i + 1, true), p(j, i + 1, true), col, white);
      if (i === 0) this.quad(p(j, 0, false), p(j + 1, 0, false), p(j + 1, 0, true), p(j, 0, true), col, white);
      if (i === cols - 1) this.quad(p(j, cols, true), p(j + 1, cols, true), p(j + 1, cols, false), p(j, cols, false), col, white);
      if (j === rows - 1) this.quad(p(rows, i, false), p(rows, i + 1, false), p(rows, i + 1, true), p(rows, i, true), col, white);
    }
    for (const sgn of [-1, 1]) {
      const y = yTop - 0.005, x = hx + sgn * 0.045;
      const d = this.ray(x, y, 2, 0, 0, -1);
      const z = d > 0 ? 2 - d : 0.25;
      this.box(Math.min(x, x + sgn * 0.075), y - 0.03, z - 0.03, Math.max(x, x + sgn * 0.075), y + 0.015, z + 0.03, col, white);
    }
  }
  write(p: Primitive, doc: import('@gltf-transform/core').Document) {
    const buf = doc.getRoot().listBuffers()[0];
    const acc = (type: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', a: number[]) => doc.createAccessor().setType(type).setArray(new Float32Array(a)).setBuffer(buf);
    p.setAttribute('POSITION', acc('VEC3', this.pos));
    p.setAttribute('NORMAL', acc('VEC3', this.nrm));
    p.setAttribute('COLOR_0', acc('VEC3', this.col));
    p.setAttribute('TEXCOORD_0', acc('VEC2', this.uv));
    p.setAttribute('_ANIM', acc('VEC4', this.anim));
    p.setAttribute('_WEIGHT', acc('SCALAR', this.weight));
    p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(this.idx)).setBuffer(buf));
  }
}

async function make(src: string, dst: string, edit: (m: Mesh, img: Img, white: [number, number]) => void) {
  const doc = await io.read(join(MODELS, src));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const tex = doc.getRoot().listTextures()[0];
  const img = decode(tex.getImage()!, tex.getMimeType());
  const white = whitest(img);
  const m = new Mesh(prim);
  edit(m, img, white);
  m.write(prim, doc);
  for (const a of doc.getRoot().listAccessors()) if (!a.listParents().some((p) => p.propertyType !== 'Root')) a.dispose();
  doc.getRoot().listNodes()[0].setName(dst.replace('.glb', '').replace('-', ':'));
  await io.write(join(MODELS, dst), doc);
  console.log(`${dst} : ${m.n} sommets, ${m.idx.length / 3} triangles`);
}

// ------------------------------------------------------------------ Princesse Ethan (base : Lyra, rôdeuse)
await make('hero-lyra.glb', 'hero-ethan.glb', (m, img, white) => {
  const PINK = hex(0xf06aa8), PINK_D = hex(0xc8427f), BLOND = hex(0xf5c451), GOLD = hex(0xf2b33d), BLUE = hex(0x5ab4ff), WHITE = hex(0xfff3f8);
  const hip = m.hipY();
  // tunique verte → rose ; cheveux auburn → blonds ; bottes/ceinture sombres → rose foncé
  console.log('  hanches', hip.toFixed(2));
  m.recolor(img, white, (tex, [h, s, v], _x, y) => {
    // tunique (verts, du clair au sombre)
    if (h > 80 && h < 200 && s > 0.3 && y < 0.85) return PINK;
    // cheveux auburn (la peau, plus claire et moins saturée, est épargnée)
    if (y > 0.7 && h < 35 && s > 0.45 && v < 0.8 && v > 0.3) return BLOND;
    // ceinture, gants, bottes
    if (y < 0.75 && h < 35 && s > 0.4 && v < 0.6) return PINK_D;
    return null;
  });
  const head = m.slab(1.0, 1.25), lg = m.legs();
  // longue robe en cloche qui couvre les jambes (et les cache pendant la marche)
  const rw = lg.r + 0.03;
  m.frustum(lg.cx, lg.cz, 0.03, hip + 0.12, rw * 1.45, rw * 0.95, 14, PINK, white, false);
  m.frustum(lg.cx, lg.cz, 0.0, 0.07, rw * 1.5, rw * 1.45, 14, WHITE, white, false);
  m.frustum(lg.cx, lg.cz, hip + 0.08, hip + 0.14, rw * 1.0, rw * 0.97, 14, GOLD, white, false);
  // diadème doré posé sur les cheveux (hauteur et rayon mesurés), grande pierre bleue sur le devant
  const tTop = 2 - m.ray(head.cx, 2, head.cz, 0, -1, 0);
  const ty = tTop - 0.1, tr = m.radiusAt(head.cx, head.cz, ty) * 0.98;
  console.log('  diadème', ty.toFixed(3), tr.toFixed(3));
  m.frustum(head.cx, head.cz, ty, ty + 0.07, tr, tr * 1.04, 16, GOLD, white, false);
  m.frustum(head.cx, head.cz, ty, ty + 0.07, tr * 0.9, tr * 0.96, 16, hex(0xc9871e), white, false);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + (k - 3) * 0.36;
    m.spike(head.cx + Math.cos(a) * tr * 1.02, ty + 0.06, head.cz + Math.sin(a) * tr * 1.02, 0.04, k === 3 ? 0.2 : k % 2 ? 0.1 : 0.14, 4, GOLD, white);
  }
  m.gem(head.cx, ty + 0.06, head.cz + tr * 1.07, 0.05, BLUE, white);
});

// ------------------------------------------------------------------ Le roi Gontran (base : milicien)
await make('soldier-0.glb', 'hero-roi.glb', (m, img, white) => {
  const RED = hex(0xb3262e), RED_D = hex(0x7d1a22), GOLD = hex(0xf2b33d), WHITE = hex(0xf5f2ea), GREY = hex(0xdcd9d2), RUBY = hex(0xe0233a), PURPLE = hex(0x5b2a86);
  const hip = m.hipY();
  // cheveux bruns → blancs, foulard bleu → or, chemise claire → rouge royal, bas → violet
  console.log('  hanches', hip.toFixed(2));
  m.recolor(img, white, (tex, [h, s, v], _x, y) => {
    // foulard bleu → or
    if (h > 180 && h < 250 && s > 0.3) return GOLD;
    // cheveux bruns → blanc argenté (la peau est plus claire et moins saturée)
    if (y > 0.8 && h < 35 && s > 0.45 && v < 0.8) return GREY;
    // chemise claire → rouge royal
    if (y > hip - 0.05 && y < 0.8 && s < 0.32 && v > 0.7) return RED;
    // gilet et pantalon bruns → rouge sombre en haut, violet en bas
    if (y < 0.8 && h < 45 && s > 0.2 && v < 0.65) return y > hip ? RED_D : PURPLE;
    return null;
  });
  const head = m.slab(1.0, 1.25), neck = m.slab(hip + 0.32, hip + 0.42), chest = m.slab(hip + 0.1, hip + 0.35);
  // sommet du crâne (cheveux) mesuré par un rayon vertical
  const hx = head.cx, hz = head.cz;
  const topY = 2 - m.ray(hx, 2, hz, 0, -1, 0);
  // couronne : sa base épouse les cheveux (rayon mesuré à cette hauteur), elle s'évase vers le haut
  const yb = topY - 0.11, rb = m.radiusAt(hx, hz, yb) * 0.97;
  const yt = yb + 0.13;
  console.log('  crâne', topY.toFixed(3), 'couronne r', rb.toFixed(3));
  m.frustum(hx, hz, yb, yt, rb, rb * 1.08, 14, GOLD, white, false);
  m.frustum(hx, hz, yb, yt, rb * 0.92, rb * 1.0, 14, hex(0xc9871e), white, false);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m.spike(hx + Math.cos(a) * rb * 1.06, yt - 0.01, hz + Math.sin(a) * rb * 1.06, 0.045, k % 2 ? 0.08 : 0.12, 4, GOLD, white);
    if (k % 2 === 0) m.gem(hx + Math.cos(a) * rb * 1.1, yb + 0.06, hz + Math.sin(a) * rb * 1.1, 0.03, RUBY, white);
  }
  // barbe et moustache posées sur le visage
  m.beard(hx, 0.86, 0.72, 0.6, 0.15, WHITE, white);
  // col d'hermine : anneau qui épouse le haut du torse (rayon maximal mesuré à chaque hauteur), recouvre le foulard
  const ncx = neck.cx, ncz = neck.cz;
  const levels = [0.6, 0.66, 0.72, 0.77];
  const radii = levels.map((y) => m.radiusMax(ncx, ncz, y) + 0.025);
  console.log('  col', radii.map((r) => r.toFixed(3)).join(' '));
  for (let k = 0; k < levels.length - 1; k++) m.frustum(ncx, ncz, levels[k], levels[k + 1], radii[k], radii[k + 1], 16, WHITE, white, false);
  // dessus du col : rebord qui rentre vers le cou
  m.frustum(ncx, ncz, levels[3], levels[3] + 0.02, radii[3], radii[3] * 0.75, 16, WHITE, white, false);
  // cape rouge doublée d'or, col d'hermine
  const cw = Math.max(chest.w, 0.3) / 2;
  m.cape(chest.cx, 0.72, 0.04, cw * 1.0, cw * 1.55, RED_D, GOLD, white);
  // mouchetures noires de l'hermine, posées sur le col
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * 0.15 + (k / 8) * Math.PI * 1.7, y = k % 2 ? 0.7 : 0.65;
    const r = (k % 2 ? radii[2] : radii[1]) + 0.004;
    const x = ncx + Math.cos(a) * r, z = ncz + Math.sin(a) * r;
    m.box(x - 0.014, y - 0.02, z - 0.014, x + 0.014, y + 0.02, z + 0.014, hex(0x222222), white);
  }
});


// ------------------------------------------------------------------ Le narrateur (base : Nox, mage)
await make('hero-nox.glb', 'hero-narrateur.glb', (m, img, white) => {
  const ROBE = hex(0x1f3f7a), ROBE_D = hex(0x142a55), GOLD = hex(0xf2b33d), WHITE = hex(0xf2efe8), STAR = hex(0xffe27a);
  // robe et chapeau violets → bleu nuit, bandeau orange → or, cheveux noirs → blancs
  m.recolor(img, white, (tex, [h, s, v], _x, y) => {
    // cheveux (sombres, autour du visage, sous le bord du chapeau)
    // (gris ou violacés ; le dessous du chapeau, au-dessus, reste sombre)
    if (y > 0.5 && y < 0.98 && v < 0.42 && (s < 0.45 || (h > 265 && h < 335))) return WHITE;
    if (y >= 0.98 && v < 0.42) return ROBE_D;
    if (h > 200 && h < 290 && s > 0.15 && v < 0.65) return v < 0.35 ? ROBE_D : ROBE;
    // cape magenta du mage → bleu nuit
    if (h > 285 && h < 350 && s > 0.2) return ROBE_D;
    if (h > 15 && h < 45 && s > 0.55 && v > 0.6 && y > 0.3) return GOLD;
    return null;
  });
  // repère du visage : la peau la plus en avant entre les yeux et le menton
  const head = m.slab(0.75, 1.0);
  let faceY = 0.9, bestZ = -9;
  for (let y = 0.7; y <= 1.0; y += 0.01) { const d = m.ray(head.cx, y, 2, 0, 0, -1); if (d > 0 && 2 - d > bestZ) { bestZ = 2 - d; faceY = y; } }
  console.log('  visage', faceY.toFixed(2), bestZ.toFixed(3));
  // longue barbe de conteur, jusqu'à la ceinture
  m.beard(head.cx, faceY - 0.07, faceY - 0.2, 0.36, 0.16, WHITE, white);
  // étoiles dorées brodées sur la robe (posées sur la surface par des rayons)
  const stars: [number, number][] = [[-0.12, 0.3], [0.1, 0.22], [0.15, 0.42], [-0.17, 0.48], [0.02, 0.15]];
  for (const [x, y] of stars) {
    const d = m.ray(head.cx + x, y, 2, 0, 0, -1);
    if (d > 0) m.gem(head.cx + x, y, 2 - d + 0.01, 0.028, STAR, white);
  }
});

// ------------------------------------------------------------------ manifeste
const manPath = join(MODELS, 'manifest.json');
const man = JSON.parse(readFileSync(manPath, 'utf8'));
for (const id of ['ethan', 'roi', 'narrateur']) man.models[`hero:${id}`] = { file: `hero-${id}.glb`, height: 1.35 };
writeFileSync(manPath, JSON.stringify(man, null, 1) + '\n');
