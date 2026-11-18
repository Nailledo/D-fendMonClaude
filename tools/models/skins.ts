/**
 * Peau des personnages jouables : marque les sommets de peau (attribut _SKIN, 0 ou 1) des modèles de héros,
 * pour que le jeu puisse leur appliquer la couleur de peau choisie par le joueur (voir SKIN_TONES).
 *   pnpm models:skins
 * À relancer après `pnpm models:bake` ou `pnpm models:kitbash`, qui réécrivent ces fichiers.
 *
 * Un sommet est de la peau quand la couleur vue à cet endroit (texel de la texture × couleur de sommet) est
 * un rose-orangé clair et peu saturé : les cheveux blonds ou roux sont plus saturés, le cuir plus sombre,
 * les barbes blanches presque sans teinte. Affiche la couleur moyenne de peau trouvée (référence de SKIN_BASE).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { HERO_IDS } from '../../packages/shared/src/types';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

function decode(bytes: Uint8Array, mime: string) {
  if (mime === 'image/png') {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { w: p.width, h: p.height, data: p.data as Uint8Array };
  }
  const j = jpeg.decode(bytes, { useTArray: true });
  return { w: j.width, h: j.height, data: j.data };
}

/** teinte (degrés), saturation, valeur */
function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-5) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx > 0 ? d / mx : 0, mx];
}
export const isSkin = (r: number, g: number, b: number) => {
  const [h, s, v] = hsv(r, g, b);
  // peau teintée plus chaude (le nain) : plus saturée, mais toujours très claire
  return h >= 8 && h <= 38 && s >= 0.14 && v >= 0.62 && (s <= 0.48 || (v >= 0.85 && s <= 0.66));
};

const total = [0, 0, 0];
let count = 0;
const only = process.argv.slice(2);
for (const id of HERO_IDS) {
  if (only.length && !only.includes(id)) continue;
  const file = `hero-${id}.glb`;
  const doc = await io.read(join(MODELS, file));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const tex = prim.getMaterial()?.getBaseColorTexture() ?? doc.getRoot().listTextures()[0];
  const img = tex ? decode(tex.getImage()!, tex.getMimeType()) : null;
  const uv = prim.getAttribute('TEXCOORD_0'), col = prim.getAttribute('COLOR_0');
  const n = prim.getAttribute('POSITION')!.getCount();
  const flag = new Float32Array(n);
  const e2 = [0, 0], e3 = [1, 1, 1, 1];
  let k = 0;
  for (let i = 0; i < n; i++) {
    let r = 1, g = 1, b = 1;
    if (img && uv) {
      uv.getElement(i, e2);
      const x = Math.min(img.w - 1, Math.max(0, Math.floor((e2[0] - Math.floor(e2[0])) * img.w)));
      const y = Math.min(img.h - 1, Math.max(0, Math.floor((e2[1] - Math.floor(e2[1])) * img.h)));
      const o = (y * img.w + x) * 4;
      r = img.data[o] / 255; g = img.data[o + 1] / 255; b = img.data[o + 2] / 255;
    }
    if (col) { col.getElement(i, e3); r *= e3[0]; g *= e3[1]; b *= e3[2]; }
    if (isSkin(r, g, b)) {
      flag[i] = 1; k++;
      total[0] += r; total[1] += g; total[2] += b; count++;
    }
  }
  const buf = doc.getRoot().listBuffers()[0];
  prim.setAttribute('_SKIN', doc.createAccessor().setType('SCALAR').setArray(flag).setBuffer(buf));
  await io.write(join(MODELS, file), doc);
  console.log(`${file.padEnd(18)} ${k} / ${n} sommets de peau`);
}
const hex = total.map((c) => Math.round((c / Math.max(1, count)) * 255).toString(16).padStart(2, '0')).join('');
console.log(`peau moyenne : #${hex}`);
