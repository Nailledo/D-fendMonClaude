/**
 * Chevaliers (soldats 2 et 3, chevalier infernal) : après simplification, la tête du modèle KayKit
 * traversait le casque sur les côtés. On rentre les sommets de peau de la tête vers son centre,
 * pour qu'ils restent sous le casque (le visage reste visible par l'ouverture).
 *   pnpm tsx tools/models/fixhelmet.ts
 * Une seule fois par modèle : le fichier porte ensuite la marque `extras.helmetFixed`.
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

for (const file of ['soldier-2.glb', 'soldier-3.glb', 'enemy-chevalierinf.glb']) {
  const path = join(MODELS, file);
  const doc = await io.read(path);
  const root = doc.getRoot();
  if ((root.getExtras() as { helmetFixed?: boolean }).helmetFixed) { console.log(file, 'déjà corrigé'); continue; }
  const prim = root.listMeshes()[0].listPrimitives()[0];
  const tex = prim.getMaterial()!.getBaseColorTexture()!;
  const bytes = tex.getImage()!;
  const img = tex.getMimeType() === 'image/png'
    ? (() => { const p = PNG.sync.read(Buffer.from(bytes)); return { w: p.width, h: p.height, data: p.data as Uint8Array }; })()
    : (() => { const j = jpeg.decode(bytes, { useTArray: true }); return { w: j.width, h: j.height, data: j.data }; })();
  const P = prim.getAttribute('POSITION')!, UV = prim.getAttribute('TEXCOORD_0')!;
  const p = [0, 0, 0], uv = [0, 0];
  // centre et hauteur de la tête : tout ce qui est au-dessus du cou
  let ymax = -Infinity;
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); ymax = Math.max(ymax, p[1]); }
  const neck = ymax * 0.63, cy = ymax * 0.8;
  let n = 0;
  for (let i = 0; i < P.getCount(); i++) {
    P.getElement(i, p);
    if (p[1] < neck) continue;
    UV.getElement(i, uv);
    const x = Math.min(img.w - 1, Math.floor((uv[0] - Math.floor(uv[0])) * img.w));
    const y = Math.min(img.h - 1, Math.floor((uv[1] - Math.floor(uv[1])) * img.h));
    const o = (y * img.w + x) * 4;
    const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    // peau : rose-orangé (rouge dominant, bleu faible), à distinguer du métal gris du casque
    if (!(r > 150 && r > g * 1.15 && g > b * 1.2)) continue;
    P.setElement(i, [p[0] * 0.84, cy + (p[1] - cy) * (p[1] > cy ? 0.86 : 0.94), p[2] * 0.86 - 0.01]);
    n++;
  }
  root.setExtras({ ...root.getExtras(), helmetFixed: true });
  await io.write(path, doc);
  console.log(file, n, 'sommets de peau rentrés');
}
