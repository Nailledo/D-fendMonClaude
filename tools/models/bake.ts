/**
 * Cuisson des modèles 3D générés (Higgsfield / Meshy) vers le format du jeu :
 *   pnpm models:bake            -> tous les modèles présents dans assets/models-src/
 *   pnpm models:bake enemy:     -> seulement les clés qui commencent par « enemy: »
 *
 * Pour chaque entrée du catalogue dont le GLB source existe :
 *  1. fusion de tous les maillages (pose de repos si le modèle est riggé),
 *  2. attribution d'une partie animée par sommet (jambes, bras, ailes, balancement)
 *     avec un poids de fondu pour éviter les déchirures aux articulations,
 *  3. soudure puis décimation (meshoptimizer) au budget de triangles,
 *  4. normalisation : pieds à y = 0, centré, hauteur du catalogue, regard vers +Z,
 *  5. texture unique réduite en JPEG (sinon couleurs cuites dans les sommets),
 *  6. occlusion ambiante peinte dans les couleurs de sommets,
 *  7. écriture d'un GLB compact dans packages/client/public/models/ + manifest.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, type Node as GNode, type Primitive, type Texture as GTexture } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { CATALOG, type AnimMode, type CatalogEntry } from './catalog';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'assets/models-src');
const OUT = join(ROOT, 'packages/client/public/models');
const filter = process.argv[2] ?? '';

// Parties animées (voir packages/client/src/art/builder.ts)
const enum Part { Body = 0, LegL = 1, LegR = 2, ArmL = 3, ArmR = 4, WingL = 5, WingR = 6, Sway = 8 }

type Mat4 = number[];
interface Img { w: number; h: number; data: Uint8Array }

interface RawMesh {
  pos: Float32Array;
  nrm: Float32Array | null;
  uv: Float32Array | null;
  col: Float32Array; // rgb par sommet (facteur matériau, texture cuite si nécessaire)
  part: Float32Array;
  weight: Float32Array;
  pivot: Float32Array; // xyz par sommet
  idx: Uint32Array;
  texture: GTexture | null;
}

// ------------------------------------------------------------------ maths
function mulM(a: Mat4, b: Mat4): Mat4 {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function xfP(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}
function xfN(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ images
function decode(tex: GTexture): Img | null {
  const buf = Buffer.from(tex.getImage()!);
  const mime = tex.getMimeType();
  try {
    if (mime === 'image/png') {
      const p = PNG.sync.read(buf);
      return { w: p.width, h: p.height, data: new Uint8Array(p.data) };
    }
    if (mime === 'image/jpeg') {
      const j = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
      return { w: j.width, h: j.height, data: j.data };
    }
  } catch (e) {
    console.warn('  texture illisible :', (e as Error).message);
  }
  console.warn(`  texture ${mime} non prise en charge (PNG ou JPEG attendu)`);
  return null;
}
function sample(img: Img, u: number, v: number): [number, number, number] {
  u -= Math.floor(u); v -= Math.floor(v);
  const x = Math.min(img.w - 1, Math.floor(u * img.w)), y = Math.min(img.h - 1, Math.floor(v * img.h));
  const o = (y * img.w + x) * 4;
  return [img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255];
}
/** Texture découpée (feuillage, herbe) : une part notable de pixels transparents. */
function isCutout(img: Img): boolean {
  let t = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 128) t++;
  return t > (img.data.length / 4) * 0.02;
}
function resize(img: Img, max: number): Img {
  const k = Math.max(1, Math.ceil(Math.max(img.w, img.h) / max));
  if (k === 1) return img;
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // moyenne pondérée par l'alpha : les pixels transparents ne salissent pas les bords des feuillages
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const o = ((y * k + dy) * img.w + x * k + dx) * 4, al = img.data[o + 3];
      r += img.data[o] * al; g += img.data[o + 1] * al; b += img.data[o + 2] * al; a += al;
    }
    const o = (y * w + x) * 4, d = a || 1;
    out[o] = r / d; out[o + 1] = g / d; out[o + 2] = b / d; out[o + 3] = a / (k * k);
  }
  return { w, h, data: out };
}

// ------------------------------------------------------------------ extraction
function partOfJoint(name: string): Part {
  const n = name.toLowerCase().replace(/[^a-z_.]/g, '');
  const left = /(^|[_.:])l([_.]|$)|left|\.l$|_l$/.test(n) || /^l[a-z]*(leg|arm|hand|foot|shoulder|forearm|upleg|thigh|calf)/.test(n);
  const right = /(^|[_.:])r([_.]|$)|right|\.r$|_r$/.test(n) || /^r[a-z]*(leg|arm|hand|foot|shoulder|forearm|upleg|thigh|calf)/.test(n);
  if (/upleg|thigh|leg|calf|shin|foot|toe|knee|ankle/.test(n) && !/arm/.test(n)) return right ? Part.LegR : left ? Part.LegL : Part.Body;
  if (/shoulder|clavicle|arm|forearm|hand|elbow|wrist|finger|thumb|index|pinky|ring|middle/.test(n)) return right ? Part.ArmR : left ? Part.ArmL : Part.Body;
  if (/wing/.test(n)) return right ? Part.WingR : left ? Part.WingL : Part.Body;
  return Part.Body;
}

function extract(doc: Document): RawMesh[] {
  const out: RawMesh[] = [];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) throw new Error('GLB sans scène');
  const visit = (node: GNode) => {
    const mesh = node.getMesh();
    if (mesh) {
      const world = node.getWorldMatrix() as unknown as Mat4;
      const skin = node.getSkin();
      let jointM: Mat4[] | null = null;
      let jointPart: Part[] = [];
      let jointRoot: boolean[] = [];
      let jointPos: [number, number, number][] = [];
      if (skin) {
        const joints = skin.listJoints();
        const ibm = skin.getInverseBindMatrices();
        jointM = joints.map((j, i) => {
          const inv = new Array(16).fill(0);
          if (ibm) ibm.getElement(i, inv);
          else { inv[0] = inv[5] = inv[10] = inv[15] = 1; }
          return mulM(j.getWorldMatrix() as unknown as Mat4, inv);
        });
        jointPart = joints.map((j) => partOfJoint(j.getName()));
        // racine d'un membre = os dont le parent n'appartient pas au même membre (épaule, hanche)
        jointRoot = joints.map((j, i) => { const par = j.getParentNode(); return !par || partOfJoint(par.getName()) !== jointPart[i]; });
        jointPos = joints.map((j) => { const m = j.getWorldMatrix() as unknown as Mat4; return [m[12], m[13], m[14]]; });
      }
      // objet tenu (arme accrochée à un os de la main) : il suit le membre de son os porteur
      let held: { part: Part; pivot: [number, number, number] } | null = null;
      if (!skin) {
        let par = node.getParentNode();
        while (par && partOfJoint(par.getName()) === Part.Body) par = par.getParentNode();
        if (par) {
          const part = partOfJoint(par.getName());
          let root = par;
          for (let q = par.getParentNode(); q && partOfJoint(q.getName()) === part; q = q.getParentNode()) root = q;
          const m = root.getWorldMatrix() as unknown as Mat4;
          held = { part, pivot: [m[12], m[13], m[14]] };
        }
      }
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const raw = primToRaw(prim, world, jointM, jointPart, jointPos, jointRoot);
        if (held) {
          raw.part.fill(held.part);
          for (let i = 0; i < raw.part.length; i++) raw.pivot.set(held.pivot, i * 3);
        }
        out.push(raw);
      }
    }
    for (const c of node.listChildren()) visit(c);
  };
  for (const n of scene.listChildren()) visit(n);
  return out;
}

function readVec(prim: Primitive, name: string, size: number): Float32Array | null {
  const acc = prim.getAttribute(name);
  if (!acc) return null;
  const n = acc.getCount(), out = new Float32Array(n * size), tmp: number[] = [];
  for (let i = 0; i < n; i++) {
    acc.getElement(i, tmp);
    for (let k = 0; k < size; k++) out[i * size + k] = tmp[k] ?? 0;
  }
  return out;
}

function primToRaw(prim: Primitive, world: Mat4, jointM: Mat4[] | null, jointPart: Part[], jointPos: [number, number, number][], jointRoot: boolean[]): RawMesh {
  const posA = prim.getAttribute('POSITION')!;
  const n = posA.getCount();
  const pos0 = readVec(prim, 'POSITION', 3)!;
  const nrm0 = readVec(prim, 'NORMAL', 3);
  const mat = prim.getMaterial();
  const texture = mat?.getBaseColorTexture() ?? null;
  const texCoord = mat?.getBaseColorTextureInfo()?.getTexCoord() ?? 0;
  const uv = readVec(prim, `TEXCOORD_${texCoord}`, 2);
  const factor = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
  const col0 = readVec(prim, 'COLOR_0', 3);
  const joints = jointM ? readVec(prim, 'JOINTS_0', 4) : null;
  const weights = jointM ? readVec(prim, 'WEIGHTS_0', 4) : null;
  const pos = new Float32Array(n * 3);
  const nrm = nrm0 ? new Float32Array(n * 3) : null;
  const col = new Float32Array(n * 3);
  const part = new Float32Array(n), weight = new Float32Array(n), pivot = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos0[i * 3], y = pos0[i * 3 + 1], z = pos0[i * 3 + 2];
    if (jointM && joints && weights) {
      let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0, best = -1, bw = 0;
      const perPart = new Map<Part, number>();
      for (let k = 0; k < 4; k++) {
        const w = weights[i * 4 + k];
        if (w <= 0) continue;
        const j = joints[i * 4 + k] | 0;
        const m = jointM[j];
        if (!m) continue;
        const p = xfP(m, x, y, z);
        px += p[0] * w; py += p[1] * w; pz += p[2] * w;
        if (nrm0) { const q = xfN(m, nrm0[i * 3], nrm0[i * 3 + 1], nrm0[i * 3 + 2]); nx += q[0] * w; ny += q[1] * w; nz += q[2] * w; }
        const pt = jointPart[j] ?? Part.Body;
        perPart.set(pt, (perPart.get(pt) ?? 0) + w);
        if (w > bw) { bw = w; best = j; }
      }
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
      if (nrm) { nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nz; }
      // partie dominante (somme des poids), pivot = articulation racine du membre
      let bp = Part.Body, bpw = 0;
      for (const [pt, w] of perPart) if (pt !== Part.Body && w > bpw) { bp = pt; bpw = w; }
      part[i] = bp;
      weight[i] = bp === Part.Body ? 1 : Math.min(1, bpw);
      if (bp !== Part.Body) {
        let top = -Infinity, pv: [number, number, number] = jointPos[best] ?? [0, 0, 0];
        for (let j = 0; j < jointPart.length; j++) if (jointPart[j] === bp && jointRoot[j] && jointPos[j][1] > top) { top = jointPos[j][1]; pv = jointPos[j]; }
        pivot[i * 3] = pv[0]; pivot[i * 3 + 1] = pv[1]; pivot[i * 3 + 2] = pv[2];
      }
    } else {
      const p = xfP(world, x, y, z);
      pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
      if (nrm && nrm0) { const q = xfN(world, nrm0[i * 3], nrm0[i * 3 + 1], nrm0[i * 3 + 2]); nrm[i * 3] = q[0]; nrm[i * 3 + 1] = q[1]; nrm[i * 3 + 2] = q[2]; }
      weight[i] = 1;
    }
    col[i * 3] = factor[0] * (col0 ? col0[i * 3] : 1);
    col[i * 3 + 1] = factor[1] * (col0 ? col0[i * 3 + 1] : 1);
    col[i * 3 + 2] = factor[2] * (col0 ? col0[i * 3 + 2] : 1);
  }
  const ia = prim.getIndices();
  let idx: Uint32Array;
  if (ia) idx = Uint32Array.from(ia.getArray() as ArrayLike<number>);
  else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
  return { pos, nrm, uv, col, part, weight, pivot, idx, texture };
}

const whiteCache = new Map<Img, { u: number; v: number; rgb: [number, number, number] }>();
function whitest(img: Img) {
  let hit = whiteCache.get(img);
  if (hit) return hit;
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const o = (y * img.w + x) * 4;
    const v = Math.min(img.data[o], img.data[o + 1], img.data[o + 2]);
    if (v > best) { best = v; bx = x; by = y; }
  }
  const o = (by * img.w + bx) * 4;
  hit = { u: (bx + 0.5) / img.w, v: (by + 0.5) / img.h, rgb: [img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255] };
  whiteCache.set(img, hit);
  return hit;
}

/**
 * Modèles riggés en T-pose (bras à l'horizontale, ex. KayKit) : abaisse les bras autour de l'épaule
 * pour retrouver la pose bras le long du corps attendue par l'animation du jeu.
 */
function dropArms(r: RawMesh) {
  const n = r.pos.length / 3;
  const TARGET = (-62 * Math.PI) / 180, LIMIT = (-35 * Math.PI) / 180;
  let dropped = false;
  for (const part of [Part.ArmL, Part.ArmR]) {
    let cx = 0, cy = 0, cz = 0, px = 0, py = 0, pz = 0, m = 0;
    for (let i = 0; i < n; i++) if (r.part[i] === part) {
      cx += r.pos[i * 3]; cy += r.pos[i * 3 + 1]; cz += r.pos[i * 3 + 2];
      px = r.pivot[i * 3]; py = r.pivot[i * 3 + 1]; pz = r.pivot[i * 3 + 2]; m++;
    }
    if (m < 3) continue;
    const vx = cx / m - px, vy = cy / m - py, vz = cz / m - pz;
    const hl = Math.hypot(vx, vz);
    if (hl < 1e-6) continue;
    const elev = Math.atan2(vy, hl);
    if (elev < LIMIT) continue; // bras déjà baissés (A-pose)
    const hx = vx / hl, hz = vz / hl, delta = TARGET - elev;
    for (let i = 0; i < n; i++) if (r.part[i] === part) {
      const a = delta * r.weight[i], c = Math.cos(a), sn = Math.sin(a);
      const dx = r.pos[i * 3] - px, dy = r.pos[i * 3 + 1] - py, dz = r.pos[i * 3 + 2] - pz;
      const ph = dx * hx + dz * hz;
      const ph2 = ph * c - dy * sn, dy2 = ph * sn + dy * c;
      r.pos[i * 3] = px + dx + (ph2 - ph) * hx;
      r.pos[i * 3 + 1] = py + dy2;
      r.pos[i * 3 + 2] = pz + dz + (ph2 - ph) * hz;
    }
    dropped = true;
  }
  return dropped;
}

// ------------------------------------------------------------------ fusion + texture
function merge(parts: RawMesh[], keepTexture: boolean, images: Map<GTexture, Img | null>): RawMesh {
  let n = 0, m = 0;
  for (const p of parts) { n += p.pos.length / 3; m += p.idx.length; }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  const part = new Float32Array(n), weight = new Float32Array(n), pivot = new Float32Array(n * 3), idx = new Uint32Array(m);
  let vo = 0, io = 0, hasN = true;
  for (const p of parts) {
    const k = p.pos.length / 3;
    pos.set(p.pos, vo * 3); col.set(p.col, vo * 3); part.set(p.part, vo); weight.set(p.weight, vo); pivot.set(p.pivot, vo * 3);
    if (p.nrm) nrm.set(p.nrm, vo * 3); else hasN = false;
    if (p.uv) uv.set(p.uv, vo * 2);
    const img = p.texture ? images.get(p.texture) ?? null : null;
    if (keepTexture && !p.texture) {
      // partie sans texture (yeux lumineux…) dans un modèle à atlas unique : on pointe ses UV
      // sur le pixel le plus clair de l'atlas et on compense avec la couleur de sommet
      const w = whitest(images.get(parts.find((q) => q.texture)!.texture!)!);
      for (let i = 0; i < k; i++) {
        uv[(vo + i) * 2] = w.u; uv[(vo + i) * 2 + 1] = w.v;
        for (let c = 0; c < 3; c++) col[(vo + i) * 3 + c] = Math.min(1, col[(vo + i) * 3 + c] / Math.max(0.05, w.rgb[c]));
      }
    }
    if (!keepTexture && img && p.uv) {
      for (let i = 0; i < k; i++) {
        const c = sample(img, p.uv[i * 2], p.uv[i * 2 + 1]);
        col[(vo + i) * 3] *= c[0]; col[(vo + i) * 3 + 1] *= c[1]; col[(vo + i) * 3 + 2] *= c[2];
      }
    }
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += k; io += p.idx.length;
  }
  return { pos, nrm: hasN ? nrm : null, uv: keepTexture ? uv : null, col, part, weight, pivot, idx, texture: keepTexture ? parts.find((q) => q.texture)!.texture : null };
}

// ------------------------------------------------------------------ soudure / décimation
/** hardEdges : garde les arêtes vives (normales distinctes) — pour les modèles qui ne seront pas décimés */
function weld(r: RawMesh, eps: number, hardEdges = false): RawMesh {
  const n = r.pos.length / 3;
  const map = new Map<string, number>();
  const remap = new Int32Array(n);
  const keep: number[] = [];
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(r.pos[i * 3] / eps)},${Math.round(r.pos[i * 3 + 1] / eps)},${Math.round(r.pos[i * 3 + 2] / eps)}|${r.uv ? Math.round(r.uv[i * 2] * 2048) + ',' + Math.round(r.uv[i * 2 + 1] * 2048) : ''}|${r.part[i]}|${Math.round(r.col[i * 3] * 64)},${Math.round(r.col[i * 3 + 1] * 64)},${Math.round(r.col[i * 3 + 2] * 64)}${hardEdges && r.nrm ? `|${Math.round(r.nrm[i * 3] * 8)},${Math.round(r.nrm[i * 3 + 1] * 8)},${Math.round(r.nrm[i * 3 + 2] * 8)}` : ''}`;
    let j = map.get(key);
    if (j === undefined) { j = keep.length; map.set(key, j); keep.push(i); }
    remap[i] = j;
  }
  const idx = new Uint32Array(r.idx.length);
  for (let i = 0; i < idx.length; i++) idx[i] = remap[r.idx[i]];
  return compact({ ...r, idx }, keep);
}
function compact(r: RawMesh, keep: number[]): RawMesh {
  const k = keep.length;
  const pick = (a: Float32Array | null, s: number) => {
    if (!a) return null;
    const o = new Float32Array(k * s);
    for (let i = 0; i < k; i++) for (let c = 0; c < s; c++) o[i * s + c] = a[keep[i] * s + c];
    return o;
  };
  return { pos: pick(r.pos, 3)!, nrm: pick(r.nrm, 3), uv: pick(r.uv, 2), col: pick(r.col, 3)!, part: pick(r.part, 1)!, weight: pick(r.weight, 1)!, pivot: pick(r.pivot, 3)!, idx: r.idx, texture: r.texture };
}
function dropUnused(r: RawMesh): RawMesh {
  const n = r.pos.length / 3;
  const used = new Int32Array(n).fill(-1);
  const keep: number[] = [];
  for (let i = 0; i < r.idx.length; i++) { const v = r.idx[i]; if (used[v] < 0) { used[v] = keep.length; keep.push(v); } }
  const idx = new Uint32Array(r.idx.length);
  for (let i = 0; i < idx.length; i++) idx[i] = used[r.idx[i]];
  return compact({ ...r, idx }, keep);
}
function stripDegenerate(r: RawMesh): RawMesh {
  const out: number[] = [];
  for (let i = 0; i + 2 < r.idx.length; i += 3) {
    const a = r.idx[i], b = r.idx[i + 1], c = r.idx[i + 2];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  return { ...r, idx: Uint32Array.from(out) };
}
function simplify(r: RawMesh, targetTris: number): RawMesh {
  const tris = r.idx.length / 3;
  if (tris <= targetTris) return r;
  const [idx] = MeshoptSimplifier.simplify(r.idx, r.pos, 3, targetTris * 3, 0.08, ['LockBorder']);
  const res: RawMesh = { ...r, idx: Uint32Array.from(idx) };
  if (idx.length / 3 > targetTris * 1.6) {
    const [idx2] = MeshoptSimplifier.simplify(r.idx, r.pos, 3, targetTris * 3, 0.3, []);
    res.idx = Uint32Array.from(idx2);
  }
  return dropUnused(stripDegenerate(res));
}

// ------------------------------------------------------------------ normalisation, parties, normales, AO
function bounds(r: RawMesh) {
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (let i = 0; i < r.pos.length; i += 3) {
    b.minX = Math.min(b.minX, r.pos[i]); b.maxX = Math.max(b.maxX, r.pos[i]);
    b.minY = Math.min(b.minY, r.pos[i + 1]); b.maxY = Math.max(b.maxY, r.pos[i + 1]);
    b.minZ = Math.min(b.minZ, r.pos[i + 2]); b.maxZ = Math.max(b.maxZ, r.pos[i + 2]);
  }
  return b;
}
function normalize(r: RawMesh, e: CatalogEntry) {
  const yaw = ((e.yaw ?? 0) * Math.PI) / 180;
  if (yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const rot = (a: Float32Array) => { for (let i = 0; i < a.length; i += 3) { const x = a[i], z = a[i + 2]; a[i] = c * x + s * z; a[i + 2] = -s * x + c * z; } };
    rot(r.pos); rot(r.pivot); if (r.nrm) rot(r.nrm);
  }
  const b = bounds(r);
  const h = Math.max(1e-6, b.maxY - b.minY), w = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  let s = e.height / h;
  if (e.maxWidth && w * s > e.maxWidth) s = e.maxWidth / w;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const tr = (a: Float32Array) => { for (let i = 0; i < a.length; i += 3) { a[i] = (a[i] - cx) * s; a[i + 1] = (a[i + 1] - b.minY) * s; a[i + 2] = (a[i + 2] - cz) * s; } };
  tr(r.pos);
  // les pivots sans partie (Body) sont à 0 : ne pas les décaler
  for (let i = 0; i < r.part.length; i++) if (r.part[i] !== Part.Body) {
    r.pivot[i * 3] = (r.pivot[i * 3] - cx) * s; r.pivot[i * 3 + 1] = (r.pivot[i * 3 + 1] - b.minY) * s; r.pivot[i * 3 + 2] = (r.pivot[i * 3 + 2] - cz) * s;
  }
  return s;
}

/** Parties animées déduites de la forme (modèles non riggés). */
function assignParts(r: RawMesh, mode: AnimMode, rigged: boolean) {
  const n = r.pos.length / 3;
  const b = bounds(r);
  const H = b.maxY - b.minY, W = Math.max(b.maxX - b.minX, 1e-6);
  const set = (i: number, p: Part, w: number, px: number, py: number, pz: number) => {
    r.part[i] = p; r.weight[i] = w; r.pivot[i * 3] = px; r.pivot[i * 3 + 1] = py; r.pivot[i * 3 + 2] = pz;
  };
  if (mode === 'rig' && rigged) return; // déjà fait depuis le squelette
  if (mode === 'static' || mode === 'blob') { for (let i = 0; i < n; i++) set(i, Part.Body, 1, 0, 0, 0); return; }
  if (mode === 'sway') { for (let i = 0; i < n; i++) set(i, Part.Sway, 1, 0, 0, 0); return; }
  if (mode === 'biped' || mode === 'rig') {
    const hip = H * 0.47, sh = H * 0.8;
    // largeur du torse estimée à mi-hauteur (médiane des |x| des sommets entre 55 % et 75 %)
    const xs: number[] = [];
    for (let i = 0; i < n; i++) { const y = r.pos[i * 3 + 1]; if (y > H * 0.55 && y < H * 0.75) xs.push(Math.abs(r.pos[i * 3])); }
    xs.sort((a, c) => a - c);
    const torso = xs.length ? xs[Math.floor(xs.length * 0.6)] : W * 0.2;
    let lx = 0, ln = 0, rx = 0, rn = 0;
    for (let i = 0; i < n; i++) { const x = r.pos[i * 3], y = r.pos[i * 3 + 1]; if (y < hip) { if (x > 0) { lx += x; ln++; } else { rx += x; rn++; } } }
    lx = ln ? lx / ln : W * 0.15; rx = rn ? rx / rn : -W * 0.15;
    for (let i = 0; i < n; i++) {
      const x = r.pos[i * 3], y = r.pos[i * 3 + 1];
      const legW = smooth(hip + H * 0.06, hip - H * 0.06, y);
      const armW = smooth(torso * 1.05, torso * 1.5, Math.abs(x)) * smooth(hip - H * 0.05, hip + H * 0.1, y) * smooth(sh + H * 0.12, sh - H * 0.02, y);
      if (legW > 0.01 && legW >= armW) set(i, x >= 0 ? Part.LegL : Part.LegR, legW, x >= 0 ? lx : rx, hip, 0);
      else if (armW > 0.01) set(i, x >= 0 ? Part.ArmL : Part.ArmR, armW, Math.sign(x) * torso * 1.1, sh, 0);
      else set(i, Part.Body, 1, 0, 0, 0);
    }
    return;
  }
  if (mode === 'quad') {
    const hip = H * 0.45, zc = (b.minZ + b.maxZ) / 2;
    for (let i = 0; i < n; i++) {
      const x = r.pos[i * 3], y = r.pos[i * 3 + 1], z = r.pos[i * 3 + 2];
      const w = smooth(hip + H * 0.08, hip - H * 0.08, y);
      if (w > 0.01) {
        const front = z > zc;
        const p = (x >= 0) === front ? Part.LegL : Part.LegR;
        set(i, p, w, Math.sign(x) * W * 0.2, hip, z > zc ? zc + (b.maxZ - zc) * 0.55 : zc - (zc - b.minZ) * 0.55);
      } else set(i, Part.Body, 1, 0, 0, 0);
    }
    return;
  }
  if (mode === 'flyer') {
    const D = b.maxZ - b.minZ;
    const yc = (b.minY + b.maxY) / 2, zc = (b.minZ + b.maxZ) / 2;
    // corps = sommets proches de l'axe ; ailes = au-delà de 22 % de la demi-envergure
    for (let i = 0; i < n; i++) {
      const x = r.pos[i * 3];
      const w = smooth(W * 0.11, W * 0.2, Math.abs(x));
      if (w > 0.01) set(i, x >= 0 ? Part.WingL : Part.WingR, w, Math.sign(x) * W * 0.1, yc, zc);
      else set(i, Part.Body, 1, 0, 0, 0);
    }
    void D;
  }
}

function smoothNormals(r: RawMesh) {
  const n = r.pos.length / 3;
  const acc = new Float32Array(n * 3);
  const b = bounds(r);
  const eps = Math.max(b.maxY - b.minY, b.maxX - b.minX) * 1e-4;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(r.pos[i * 3] / eps)},${Math.round(r.pos[i * 3 + 1] / eps)},${Math.round(r.pos[i * 3 + 2] / eps)}`;
    const g = groups.get(key);
    if (g) g.push(i); else groups.set(key, [i]);
  }
  for (let i = 0; i < r.idx.length; i += 3) {
    const a = r.idx[i], bb = r.idx[i + 1], c = r.idx[i + 2];
    const ax = r.pos[a * 3], ay = r.pos[a * 3 + 1], az = r.pos[a * 3 + 2];
    const ux = r.pos[bb * 3] - ax, uy = r.pos[bb * 3 + 1] - ay, uz = r.pos[bb * 3 + 2] - az;
    const vx = r.pos[c * 3] - ax, vy = r.pos[c * 3 + 1] - ay, vz = r.pos[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, bb, c]) { acc[v * 3] += nx; acc[v * 3 + 1] += ny; acc[v * 3 + 2] += nz; }
  }
  const out = new Float32Array(n * 3);
  for (const g of groups.values()) {
    let x = 0, y = 0, z = 0;
    for (const i of g) { x += acc[i * 3]; y += acc[i * 3 + 1]; z += acc[i * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of g) { out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l; }
  }
  r.nrm = out;
}

function paintAO(r: RawMesh, height: number) {
  const aoH = Math.min(0.6, height * 0.4);
  for (let i = 0; i < r.col.length / 3; i++) {
    const y = r.pos[i * 3 + 1];
    const k = 0.74 + 0.26 * Math.min(1, Math.max(0, y / aoH));
    r.col[i * 3] *= k; r.col[i * 3 + 1] *= k; r.col[i * 3 + 2] *= k;
  }
}

// ------------------------------------------------------------------ écriture
function write(r: RawMesh, e: CatalogEntry, img: Img | null, io: NodeIO, cutout = false) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const n = r.pos.length / 3;
  const acc = (name: string, type: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', arr: Float32Array | Uint8Array | Uint16Array | Uint32Array, normalized = false) =>
    doc.createAccessor(name).setType(type).setArray(arr).setNormalized(normalized).setBuffer(buffer);
  const prim = doc.createPrimitive();
  prim.setAttribute('POSITION', acc('pos', 'VEC3', r.pos));
  prim.setAttribute('NORMAL', acc('nrm', 'VEC3', r.nrm!));
  const col8 = new Uint8Array(n * 3);
  for (let i = 0; i < col8.length; i++) col8[i] = Math.round(Math.min(1, Math.max(0, r.col[i])) * 255);
  prim.setAttribute('COLOR_0', acc('col', 'VEC3', col8, true));
  const anim = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { anim[i * 4] = r.part[i]; anim[i * 4 + 1] = r.pivot[i * 3]; anim[i * 4 + 2] = r.pivot[i * 3 + 1]; anim[i * 4 + 3] = r.pivot[i * 3 + 2]; }
  prim.setAttribute('_ANIM', acc('anim', 'VEC4', anim));
  prim.setAttribute('_WEIGHT', acc('weight', 'SCALAR', r.weight));
  if (r.uv && img) prim.setAttribute('TEXCOORD_0', acc('uv', 'VEC2', r.uv));
  prim.setIndices(acc('idx', 'SCALAR', n < 65536 ? Uint16Array.from(r.idx) : r.idx));
  const mat = doc.createMaterial('mat').setRoughnessFactor(1).setMetallicFactor(0);
  if (r.uv && img) {
    const small = resize(img, e.tex);
    const tex = doc.createTexture('base');
    if (cutout) {
      // la transparence impose le PNG ; le client découpe au seuil alpha 0,5
      const png = new PNG({ width: small.w, height: small.h });
      png.data = Buffer.from(small.data);
      tex.setImage(new Uint8Array(PNG.sync.write(png))).setMimeType('image/png');
      mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
    } else {
      const j = jpeg.encode({ data: Buffer.from(small.data), width: small.w, height: small.h }, 85);
      tex.setImage(new Uint8Array(j.data)).setMimeType('image/jpeg');
    }
    mat.setBaseColorTexture(tex);
  }
  prim.setMaterial(mat);
  const mesh = doc.createMesh(e.key).addPrimitive(prim);
  const node = doc.createNode(e.key).setMesh(mesh);
  doc.createScene('scene').addChild(node);
  const file = e.src.replace(/\.glb$/, '') + '.glb';
  const glb = io.writeBinary(doc);
  return glb.then((bytes) => { writeFileSync(join(OUT, file), bytes); return { file, bytes: bytes.byteLength }; });
}

// ------------------------------------------------------------------ programme
async function main() {
  await MeshoptSimplifier.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  mkdirSync(OUT, { recursive: true });
  const manifestPath = join(OUT, 'manifest.json');
  const manifest: { version: number; models: Record<string, { file: string; height: number; muzzleY?: number; tris: number; cutout?: boolean }> } =
    existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { version: 1, models: {} };
  let done = 0, missing = 0;
  for (const e of CATALOG) {
    if (filter && !e.key.startsWith(filter)) continue;
    const src = join(SRC, e.src);
    if (!existsSync(src)) { missing++; continue; }
    process.stdout.write(`${e.key.padEnd(32)} ${e.src.padEnd(28)} `);
    try {
      const doc = await io.read(src);
      const parts = extract(doc);
      if (!parts.length) throw new Error('aucun maillage triangulé');
      const rigged = parts.some((p) => p.pivot.some((v) => v !== 0) || p.part.some((v) => v !== 0));
      const textures = new Set(parts.map((p) => p.texture).filter((t): t is GTexture => !!t));
      const images = new Map<GTexture, Img | null>();
      for (const t of textures) images.set(t, decode(t));
      // une seule texture pour tout le modèle ; les parties sans texture y sont raccordées (voir merge)
      const single = textures.size === 1 && parts.every((p) => !p.texture || p.uv) && images.get([...textures][0]) !== null;
      let r = merge(parts, single, images);
      const srcTris = r.idx.length / 3;
      const b0 = bounds(r);
      r = weld(r, Math.max(b0.maxY - b0.minY, b0.maxX - b0.minX) * 2e-4, srcTris <= e.tris && !rigged);
      r = simplify(r, e.tris);
      if (rigged && e.anim === 'rig') dropArms(r);
      normalize(r, e);
      assignParts(r, e.anim, rigged && e.anim === 'rig');
      // un modèle statique non décimé garde ses normales d'origine (arêtes vives des modèles à facettes)
      if (rigged || srcTris > e.tris || !r.nrm) smoothNormals(r);
      else for (let i = 0; i < r.nrm.length; i += 3) {
        const l = Math.hypot(r.nrm[i], r.nrm[i + 1], r.nrm[i + 2]) || 1;
        r.nrm[i] /= l; r.nrm[i + 1] /= l; r.nrm[i + 2] /= l;
      }
      paintAO(r, e.height);
      const img = single ? images.get([...textures][0])! : null;
      const cutout = !!img && e.group === 'decor' && isCutout(img);
      const out = await write(r, e, img, io, cutout);
      const tris = r.idx.length / 3;
      manifest.models[e.key] = { file: out.file, height: e.height, ...(e.muzzleY !== undefined ? { muzzleY: e.muzzleY } : {}), tris, ...(cutout ? { cutout: true } : {}) };
      console.log(`${String(srcTris).padStart(7)} → ${String(tris).padStart(5)} tris  ${(out.bytes / 1024).toFixed(0).padStart(5)} Ko  ${single ? 'texture ' + e.tex + (cutout ? ' découpée' : '') : 'couleurs cuites'}${rigged ? '  rig' : ''}`);
      done++;
    } catch (err) {
      console.log(`ÉCHEC : ${(err as Error).message}`);
    }
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`\n${done} modèle(s) cuit(s), ${missing} source(s) absente(s) dans assets/models-src/ — manifeste : ${Object.keys(manifest.models).length} entrée(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
