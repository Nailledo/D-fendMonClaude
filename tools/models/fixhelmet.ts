/**
 * Têtes qui traversent leur coiffe (casque, capuche, peau d'ours) : la simplification des modèles KayKit
 * fait ressortir la peau du crâne à travers le casque. Pour chaque sommet de peau de la tête, on lance un rayon
 * depuis le centre de la tête : s'il traverse la coiffe (tout ce qui n'est pas de la peau) avant d'atteindre
 * le sommet, celui-ci dépasse et il est ramené juste sous la coiffe. Le visage, sous l'ouverture, ne bouge pas.
 *   pnpm tsx tools/models/fixhelmet.ts
 * Une seule fois par modèle : le fichier porte ensuite la marque `extras.headFixed`.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['soldier-1.glb', 'soldier-2.glb', 'soldier-3.glb', 'soldier-4.glb', 'soldier-5.glb', 'enemy-chevalierinf.glb'];

for (const file of FILES) {
  const path = join(MODELS, file);
  const doc = await io.read(path);
  const root = doc.getRoot();
  if ((root.getExtras() as { headFixed?: boolean }).headFixed) { console.log(file, 'déjà corrigé'); continue; }
  const prim = root.listMeshes()[0].listPrimitives()[0];
  const tex = prim.getMaterial()!.getBaseColorTexture()!;
  const bytes = tex.getImage()!;
  const img = tex.getMimeType() === 'image/png'
    ? (() => { const p = PNG.sync.read(Buffer.from(bytes)); return { w: p.width, h: p.height, data: p.data as Uint8Array }; })()
    : (() => { const j = jpeg.decode(bytes, { useTArray: true }); return { w: j.width, h: j.height, data: j.data }; })();
  const P = prim.getAttribute('POSITION')!, UV = prim.getAttribute('TEXCOORD_0')!;
  const n = P.getCount();
  const pos: number[][] = [], skin: boolean[] = [];
  const p = [0, 0, 0], uv = [0, 0];
  let ymax = -Infinity;
  for (let i = 0; i < n; i++) {
    P.getElement(i, p);
    pos.push([p[0], p[1], p[2]]);
    ymax = Math.max(ymax, p[1]);
    UV.getElement(i, uv);
    const x = Math.min(img.w - 1, Math.floor((uv[0] - Math.floor(uv[0])) * img.w));
    const y = Math.min(img.h - 1, Math.floor((uv[1] - Math.floor(uv[1])) * img.h));
    const o = (y * img.w + x) * 4;
    const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    // peau : rose-orangé clair (rouge dominant, bleu faible) ; le cuir et les cheveux sont plus sombres
    skin.push(r > 150 && r > g * 1.12 && g > b * 1.15);
  }
  // la tête : au-dessus du cou ; centre = milieu de sa boîte
  const neck = ymax * 0.62;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) if (pos[i][1] > neck) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i][k]); hi[k] = Math.max(hi[k], pos[i][k]); }
  const c = [(lo[0] + hi[0]) / 2, neck + (ymax - neck) * 0.45, (lo[2] + hi[2]) / 2];
  // triangles de la coiffe (aucun sommet de peau), au-dessus du cou
  const idx = prim.getIndices()!.getArray()!;
  const tris: number[][][] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    if (v.some((i) => skin[i]) || v.every((i) => pos[i][1] < neck)) continue;
    tris.push(v.map((i) => pos[i]));
  }
  /** distance du centre au premier triangle de coiffe traversé par le rayon vers d (Möller–Trumbore) */
  const hit = (d: number[]) => {
    let best = Infinity;
    for (const [a, b, cc] of tris) {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
      const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
      if (Math.abs(det) < 1e-9) continue;
      const tv = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det;
      if (u < 0 || u > 1) continue;
      const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
      const w = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
      if (w < 0 || u + w > 1) continue;
      const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
      if (t > 0.02 && t < best) best = t;
    }
    return best;
  };
  // un sommet de peau au-delà de la coiffe (dans sa direction) est ramené juste dessous
  let moved = 0;
  for (let i = 0; i < n; i++) {
    if (!skin[i] || pos[i][1] < neck) continue;
    const v = pos[i];
    const r = Math.hypot(v[0] - c[0], v[1] - c[1], v[2] - c[2]);
    if (r < 1e-4) continue;
    const d = [(v[0] - c[0]) / r, (v[1] - c[1]) / r, (v[2] - c[2]) / r];
    const R = hit(d);
    if (!(R < r + 0.015)) continue;
    const k = (R - 0.025) / r;
    P.setElement(i, [c[0] + (v[0] - c[0]) * k, c[1] + (v[1] - c[1]) * k, c[2] + (v[2] - c[2]) * k]);
    moved++;
  }
  root.setExtras({ ...root.getExtras(), headFixed: true });
  await io.write(path, doc);
  console.log(file, moved, 'sommets de peau rentrés sous la coiffe');
}
