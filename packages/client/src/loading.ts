import type * as THREE from 'three';
import { ui } from './state.svelte';

/**
 * Écran de chargement : avancement 0..1 et étape affichée.
 * Les étapes longues rendent la main au navigateur entre deux lots pour que la barre avance réellement.
 */
let shownAt = 0;

export function startLoading(label: string, title = '') {
  ui.loading = { active: true, progress: 0, label, title };
  shownAt = performance.now();
}

export function setLoading(progress: number, label?: string) {
  ui.loading.progress = Math.max(ui.loading.progress, Math.min(1, progress));
  if (label) ui.loading.label = label;
}

/** Sous-étape : projette un avancement local (0..1) dans [a, b] de la barre. */
export const span = (a: number, b: number, label?: string) => (done: number, total: number) =>
  setLoading(a + (b - a) * (total > 0 ? done / total : 1), label);

/** Laisse le navigateur afficher une image (barre de progression) ; ne bloque pas si l'onglet est caché. */
export function nextFrame() {
  return new Promise<void>((res) => {
    let done = false;
    const go = () => { if (!done) { done = true; res(); } };
    requestAnimationFrame(go);
    setTimeout(go, 60);
  });
}

export async function endLoading(minVisible = 450) {
  setLoading(1);
  const left = minVisible - (performance.now() - shownAt);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  ui.loading.active = false;
}

/**
 * Préchauffe le rendu : compile tous les shaders (y compris ceux des ombres) et envoie les textures au GPU
 * avant que la scène ne s'affiche, pour éviter les saccades à la première apparition d'un modèle ou d'un effet.
 */
export async function warmup(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const restore: (() => void)[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number };
    if (!o.visible) {
      o.visible = true;
      restore.push(() => (o.visible = false));
    }
    if (m.isInstancedMesh && m.count === 0) {
      m.count = 1;
      restore.push(() => (m.count = 0));
    }
  });
  try {
    await gl.compileAsync(scene, camera);
    // un rendu complet : passe d'ombres, envoi des textures et des tampons
    gl.render(scene, camera);
  } catch (e) {
    console.warn('Préchauffage du rendu incomplet :', e);
  }
  for (const r of restore) r();
}
