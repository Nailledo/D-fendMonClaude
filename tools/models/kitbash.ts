/**
 * Personnages composés à partir de modèles déjà cuits (même style KayKit que les héros) :
 *   pnpm tsx tools/models/kitbash.ts
 *
 * - recolore des zones choisies par la couleur de leur texture et leur hauteur
 *   (le sommet pointe alors vers le texel le plus blanc de l'atlas et prend la couleur voulue en couleur de sommet,
 *   l'occlusion cuite est conservée) ;
 * - ajoute des accessoires construits ici (couronne, diadème, cape, robe, barbe), partie « corps » de l'animation.
 *
 * Sorties : packages/client/public/models/hero-ethan.glb et hero-roi.glb, référencés dans manifest.json.
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
  cape(cz: number, yTop: number, yBot: number, wTop: number, wBot: number, back: number, col: RGB, inner: RGB, white: [number, number]) {
    const seg = 8, rows = 5, th = 0.025;
    const pt = (s: number, r: number, off: number) => {
      const y = yTop + (yBot - yTop) * r;
      const w = wTop + (wBot - wTop) * r;
      const a = (s - 0.5) * Math.PI * 0.95;
      const x = Math.sin(a) * w;
      const z = cz - Math.cos(a) * (back + r * 0.08) - off - r * r * 0.06;
      return [x, y, z];
    };
    for (let i = 0; i < seg; i++) for (let j = 0; j < rows; j++) {
      const s0 = i / seg, s1 = (i + 1) / seg, r0 = j / rows, r1 = (j + 1) / rows;
      // dessus (extérieur) et dessous (doublure)
      this.quad(pt(s1, r0, th), pt(s1, r1, th), pt(s0, r1, th), pt(s0, r0, th), col, white);
      this.quad(pt(s0, r0, 0), pt(s0, r1, 0), pt(s1, r1, 0), pt(s1, r0, 0), inner, white);
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
  // diadème doré posé sur le haut de la tête, grande pierre bleue sur le devant
  const hr = Math.max(head.w, head.d) / 2;
  const ty = 1.3;
  m.frustum(head.cx, head.cz, ty, ty + 0.06, hr * 0.62, hr * 0.6, 14, GOLD, white, false);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + (k - 3) * 0.36;
    m.spike(head.cx + Math.cos(a) * hr * 0.61, ty + 0.055, head.cz + Math.sin(a) * hr * 0.61, 0.04, k === 3 ? 0.2 : k % 2 ? 0.1 : 0.14, 4, GOLD, white);
  }
  m.gem(head.cx, ty + 0.08, head.cz + hr * 0.64, 0.05, BLUE, white);
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
  const hr = Math.max(head.w, head.d) / 2;
  // couronne : bandeau, fleurons, rubis
  const cy = 1.22;
  m.frustum(head.cx, head.cz, cy, cy + 0.09, hr * 0.7, hr * 0.74, 12, GOLD, white, true);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m.spike(head.cx + Math.cos(a) * hr * 0.72, cy + 0.085, head.cz + Math.sin(a) * hr * 0.72, 0.04, 0.11, 4, GOLD, white);
    if (k % 2 === 0) m.gem(head.cx + Math.cos(a) * hr * 0.75, cy + 0.045, head.cz + Math.sin(a) * hr * 0.75, 0.028, RUBY, white);
  }
  // barbe blanche fournie sous le visage
  const fz = head.z1;
  m.frustum(head.cx, fz - 0.07, hip + 0.38, hip + 0.56, 0.05, hr * 0.62, 8, WHITE, white, true, 1, 0.55);
  m.spike(head.cx, hip + 0.42, fz - 0.03, 0.09, -0.14, 6, WHITE, white);
  // cape rouge doublée d'or, col d'hermine
  const cw = Math.max(chest.w, 0.3) / 2;
  m.cape(chest.cz, hip + 0.42, 0.04, cw * 1.05, cw * 1.6, Math.max(chest.d, 0.2) / 2 * 0.9, RED_D, GOLD, white);
  m.frustum(neck.cx, neck.cz - 0.02, hip + 0.36, hip + 0.44, Math.max(neck.w, 0.24) / 2 * 1.45, Math.max(neck.w, 0.24) / 2 * 1.2, 12, WHITE, white, false);
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * 0.25 + (k / 5) * Math.PI * 1.5;
    m.box(neck.cx + Math.cos(a) * 0.17 - 0.012, hip + 0.39, neck.cz - 0.02 + Math.sin(a) * 0.17 - 0.012, neck.cx + Math.cos(a) * 0.17 + 0.012, hip + 0.42, neck.cz - 0.02 + Math.sin(a) * 0.17 + 0.012, hex(0x222222), white);
  }
});

// ------------------------------------------------------------------ manifeste
const manPath = join(MODELS, 'manifest.json');
const man = JSON.parse(readFileSync(manPath, 'utf8'));
for (const id of ['ethan', 'roi']) man.models[`hero:${id}`] = { file: `hero-${id}.glb`, height: 1.35 };
writeFileSync(manPath, JSON.stringify(man, null, 1) + '\n');
