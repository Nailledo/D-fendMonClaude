import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ENEMIES, type Biome } from '@dfend/shared';

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

export const K = {
  enemy: (id: string) => `enemy:${id}`,
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
  const weight = geo.getAttribute('_weight') ?? geo.getAttribute('_WEIGHT');
  if (weight) {
    geo.setAttribute('aWeight', weight);
    geo.deleteAttribute('_weight');
  } else geo.setAttribute('aWeight', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1));
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

/** Charge (une fois) les modèles demandés qui existent dans le manifeste. */
export async function ensureModels(keys: Iterable<string>): Promise<void> {
  const man = await loadManifest();
  const jobs: Promise<void>[] = [];
  for (const key of keys) {
    const meta = man[key];
    if (!meta || loaded.has(key)) continue;
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
    jobs.push(p);
  }
  await Promise.all(jobs);
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
  keys.push(K.gate(biome), K.spawn(biome));
  if (manifest) for (const k of Object.keys(manifest)) if (k.startsWith(`decor:${biome}:`)) keys.push(k);
  return keys;
}

/** Modèles utilisés par les portraits et l'encyclopédie (héros, ennemis, tours, soldats). */
export function portraitModelKeys(): string[] {
  const keys: string[] = [];
  for (const id of ['samuel', 'lyra', 'brom', 'nox', 'ethan', 'roi']) keys.push(K.hero(id));
  for (const e of ENEMIES) keys.push(K.enemy(e.id));
  for (let f = 0; f < 4; f++) for (let l = 0; l < 5; l++) keys.push(K.tower(f, l));
  for (let k = 0; k < 8; k++) keys.push(K.soldier(k));
  return keys;
}
