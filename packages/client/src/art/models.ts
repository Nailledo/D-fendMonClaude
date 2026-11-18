import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { ENEMIES, HERO_IDS, type Biome } from '@dfend/shared';

/**
 * Bibliothèque de modèles importés (GLB cuits par `pnpm models:bake`).
 * Chaque modèle est un seul maillage, couleurs de sommets + texture optionnelle,
 * avec l'attribut `aAnim` (partie animée, pivot) attendu par le vertex shader.
 * Un modèle absent du manifeste retombe sur l'art construit en code.
 */
export interface ModelMeta {
  file: string;
  /** hauteur normalisée (unités monde) */
  height: number;
  /** hauteur d'origine des projectiles (tours) */
  muzzleY?: number;
  /** triangles après cuisson (information) */
  tris?: number;
  /** texture à transparence découpée (feuillages, herbes) */
  cutout?: boolean;
}

export interface LoadedModel {
  geo: THREE.BufferGeometry;
  map: THREE.Texture | null;
  meta: ModelMeta;
}

/** ennemis qui reprennent le modèle d'un autre (le chapardeur est un gobelin, reconnaissable à sa teinte et son sac) */
const ENEMY_ALIAS: Record<string, string> = { chapardeur: 'gobelin' };

export const K = {
  enemy: (id: string) => `enemy:${ENEMY_ALIAS[id] ?? id}`,
  hero: (id: string) => `hero:${id}`,
  soldier: (kind: number) => `soldier:${kind}`,
  tower: (fam: number, level: number) => `tower:${fam}-${level}`,
  decor: (biome: Biome, name: string, variant: number) => `decor:${biome}:${name}:${variant}`,
  gate: (biome: Biome) => `gate:${biome}`,
  spawn: (biome: Biome) => `spawn:${biome}`,
};

const BASE = import.meta.env.BASE_URL + 'models/';
let manifest: Record<string, ModelMeta> | null = null;
let manifestP: Promise<Record<string, ModelMeta>> | null = null;
const loaded = new Map<string, LoadedModel>();
const pending = new Map<string, Promise<void>>();
const loader = new GLTFLoader();

export function loadManifest(): Promise<Record<string, ModelMeta>> {
  if (manifest) return Promise.resolve(manifest);
  return (manifestP ??= fetch(BASE + 'manifest.json')
    .then((r) => (r.ok ? r.json() : { models: {} }))
    .then((j: { models?: Record<string, ModelMeta> }) => (manifest = j.models ?? {}))
    .catch(() => (manifest = {})));
}

function adopt(gltf: { scene: THREE.Object3D }, meta: ModelMeta): LoadedModel | null {
  let mesh: THREE.Mesh | null = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) return null;
  const m = mesh as THREE.Mesh;
  const geo = m.geometry;
  if (!m.matrixWorld.equals(new THREE.Matrix4())) geo.applyMatrix4(m.matrixWorld);
  const anim = geo.getAttribute('_anim') ?? geo.getAttribute('_ANIM');
  if (anim) {
    geo.setAttribute('aAnim', anim);
    geo.deleteAttribute('_anim');
  } else geo.setAttribute('aAnim', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
  if (meta.file.startsWith('enemy-')) rightHanded(geo);
  const weight = geo.getAttribute('_weight') ?? geo.getAttribute('_WEIGHT');
  if (weight) {
    geo.setAttribute('aWeight', weight);
    geo.deleteAttribute('_weight');
  } else geo.setAttribute('aWeight', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1));
  // sommets de peau des héros (pnpm models:skins) : teintés par la couleur de peau choisie
  const skin = geo.getAttribute('_skin') ?? geo.getAttribute('_SKIN');
  if (skin) {
    geo.setAttribute('aSkin', skin);
    geo.deleteAttribute('_skin');
  } else geo.setAttribute('aSkin', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
  anchorHeld(geo);
  softenShoulders(geo);
  if (!geo.getAttribute('color')) {
    const c = new Float32Array(geo.attributes.position.count * 3).fill(1);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
  const map = (mat?.map as THREE.Texture | undefined) ?? null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 2;
    map.userData.cutout = !!meta.cutout;
    map.needsUpdate = true;
  }
  mat?.dispose();
  return { geo, map, meta };
}

/**
 * Armes et boucliers tenus en main : la cuisson leur a donné leur propre pivot (le haut de l'objet),
 * si bien qu'ils tournaient sur eux-mêmes, décalés de la main. Tout ce qui appartient à un bras
 * pivote désormais autour de l'épaule de ce bras (le pivot le plus haut) : l'objet reste ancré dans la main.
 */
function anchorHeld(geo: THREE.BufferGeometry) {
  const a = geo.getAttribute('aAnim') as THREE.BufferAttribute;
  for (const part of [3, 4]) {
    let best = -1, by = -Infinity;
    for (let i = 0; i < a.count; i++) if (Math.round(a.getX(i)) === part && a.getZ(i) > by) { by = a.getZ(i); best = i; }
    if (best < 0) continue;
    const sx = a.getY(best), sz = a.getW(best);
    for (let i = 0; i < a.count; i++) if (Math.round(a.getX(i)) === part) a.setXYZW(i, part, sx, by, sz);
  }
  a.needsUpdate = true;
}

/**
 * Monstres armés de la main gauche (brute, Grôlbak, démon cornu, Kessin…) : l'animation de frappe lève
 * le bras droit, qui tapait donc à vide pendant que l'arme restait en bas. Le bras qui porte l'arme
 * (nettement plus de sommets) est repéré ; s'il est à gauche, le modèle est retourné en miroir
 * (x → -x, faces et normales comprises) et les parties gauche/droite échangées : l'arme passe dans la
 * main qui frappe, la marche reste naturelle (bras opposé à la jambe).
 */
function rightHanded(geo: THREE.BufferGeometry) {
  const a = geo.getAttribute('aAnim') as THREE.BufferAttribute;
  let nl = 0, nr = 0;
  for (let i = 0; i < a.count; i++) {
    const part = Math.round(a.getX(i));
    if (part === 3) nl++;
    else if (part === 4) nr++;
  }
  if (!geo.index || !nr || nl < nr * 1.4) return;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setX(i, -pos.getX(i));
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nor) for (let i = 0; i < nor.count; i++) nor.setX(i, -nor.getX(i));
  const swap: Record<number, number> = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5 };
  for (let i = 0; i < a.count; i++) {
    const part = Math.round(a.getX(i));
    a.setXYZW(i, swap[part] ?? part, -a.getY(i), a.getZ(i), a.getW(i));
  }
  // miroir : l'ordre des sommets de chaque triangle s'inverse, sinon les faces seraient retournées
  const idx = geo.index;
  for (let t = 0; t + 2 < idx.count; t += 3) {
    const b = idx.getX(t + 1);
    idx.setX(t + 1, idx.getX(t + 2));
    idx.setX(t + 2, b);
  }
  pos.needsUpdate = a.needsUpdate = idx.needsUpdate = true;
  if (nor) nor.needsUpdate = true;
}

/**
 * Épaules : la cuisson range le haut de l'épaule (et l'emmanchure) dans le bras. Bras levé, ce morceau
 * pivotait en bloc et se détachait du torse. Au-dessus du pivot, le bras reste donc collé au corps ;
 * en dessous, il suit progressivement la rotation (sur ~15 cm), comme une peau qui s'étire.
 */
function softenShoulders(geo: THREE.BufferGeometry) {
  const a = geo.getAttribute('aAnim') as THREE.BufferAttribute;
  const w = geo.getAttribute('aWeight') as THREE.BufferAttribute;
  const pos = geo.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const part = Math.round(a.getX(i));
    if (part !== 3 && part !== 4) continue;
    const t = Math.min(1, Math.max(0, (a.getZ(i) - pos.getY(i) + 0.03) / 0.18));
    w.setX(i, Math.min(w.getX(i), t * t * (3 - 2 * t)));
  }
  w.needsUpdate = true;
}

/**
 * Charge (une fois) les modèles demandés qui existent dans le manifeste.
 * `onProgress(fait, total)` suit l'avancement (modèles déjà chargés comptés comme faits).
 */
export async function ensureModels(keys: Iterable<string>, onProgress?: (done: number, total: number) => void): Promise<void> {
  const man = await loadManifest();
  const jobs: Promise<void>[] = [];
  const list = [...new Set(keys)].filter((k) => man[k]);
  let done = list.filter((k) => loaded.has(k)).length;
  onProgress?.(done, list.length);
  for (const key of list) {
    const meta = man[key];
    if (loaded.has(key)) continue;
    let p = pending.get(key);
    if (!p) {
      p = loader
        .loadAsync(BASE + meta.file)
        .then((g) => {
          const lm = adopt(g, meta);
          if (lm) loaded.set(key, lm);
        })
        .catch((e) => console.warn(`Modèle ${key} (${meta.file}) non chargé :`, e))
        .finally(() => pending.delete(key));
      pending.set(key, p);
    }
    jobs.push(p.then(() => onProgress?.(++done, list.length)));
  }
  await Promise.all(jobs);
}

// ---------------------------------------------------------------- niveaux de détail

/** proportion de triangles gardés par niveau de détail (0 = modèle complet) */
const LOD_RATIOS = [1, 0.45, 0.2];
const LOD_ERRORS = [0, 0.012, 0.035];
let simplifierReady: Promise<boolean> | null = null;
function simplifier() {
  return (simplifierReady ??= MeshoptSimplifier.supported ? MeshoptSimplifier.ready.then(() => true, () => false) : Promise.resolve(false));
}

/**
 * Niveaux de détail d'une géométrie indexée : même tampon de sommets (couleurs, parties animées, UV),
 * seul l'index change. Rangés dans `geo.userData.lods` (le premier est l'index d'origine).
 */
export function makeLods(geo: THREE.BufferGeometry) {
  if (geo.userData.lods || !geo.index) return;
  const pos = geo.attributes.position;
  const src = geo.index.array;
  const idx = src instanceof Uint32Array ? src : new Uint32Array(src);
  const flat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { flat[i * 3] = pos.getX(i); flat[i * 3 + 1] = pos.getY(i); flat[i * 3 + 2] = pos.getZ(i); }
  const lods: THREE.BufferAttribute[] = [geo.index];
  let prev = idx;
  for (let l = 1; l < LOD_RATIOS.length; l++) {
    // sous ~300 triangles, simplifier n'apporte rien et abîme la silhouette
    if (idx.length / 3 < 300) { lods.push(lods[l - 1]); continue; }
    const target = Math.max(3 * 60, Math.floor((idx.length * LOD_RATIOS[l]) / 3) * 3);
    const [out, n] = MeshoptSimplifier.simplify(idx, flat, 3, target, LOD_ERRORS[l]);
    const arr = n > 0 && out.length < prev.length * 0.92 ? out : prev;
    const attr = arr === prev ? lods[l - 1] : new THREE.BufferAttribute(pos.count < 65536 ? new Uint16Array(arr) : arr, 1);
    lods.push(attr);
    prev = arr;
  }
  geo.userData.lods = lods;
}

/** Prépare les niveaux de détail des modèles chargés (par lots, pour ne pas figer l'écran de chargement). */
export async function buildLods(keys: Iterable<string>, onProgress?: (done: number, total: number) => void) {
  if (!(await simplifier())) return;
  const list = [...new Set(keys)].map((k) => loaded.get(k)).filter((m): m is LoadedModel => !!m && !m.geo.userData.lods);
  let t0 = performance.now();
  for (let i = 0; i < list.length; i++) {
    try {
      makeLods(list[i].geo);
    } catch (e) {
      console.warn('LOD impossible :', e);
      list[i].geo.userData.lods = [list[i].geo.index];
    }
    if (performance.now() - t0 > 12) {
      onProgress?.(i + 1, list.length);
      await new Promise((r) => setTimeout(r, 0));
      t0 = performance.now();
    }
  }
  onProgress?.(list.length, list.length);
}

/** Modèle importé s'il est chargé, sinon undefined (l'appelant retombe sur l'art en code). */
export function model(key: string): LoadedModel | undefined {
  return loaded.get(key);
}

/** Géométrie + texture pour une clé, avec repli sur l'art construit en code. */
export function geoFor(key: string, fallback: () => THREE.BufferGeometry): { geo: THREE.BufferGeometry; map: THREE.Texture | null } {
  const m = loaded.get(key);
  return m ? { geo: m.geo, map: m.map } : { geo: fallback(), map: null };
}

/** Toutes les clés utiles à une partie sur un biome donné. */
export function gameModelKeys(biome: Biome, enemyIds: string[], heroIds: string[]): string[] {
  const keys: string[] = [];
  for (const id of enemyIds) keys.push(K.enemy(id));
  for (const id of heroIds) keys.push(K.hero(id));
  for (let k = 0; k < 8; k++) keys.push(K.soldier(k));
  for (let f = 0; f < 4; f++) for (let l = 0; l < 5; l++) keys.push(K.tower(f, l));
  if (manifest) for (const k of Object.keys(manifest)) if (k.startsWith(`decor:${biome}:`)) keys.push(k);
  return keys;
}

/** Modèles utilisés par les portraits et l'encyclopédie (héros, ennemis, tours, soldats). */
export function portraitModelKeys(): string[] {
  const keys: string[] = [];
  for (const id of [...HERO_IDS, 'ethan', 'roi', 'narrateur']) keys.push(K.hero(id));
  for (const e of ENEMIES) keys.push(K.enemy(e.id));
  for (let f = 0; f < 4; f++) for (let l = 0; l < 5; l++) keys.push(K.tower(f, l));
  for (let k = 0; k < 8; k++) keys.push(K.soldier(k));
  return keys;
}
