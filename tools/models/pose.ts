/**
 * Retouches de pose des modèles déjà cuits (public/models/*.glb) :
 *   pnpm models:pose
 *
 * Écarte ou pivote un membre autour de son articulation quand il traverse le corps
 * (ex. le bras libre de la brute qui passait dans la ceinture). Le fondu `_WEIGHT` près
 * de l'épaule est respecté, les normales suivent. À relancer après `models:bake` ou
 * `models:fixparts`, qui régénèrent les fichiers ; une retouche déjà appliquée n'est pas
 * refaite (elle est notée dans les `extras` du maillage).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

interface Tweak {
  /** partie animée (3 : bras gauche du modèle, 4 : bras droit) */
  part: number;
  /** roulis autour de l'axe avant-arrière (radians) ; négatif : écarte vers -x */
  rotZ: number;
  /** hauteur sous l'épaule où le roulis est complet : au-dessus, il décroît jusqu'à 0 à l'épaule,
   *  pour que le bras se plie au lieu de se décoller du torse */
  ramp: number;
}

/** clé du fichier (sans « .glb ») → retouches */
const POSE: Record<string, Tweak[]> = {
  // bras droit (sans massue) : il frôlait la ceinture au repos et la traversait en marchant
  'enemy-brute': [{ part: 4, rotZ: -0.2, ramp: 0.45 }],
};

for (const [key, tweaks] of Object.entries(POSE)) {
  const file = join(MODELS, key + '.glb');
  const doc = await io.read(file);
  let changed = false;
  for (const mesh of doc.getRoot().listMeshes()) {
    const extras = (mesh.getExtras() ?? {}) as { pose?: string };
    const sig = JSON.stringify(tweaks);
    if (extras.pose === sig) continue;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), anim = prim.getAttribute('_ANIM'), wt = prim.getAttribute('_WEIGHT');
      if (!pos || !anim) continue;
      const p = [0, 0, 0], n = [0, 0, 0], a = [0, 0, 0, 0], w = [1];
      for (let i = 0; i < pos.getCount(); i++) {
        anim.getElement(i, a);
        const t = tweaks.find((tw) => tw.part === Math.round(a[0]));
        if (!t) continue;
        pos.getElement(i, p);
        // rien ne bouge à l'épaule, roulis complet à `ramp` en dessous (courbe douce)
        const f = Math.min(1, Math.max(0, (a[2] - p[1]) / t.ramp));
        const k = (wt ? (wt.getElement(i, w), w[0]) : 1) * f * f * (3 - 2 * f);
        const c = Math.cos(t.rotZ * k), s = Math.sin(t.rotZ * k);
        const dx = p[0] - a[1], dy = p[1] - a[2];
        pos.setElement(i, [a[1] + c * dx - s * dy, a[2] + s * dx + c * dy, p[2]]);
        if (nor) {
          nor.getElement(i, n);
          nor.setElement(i, [c * n[0] - s * n[1], s * n[0] + c * n[1], n[2]]);
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
