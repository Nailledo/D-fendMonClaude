/**
 * Machines de guerre : découpe les modèles cuits en pièces mobiles animées par le shader.
 *   pnpm models:machines
 * À relancer après `pnpm models:bake` ou `import-free.ts`, qui réécrivent ces fichiers sans leurs pièces.
 *
 * Parties (attribut _ANIM.x, voir render/materials.ts) :
 *   12 tête orientable (pivote vers la cible avec tout ce qu'elle porte),
 *   13 / 14 canon droit (+x) / gauche (-x) : recul le long de -z quand il tire,
 *   15 bras de catapulte : bascule autour de son moyeu (pivot dans _ANIM.yzw).
 *
 * Les pièces du kit Kenney sont des îlots de triangles séparés (socle, montants, axe, bras, godet) :
 * on les reconnaît par leur boîte englobante, mesurée sur les modèles cuits (hauteurs normalisées).
 *
 * - Artillerie (niveaux 0 à 2) : catapulte. Les niveaux 1 et 2 portaient un canon ; on y pose la catapulte
 *   du niveau 0, mise à l'échelle de leur plateau. Le bras est raccourci à l'avant pour rester dans son moyeu
 *   quand il bascule (sinon il traverserait le plateau).
 * - Mortier à flammes (niveau 3, baliste) : tête orientable, glissière qui recule.
 * - Canon tesla (niveau 4) et tourelle de l'artificier (soldier-7) : double canon, chaque canon recule seul.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Document, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

export const PART_HEAD = 12, PART_BARREL_R = 13, PART_BARREL_L = 14, PART_ARM = 15;

type V3 = [number, number, number];
interface Island { verts: number[]; tris: number[]; mn: V3; mx: V3 }

/** Maillage à plat (indexé) d'un modèle cuit. */
class Mesh {
  pos: number[] = []; nrm: number[] = []; col: number[] = []; uv: number[] = []; anim: number[] = []; weight: number[] = []; idx: number[] = [];
  static from(p: Primitive) {
    const m = new Mesh();
    const arr = (s: string, size: number) => {
      const a = p.getAttribute(s);
      const out: number[] = [];
      if (!a) return out;
      const e: number[] = new Array(a.getElementSize()).fill(0);
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); for (let k = 0; k < size; k++) out.push(e[k] ?? 0); }
      return out;
    };
    m.pos = arr('POSITION', 3); m.nrm = arr('NORMAL', 3); m.col = arr('COLOR_0', 3); m.uv = arr('TEXCOORD_0', 2);
    m.anim = arr('_ANIM', 4); m.weight = arr('_WEIGHT', 1);
    const n = m.n;
    if (m.anim.length !== n * 4) m.anim = new Array(n * 4).fill(0);
    if (m.weight.length !== n) m.weight = new Array(n).fill(1);
    if (m.col.length !== n * 3) m.col = new Array(n * 3).fill(1);
    m.idx = Array.from(p.getIndices()!.getArray() as ArrayLike<number>);
    return m;
  }
  get n() { return this.pos.length / 3; }
  /** Îlots de triangles connectés (sommets soudés par position : les coutures d'UV ne coupent pas une pièce). */
  islands(): Island[] {
    const n = this.n;
    const par = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x])));
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(this.pos[i * 3] * 1e4)},${Math.round(this.pos[i * 3 + 1] * 1e4)},${Math.round(this.pos[i * 3 + 2] * 1e4)}`;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else par[find(i)] = find(j);
    }
    for (let t = 0; t < this.idx.length; t += 3) {
      par[find(this.idx[t + 1])] = find(this.idx[t]);
      par[find(this.idx[t + 2])] = find(this.idx[t]);
    }
    const by = new Map<number, Island>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      let isl = by.get(r);
      if (!isl) by.set(r, (isl = { verts: [], tris: [], mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }));
      isl.verts.push(i);
      for (let k = 0; k < 3; k++) {
        isl.mn[k] = Math.min(isl.mn[k], this.pos[i * 3 + k]);
        isl.mx[k] = Math.max(isl.mx[k], this.pos[i * 3 + k]);
      }
    }
    for (let t = 0; t < this.idx.length; t += 3) by.get(find(this.idx[t]))!.tris.push(t);
    return [...by.values()].sort((a, b) => a.mn[1] - b.mn[1] || a.mn[0] - b.mn[0]);
  }
  /** Copie des îlots choisis (sommets renumérotés). */
  pick(list: Island[]): Mesh {
    const out = new Mesh();
    const map = new Map<number, number>();
    for (const isl of list) {
      for (const v of isl.verts) {
        map.set(v, out.n);
        out.pos.push(...this.pos.slice(v * 3, v * 3 + 3));
        out.nrm.push(...this.nrm.slice(v * 3, v * 3 + 3));
        out.col.push(...this.col.slice(v * 3, v * 3 + 3));
        out.uv.push(...this.uv.slice(v * 2, v * 2 + 2));
        out.anim.push(...this.anim.slice(v * 4, v * 4 + 4));
        out.weight.push(this.weight[v]);
      }
      for (const t of isl.tris) for (let k = 0; k < 3; k++) out.idx.push(map.get(this.idx[t + k])!);
    }
    return out;
  }
  append(o: Mesh) {
    const base = this.n;
    this.pos.push(...o.pos); this.nrm.push(...o.nrm); this.col.push(...o.col); this.uv.push(...o.uv);
    this.anim.push(...o.anim); this.weight.push(...o.weight);
    for (const i of o.idx) this.idx.push(i + base);
  }
  /** Échelle uniforme autour de l'axe vertical, puis translation verticale. */
  place(s: number, dy: number) {
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] *= s;
      this.pos[i * 3 + 1] = this.pos[i * 3 + 1] * s + dy;
      this.pos[i * 3 + 2] *= s;
    }
  }
  setPart(verts: Iterable<number>, part: number, pivot: V3 = [0, 0, 0]) {
    for (const v of verts) {
      this.anim[v * 4] = part;
      this.anim[v * 4 + 1] = pivot[0]; this.anim[v * 4 + 2] = pivot[1]; this.anim[v * 4 + 3] = pivot[2];
      this.weight[v] = 1;
    }
  }
  write(p: Primitive, doc: Document) {
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

const W = (i: Island, k: number) => i.mx[k] - i.mn[k];
const C = (i: Island, k: number) => (i.mx[k] + i.mn[k]) / 2;

async function open(file: string) {
  const doc = await io.read(join(MODELS, file));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  return { doc, prim, mesh: Mesh.from(prim) };
}
async function save(file: string, doc: Document, prim: Primitive, m: Mesh) {
  m.write(prim, doc);
  for (const a of doc.getRoot().listAccessors()) if (!a.listParents().some((p) => p.propertyType !== 'Root')) a.dispose();
  const key = file.replace('.glb', '').replace(/^(tower|soldier)-/, '$1:');
  doc.getRoot().listNodes()[0].setName(key);
  await io.write(join(MODELS, file), doc);
}

/** Îlots de l'arme : posés sur (ou au-dessus de) son plateau à la hauteur `floor`. */
function weaponOf(isl: Island[], floor: number) {
  const w = isl.filter((i) => i.mn[1] >= floor - 0.005);
  const plate = w.find((i) => Math.abs(i.mn[1] - floor) < 0.01 && Math.abs(C(i, 0)) < 0.05 && Math.abs(C(i, 2)) < 0.05);
  if (!plate) throw new Error(`plateau introuvable à y = ${floor}`);
  return { w, plate };
}

// ------------------------------------------------------------------ catapulte de référence (niveau 0)
const CATA_FLOOR = 1.2;
const cat = await open('tower-3-0.glb');
const catIsl = cat.mesh.islands();
const { w: cataIsl, plate: cataPlate } = weaponOf(catIsl, CATA_FLOOR);
// godet (entièrement à l'arrière), poutre (longue et fine selon z), moyeu (bloc centré sur l'axe, au-dessus des montants)
const bowl = cataIsl.find((i) => i.mx[2] < -0.1 && W(i, 0) > 0.6);
const beam = cataIsl.find((i) => W(i, 2) > 0.6 && W(i, 0) < 0.4 && i.mn[2] < -0.2);
const hub = cataIsl.find((i) => i !== beam && W(i, 0) < 0.5 && i.mn[2] > -0.2 && i.mx[2] < 0.5 && i.mn[1] > CATA_FLOOR + 0.5);
if (!bowl || !beam || !hub) throw new Error('catapulte : godet, poutre ou moyeu introuvable');
// le bras pivote au centre du moyeu, à la hauteur de la poutre
const hubFront = hub.mx[2];
for (const v of beam.verts) if (cat.mesh.pos[v * 3 + 2] > hubFront - 0.04) cat.mesh.pos[v * 3 + 2] = hubFront - 0.04;
const pivot0: V3 = [0, C(beam, 1), C(hub, 2)];
const armIsl = [bowl, beam, hub];

/** Marque la catapulte (îlots `w`) d'un maillage : tête + bras, pivot mis à l'échelle. */
function rigCatapult(m: Mesh, w: Island[], arm: Island[], pivot: V3) {
  for (const i of w) m.setPart(i.verts, PART_HEAD);
  for (const i of arm) m.setPart(i.verts, PART_ARM, pivot);
}

const man = JSON.parse(readFileSync(join(MODELS, 'manifest.json'), 'utf8'));
function meta(key: string, m: Mesh, muzzleY: number) {
  const e = man.models[key];
  if (!e) return;
  e.tris = m.idx.length / 3;
  e.muzzleY = Math.round(muzzleY * 100) / 100;
}
/** hauteur du godet au lâcher (bras quasi vertical) */
const releaseY = (pv: V3, s: number) => pv[1] + Math.hypot(C(bowl, 1) - pivot0[1], C(bowl, 2) - pivot0[2]) * s;

// niveau 0 : catapulte d'origine
for (const i of catIsl) if (!cataIsl.includes(i)) cat.mesh.setPart(i.verts, 0);
rigCatapult(cat.mesh, cataIsl, armIsl, pivot0);
await save('tower-3-0.glb', cat.doc, cat.prim, cat.mesh);
meta('tower:3-0', cat.mesh, releaseY(pivot0, 1));
console.log('tower-3-0.glb : catapulte, pivot', pivot0.map((v) => v.toFixed(2)).join(' '));

// niveaux 1 et 2 : on retire leur arme et on pose la catapulte à l'échelle de leur plateau
const plateHalf = W(cataPlate, 0) / 2;
for (const [file, floor] of [['tower-3-1.glb', 1.83], ['tower-3-2.glb', 2.36]] as const) {
  const t = await open(file);
  const isl = t.mesh.islands();
  const { w, plate } = weaponOf(isl, floor);
  const s = W(plate, 0) / 2 / plateHalf;
  const keep = t.mesh.pick(isl.filter((i) => !w.includes(i)));
  keep.setPart(Array.from({ length: keep.n }, (_, i) => i), 0);
  const c = cat.mesh.pick(cataIsl);
  // repères des pièces du bras dans la copie : mêmes îlots, dans le même ordre
  const ci = c.islands();
  c.place(s, floor - CATA_FLOOR * s);
  const pv: V3 = [0, pivot0[1] * s + floor - CATA_FLOOR * s, pivot0[2] * s];
  const near = (a: Island) => ci.find((b) => Math.abs(b.mn[0] - a.mn[0]) < 1e-3 && Math.abs(b.mn[1] - a.mn[1]) < 1e-3 && Math.abs(b.mn[2] - a.mn[2]) < 1e-3)!;
  rigCatapult(c, ci, armIsl.map(near), pv);
  keep.append(c);
  await save(file, t.doc, t.prim, keep);
  meta(`tower:${file.slice(6, 9)}`, keep, releaseY(pv, s));
  console.log(`${file} : catapulte à l'échelle ${s.toFixed(3)}, pivot`, pv.map((v) => v.toFixed(2)).join(' '));
}

// ------------------------------------------------------------------ têtes à canons
/**
 * Tête orientable à partir de `floor` ; canons = îlots à l'avant (z > front), droite/gauche selon x.
 * `single` : une seule pièce qui recule (glissière de baliste), toujours en partie 13.
 */
async function rigGun(file: string, key: string, floor: number, front: number, single = false) {
  const t = await open(file);
  const isl = t.mesh.islands();
  let guns = 0, muzzleY = 0;
  for (const i of isl) {
    if (i.mn[1] < floor - 0.005) { t.mesh.setPart(i.verts, 0); continue; }
    const gun = single ? W(i, 2) > 1.5 : i.mn[2] > front;
    t.mesh.setPart(i.verts, gun ? (single || C(i, 0) > 0 ? PART_BARREL_R : PART_BARREL_L) : PART_HEAD);
    if (gun) { guns++; muzzleY = C(i, 1); }
  }
  if (!guns) throw new Error(`${file} : aucun canon trouvé`);
  await save(file, t.doc, t.prim, t.mesh);
  meta(key, t.mesh, muzzleY);
  console.log(`${file} : tête dès y = ${floor}, ${guns} canon(s)`);
}

await rigGun('tower-3-3.glb', 'tower:3-3', 2.4, 0, true);
await rigGun('tower-3-4.glb', 'tower:3-4', 3.24, 0.15);
await rigGun('soldier-7.glb', 'soldier:7', 0.56, 0.2);

writeFileSync(join(MODELS, 'manifest.json'), JSON.stringify(man, null, 1) + '\n');
