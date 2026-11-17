/**
 * Corrige les parties animées des modèles déjà cuits (public/models/*.glb) :
 *   pnpm tsx tools/models/fixparts.ts
 *
 * La cuisson devinait jambes / bras / ailes d'après la forme : sur les créatures rondes (gobelin, loup)
 * la bouche et la langue suivaient les « jambes », sur les volants les yeux battaient avec les ailes.
 * Ici on travaille par îlots (morceaux de maillage séparés) :
 *  - créatures sans membres : tout le corps d'un bloc ;
 *  - volants : seuls les îlots qui s'étendent loin sur les côtés sont des ailes ;
 *  - autres : un îlot qui traverse le centre (torse, tête) appartient au corps, un « bras » qui touche le sol
 *    est une jambe, et chaque membre bouge d'un bloc autour de son articulation.
 * Les modèles d'un seul tenant (personnages riggés) gardent leurs poids par sommet.
 */
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const enum P { Body = 0, LegL = 1, LegR = 2, ArmL = 3, ArmR = 4, WingL = 5, WingR = 6 }
/** créatures sans membres (boules, limaces) */
const BLOBS = new Set(['gobelin', 'loup', 'limon', 'petitlimon', 'ver', 'vasiere', 'invocateur']);
const FLYERS = new Set(['corbeau', 'chauvesouris', 'gargouille']);
/** modèles dont les « bras » détectés sont en réalité les jambes (membres qui descendent jusqu'au sol) */
const ARMS_ARE_LEGS = new Set<string>();

function read(p: Primitive, s: string) {
  const a = p.getAttribute(s)!, out: number[] = [], e: number[] = new Array(a.getElementSize()).fill(0);
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); out.push(...e); }
  return out;
}

function islands(pos: number[], idx: ArrayLike<number>) {
  const n = pos.length / 3;
  const par = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const uni = (x: number, y: number) => { const a = find(x), b = find(y); if (a !== b) par[a] = b; };
  const key = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 2000)},${Math.round(pos[i * 3 + 1] * 2000)},${Math.round(pos[i * 3 + 2] * 2000)}`;
    const o = key.get(k);
    if (o !== undefined) uni(i, o); else key.set(k, i);
  }
  for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
  const map = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { const r = find(i); let v = map.get(r); if (!v) map.set(r, (v = [])); v.push(i); }
  return [...map.values()];
}

for (const file of readdirSync(MODELS).filter((f) => f.startsWith('enemy-') && f.endsWith('.glb'))) {
  const id = file.slice(6, -4);
  const doc = await io.read(join(MODELS, file));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const pos = read(prim, 'POSITION');
  const anim = read(prim, '_ANIM');
  const weight = read(prim, '_WEIGHT');
  const idx = prim.getIndices()!.getArray()!;
  const n = pos.length / 3;
  let H = 0, hw = 0;
  for (let i = 0; i < n; i++) { H = Math.max(H, pos[i * 3 + 1]); hw = Math.max(hw, Math.abs(pos[i * 3])); }
  const set = (i: number, part: number, w: number, px = 0, py = 0, pz = 0) => {
    anim[i * 4] = part; anim[i * 4 + 1] = px; anim[i * 4 + 2] = py; anim[i * 4 + 3] = pz; weight[i] = w;
  };
  const before = anim.filter((_, k) => k % 4 === 0).filter((p) => p !== 0).length;
  const isl = islands(pos, idx);
  const biggest = Math.max(...isl.map((v) => v.length));

  if (ARMS_ARE_LEGS.has(id)) {
    for (let i = 0; i < n; i++) {
      const p = anim[i * 4];
      if (p !== P.ArmL && p !== P.ArmR) continue;
      if (pos[i * 3 + 1] > anim[i * 4 + 2] + H * 0.04) set(i, P.Body, 1);
      else anim[i * 4] = p === P.ArmL ? P.LegL : P.LegR;
    }
  }
  if (BLOBS.has(id)) {
    for (let i = 0; i < n; i++) set(i, P.Body, 1);
  } else if (FLYERS.has(id)) {
    for (const v of isl) {
      let x0 = 1e9, x1 = -1e9, cx = 0, y1 = -1e9, cy = 0, cz = 0;
      for (const i of v) { const x = pos[i * 3]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); cx += x; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; y1 = Math.max(y1, pos[i * 3 + 1]); }
      cx /= v.length; cy /= v.length; cz /= v.length;
      const reach = Math.max(Math.abs(x0), Math.abs(x1));
      // aile : îlot qui s'étend loin sur un côté, sans traverser le centre
      const wing = reach > hw * 0.65 && Math.sign(x0) === Math.sign(x1) && Math.abs(cx) > hw * 0.3;
      if (!wing) { for (const i of v) set(i, P.Body, 1); continue; }
      // articulation : bord intérieur de l'aile ; le poids monte doucement depuis l'épaule
      const inner = cx > 0 ? x0 : x1;
      for (const i of v) {
        const d = Math.abs(pos[i * 3] - inner) / Math.max(1e-3, reach - Math.abs(inner));
        set(i, cx > 0 ? P.WingL : P.WingR, Math.min(1, 0.35 + d * 1.2), inner, cy, cz);
      }
    }
  } else if (biggest < n * 0.6) {
    // modèle en plusieurs morceaux : chaque îlot bouge d'un bloc
    for (const v of isl) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, cx = 0, cz = 0;
      const count = new Map<number, number>();
      for (const i of v) {
        const x = pos[i * 3], y = pos[i * 3 + 1];
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        cx += x; cz += pos[i * 3 + 2];
        count.set(anim[i * 4], (count.get(anim[i * 4]) ?? 0) + 1);
      }
      cx /= v.length; cz /= v.length;
      let part = P.Body, best = 0;
      for (const [p, c] of count) if (p !== P.Body && c > best) { best = c; part = p; }
      const central = x0 < -hw * 0.18 && x1 > hw * 0.18;
      if (central || best < v.length * 0.5) {
        // morceau central (torse, tête, corps avec jambes) : on garde le découpage sommet par sommet,
        // sauf les sommets mal placés — « jambe » au-dessus de sa hanche, « bras » au milieu du torse
        for (const i of v) {
          const p = anim[i * 4], x = pos[i * 3], y = pos[i * 3 + 1], px = anim[i * 4 + 1], py = anim[i * 4 + 2];
          if ((p === P.LegL || p === P.LegR) && y > py + H * 0.04) set(i, P.Body, 1);
          else if ((p === P.ArmL || p === P.ArmR) && (Math.abs(x) < Math.abs(px) * 0.7 || y > py + H * 0.06 || (Math.abs(x) < hw * 0.3 && y > py - H * 0.08))) set(i, P.Body, 1);
          else if ((p === P.WingL || p === P.WingR) && Math.abs(x) < Math.abs(px)) set(i, P.Body, 1);
        }
        continue;
      }
      const left = cx >= 0;
      if (part === P.ArmL || part === P.ArmR) part = left ? P.ArmL : P.ArmR;
      else if (part === P.LegL || part === P.LegR) part = left ? P.LegL : P.LegR;
      else if (part === P.WingL || part === P.WingR) part = left ? P.WingL : P.WingR;
      // articulation en haut du membre (jambes, bras) ou à sa base intérieure (ailes)
      const isWing = part === P.WingL || part === P.WingR;
      for (const i of v) set(i, part, 1, isWing ? (left ? x0 : x1) : cx, y1, cz);
    }
  }
  const after = anim.filter((_, k) => k % 4 === 0).filter((p) => p !== 0).length;
  const buf = doc.getRoot().listBuffers()[0];
  prim.setAttribute('_ANIM', doc.createAccessor().setType('VEC4').setArray(new Float32Array(anim)).setBuffer(buf));
  prim.setAttribute('_WEIGHT', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(weight)).setBuffer(buf));
  for (const a of doc.getRoot().listAccessors()) if (!a.listParents().some((pp) => pp.propertyType !== 'Root')) a.dispose();
  await io.write(join(MODELS, file), doc);
  console.log(`${id.padEnd(14)} îlots ${String(isl.length).padStart(3)}  sommets animés ${before} → ${after}${BLOBS.has(id) ? ' (sans membres)' : FLYERS.has(id) ? ' (volant)' : biggest < n * 0.6 ? ' (par îlots)' : ' (inchangé)'}`);
}
