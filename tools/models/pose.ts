/**
 * Retouches des modèles déjà cuits (public/models/*.glb) :
 *   pnpm models:pose
 *
 * Petites corrections de géométrie impossibles à obtenir à la génération : remonter un membre,
 * le plier pour qu'il ne traverse pas le corps, resserrer une taille, recopier un détail
 * manquant (une pupille). Le fondu `_WEIGHT` près des articulations est respecté et les
 * normales suivent. À relancer après `models:bake` ou `models:fixparts`, qui régénèrent les
 * fichiers ; une retouche déjà appliquée n'est pas refaite (signature dans les `extras`).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

type V3 = [number, number, number];
type Op =
  /** déplace un membre (et son articulation) ; le fondu près de la jointure étire la peau sans trou */
  | { op: 'move'; part: number; by: V3 }
  /** plie un membre vers l'extérieur (roulis autour de l'axe avant-arrière), nul à l'articulation,
   *  complet `ramp` plus bas */
  | { op: 'bend'; part: number; rotZ: number; ramp: number }
  /** resserre le corps (partie 0) vers `center` (x, z) entre y0 et y1, au plus fort à `peak` */
  | { op: 'waist'; center: [number, number]; y0: number; peak: number; y1: number; scale: number }
  /** recopie les triangles dont le centre est dans la boîte `min`..`max`, décalés de `by` */
  | { op: 'copy'; min: V3; max: V3; by: V3 };

/** clé du fichier (sans « .glb ») → retouches, appliquées dans l'ordre */
const POSE: Record<string, Op[]> = {
  'enemy-brute': [
    // bras droit (sans massue) : attaché 10 cm plus bas que l'autre, il pendait jusqu'au sol
    { op: 'move', part: 4, by: [0, 0.1, 0] },
    // un léger pli vers l'extérieur et une taille plus fine : la main passe à côté de la ceinture
    { op: 'bend', part: 4, rotZ: -0.08, ramp: 0.5 },
    { op: 'waist', center: [-0.15, -0.14], y0: 0.57, peak: 0.66, y1: 0.86, scale: 0.88 },
    // l'œil gauche n'avait pas de pupille : celle de l'œil droit, recopiée sur l'autre globe
    { op: 'copy', min: [-0.05, 1.11, 0.224], max: [0.0, 1.15, 0.245], by: [-0.229, 0.003, 0.003] },
  ],
};

const smooth = (f: number) => { const t = Math.min(1, Math.max(0, f)); return t * t * (3 - 2 * t); };
const get = (a: Accessor | null, i: number, n: number) => (a ? a.getElement(i, new Array(n).fill(0)) : null);

for (const [key, ops] of Object.entries(POSE)) {
  const file = join(MODELS, key + '.glb');
  const doc = await io.read(file);
  const sig = JSON.stringify(ops);
  let changed = false;
  for (const mesh of doc.getRoot().listMeshes()) {
    const extras = (mesh.getExtras() ?? {}) as { pose?: string };
    if (extras.pose === sig) continue;
    if (extras.pose) throw new Error(`${key} : une autre retouche est déjà appliquée ; régénérez le fichier (git checkout ou models:bake) avant de relancer`);
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), anim = prim.getAttribute('_ANIM'), wt = prim.getAttribute('_WEIGHT');
      if (!pos || !anim) continue;
      for (const o of ops) {
        if (o.op === 'copy') {
          const idx = prim.getIndices()!;
          const sems = prim.listSemantics();
          const tris: number[] = [];
          for (let t = 0; t < idx.getCount(); t += 3) {
            const ii = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)];
            const c = [0, 1, 2].map((k) => ii.reduce((s, i) => s + (get(pos, i, 3) as number[])[k], 0) / 3);
            if (c.every((v, k) => v >= o.min[k] && v <= o.max[k])) tris.push(...ii);
          }
          if (!tris.length) throw new Error(`${key} : aucun triangle à recopier`);
          const base = pos.getCount();
          for (const sem of sems) {
            const a = prim.getAttribute(sem)!;
            const arr = a.getArray()!;
            const n = a.getElementSize();
            const out = new (arr.constructor as Float32ArrayConstructor)(arr.length + tris.length * n);
            out.set(arr);
            tris.forEach((src, j) => {
              const e = a.getElement(src, new Array(n).fill(0));
              if (sem === 'POSITION') for (let k = 0; k < 3; k++) e[k] += o.by[k];
              for (let k = 0; k < n; k++) out[(base + j) * n + k] = e[k];
            });
            a.setArray(out);
          }
          const iarr = idx.getArray()!;
          const iout = base + tris.length < 65536 ? new Uint16Array(iarr.length + tris.length) : new Uint32Array(iarr.length + tris.length);
          iout.set(iarr);
          tris.forEach((_, j) => (iout[iarr.length + j] = base + j));
          idx.setArray(iout);
          continue;
        }
        for (let i = 0; i < pos.getCount(); i++) {
          const a = get(anim, i, 4)!, p = get(pos, i, 3)!, w = wt ? (get(wt, i, 1)![0]) : 1;
          const part = Math.round(a[0]);
          if (o.op === 'move' && part === o.part) {
            pos.setElement(i, [p[0] + o.by[0] * w, p[1] + o.by[1] * w, p[2] + o.by[2] * w]);
            anim.setElement(i, [a[0], a[1] + o.by[0], a[2] + o.by[1], a[3] + o.by[2]]);
          } else if (o.op === 'bend' && part === o.part) {
            const k = w * smooth((a[2] - p[1]) / o.ramp);
            const c = Math.cos(o.rotZ * k), s = Math.sin(o.rotZ * k);
            const dx = p[0] - a[1], dy = p[1] - a[2];
            pos.setElement(i, [a[1] + c * dx - s * dy, a[2] + s * dx + c * dy, p[2]]);
            if (nor) { const n = get(nor, i, 3)!; nor.setElement(i, [c * n[0] - s * n[1], s * n[0] + c * n[1], n[2]]); }
          } else if (o.op === 'waist' && part === 0 && p[1] > o.y0 && p[1] < o.y1) {
            const f = p[1] < o.peak ? smooth((p[1] - o.y0) / (o.peak - o.y0)) : smooth((o.y1 - p[1]) / (o.y1 - o.peak));
            const k = 1 - (1 - o.scale) * f;
            pos.setElement(i, [o.center[0] + (p[0] - o.center[0]) * k, p[1], o.center[1] + (p[2] - o.center[1]) * k]);
          }
        }
      }
      changed = true;
    }
    mesh.setExtras({ ...extras, pose: sig });
  }
  if (changed) {
    await io.write(file, doc);
    console.log(`${key} : retouché`);
  } else console.log(`${key} : déjà à jour`);
}
