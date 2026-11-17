import * as THREE from 'three';
import { PATH_HALF_WIDTH, Rng, type RuntimeMap, type SampledPath } from '@dfend/shared';
import { DECOR, THEMES, decorGeometry, gateGeometry, spawnGeometry, type BiomeTheme } from '../art/decor';
import { K, geoFor, model } from '../art/models';
import { slotGeometry } from '../art/towers';
import { settings } from '../settings';
import { InstPool, staticInstances } from './InstPool';
import { liquidMaterial, terrainMaterial, worldMaterial } from './materials';

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const _c = new THREE.Color();
const _c2 = new THREE.Color();

export interface WorldInfo {
  group: THREE.Group;
  theme: BiomeTheme;
  entries: { x: number; z: number; path: number }[];
  exit: { x: number; z: number };
  slotPool: InstPool;
  lockedPool: InstPool;
  /** hauteur du terrain en (x, z) (interpolée sur la grille) */
  heightAt: (x: number, z: number) => number;
}

/** Point où le chemin entre dans la zone jouable. */
function boundaryPoint(p: SampledPath, hw: number, hh: number, fromEnd: boolean) {
  const inside = (i: number) => Math.abs(p.xs[i]) < hw - 1.5 && Math.abs(p.zs[i]) < hh - 1.5;
  if (!fromEnd) {
    for (let i = 0; i < p.count; i++) if (inside(i)) return { x: p.xs[i], z: p.zs[i], i };
  } else {
    for (let i = p.count - 1; i >= 0; i--) if (inside(i)) return { x: p.xs[i], z: p.zs[i], i };
  }
  return { x: p.xs[0], z: p.zs[0], i: 0 };
}

export function buildWorld(map: RuntimeMap): WorldInfo {
  const def = map.def;
  const theme = THEMES[def.biome];
  const group = new THREE.Group();
  const mat = worldMaterial();
  const rng = new Rng(def.id.length * 7717 + 3);
  const paths = map.paths;
  const pools = def.pools ?? [];

  const distPath = (x: number, z: number) => {
    let best = Infinity;
    for (const p of paths) best = Math.min(best, p.minDist2(x, z, 2));
    return Math.sqrt(best);
  };
  const distPool = (x: number, z: number) => {
    let best = Infinity;
    for (const [px, pz, r] of pools) best = Math.min(best, Math.sqrt((x - px) ** 2 + (z - pz) ** 2) - r);
    return best;
  };

  // ------------------------------------------------ terrain
  const W = 112, H = 84, SX = 112, SZ = 84;
  const plane = new THREE.PlaneGeometry(W, H, SX, SZ);
  plane.rotateX(-Math.PI / 2);
  const pos = plane.attributes.position as THREE.BufferAttribute;
  const heights = new Float32Array(pos.count);
  const dists = new Float32Array(pos.count);
  const distSlot = (x: number, z: number) => {
    let best = Infinity;
    for (const s of map.slots) best = Math.min(best, (x - s.x) ** 2 + (z - s.z) ** 2);
    return Math.sqrt(best);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const dp = distPath(x, z);
    dists[i] = dp;
    const outside = Math.max(Math.abs(x) - def.hw, Math.abs(z) - def.hh, 0);
    // collines extérieures : deux octaves de bruit, crêtes arrondies
    const n1 = noise(x * 0.11, z * 0.11), n2 = noise(x * 0.27 + 7, z * 0.27 + 3);
    let h = smooth(0, 11, outside) * (3 + n1 * 4.5 + (n2 - 0.5) * 1.6);
    // ondulations douces de la plaine jouable
    h += (noise(x * 0.3, z * 0.3) - 0.5) * 0.3 + (noise(x * 0.9 + 2, z * 0.9) - 0.5) * 0.08;
    h *= smooth(PATH_HALF_WIDTH + 0.3, PATH_HALF_WIDTH + 4, dp);
    h *= 0.35 + 0.65 * smooth(1.6, 3.2, distSlot(x, z));
    const dpool = distPool(x, z);
    if (dpool < 1.2) h = Math.min(h, -0.55 * smooth(1.2, -0.6, dpool));
    // plaine plus basse au sud (vers la caméra) pour ne pas masquer la vue
    if (z > def.hh) h *= 0.45;
    heights[i] = h;
    pos.setY(i, h);
  }
  // carte de distances (chemin, mares) lue par le shader du sol : 3 texels par unité
  const MW = W * 3, MH = H * 3;
  const maskData = new Uint8Array(MW * MH * 4);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const x = -W / 2 + (i + 0.5) / 3, z = -H / 2 + (j + 0.5) / 3;
    let d2 = Infinity;
    for (const p of paths) d2 = Math.min(d2, p.minDist2(x, z, 1));
    const o = (j * MW + i) * 4;
    maskData[o] = Math.round(Math.min(1, Math.sqrt(d2) / 6) * 255);
    maskData[o + 1] = Math.round(Math.max(0, Math.min(1, (distPool(x, z) + 1.5) / 6)) * 255);
    maskData[o + 3] = 255;
  }
  const mask = new THREE.DataTexture(maskData, MW, MH, THREE.RGBAFormat);
  mask.magFilter = THREE.LinearFilter;
  mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;
  // terrain lisse (sommets partagés) : la couleur vient du shader, plus de facettes en damier
  plane.computeVertexNormals();
  const terrain = new THREE.Mesh(plane, terrainMaterial(theme, mask, [-W / 2, -H / 2, W, H], PATH_HALF_WIDTH));
  terrain.receiveShadow = true;
  group.add(terrain);
  void mat; void dists;

  // ------------------------------------------------ eau / lave / vase
  const liq = liquidMaterial(theme.liquid);
  for (const [px, pz, r] of pools) {
    // rive irrégulière : rayon modulé par du bruit, anneaux concentriques pour le dégradé
    const seg = 48, rings = 6, R = r + 0.4;
    const verts: number[] = [0, 0, 0], edges: number[] = [0], idx: number[] = [];
    for (let k = 1; k <= rings; k++) for (let a = 0; a < seg; a++) {
      const ang = (a / seg) * Math.PI * 2, f = k / rings;
      const wob = 1 + (noise(px + Math.cos(ang) * 2.2, pz + Math.sin(ang) * 2.2) - 0.5) * 0.28 * f;
      verts.push(Math.cos(ang) * R * f * wob, 0, Math.sin(ang) * R * f * wob);
      edges.push(f);
    }
    for (let a = 0; a < seg; a++) idx.push(0, 1 + ((a + 1) % seg), 1 + a);
    for (let k = 1; k < rings; k++) for (let a = 0; a < seg; a++) {
      const i0 = 1 + (k - 1) * seg + a, i1 = 1 + (k - 1) * seg + ((a + 1) % seg);
      const o0 = i0 + seg, o1 = i1 + seg;
      idx.push(i0, i1, o1, i0, o1, o0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('edge', new THREE.Float32BufferAttribute(edges, 1));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, liq);
    m.position.set(px, -0.12, pz);
    group.add(m);
  }

  // ------------------------------------------------ décor
  const dens = settings.decorDensity;
  const occupied: [number, number, number][] = map.slots.map((s) => [s.x, s.z, 1.9]);
  const entries = paths.map((p, i) => ({ ...boundaryPoint(p, def.hw, def.hh, false), path: i }));
  const ex = boundaryPoint(paths[0], def.hw, def.hh, true);
  const exit = { x: ex.x, z: ex.z };
  occupied.push([exit.x, exit.z, 6]);
  for (const e of entries) occupied.push([e.x, e.z, 3.5]);
  const items = new Map<string, { x: number; y: number; z: number; yaw: number; s: number }[]>();
  const pickWeighted = (list: [string, number][]) => {
    let tot = 0;
    for (const [, w] of list) tot += w;
    let r = rng.next() * tot;
    for (const [n, w] of list) if ((r -= w) <= 0) return n;
    return list[0][0];
  };
  const tryPlace = (x: number, z: number, inner: boolean) => {
    const dp = distPath(x, z);
    if (dp < PATH_HALF_WIDTH + 0.9) return;
    if (distPool(x, z) < 0.6) return;
    for (const [ox, oz, r] of occupied) if ((x - ox) ** 2 + (z - oz) ** 2 < r * r) return;
    const name = pickWeighted(inner ? DECOR[def.biome].inner : DECOR[def.biome].outer);
    // les grands éléments restent loin du chemin
    if (/chene|sapin|saule|basalte|pic|arbre/.test(name) && dp < PATH_HALF_WIDTH + 2.2) return;
    const variant = rng.int(0, 2);
    const key = name + '|' + variant;
    const ix = Math.round((x + W / 2) / (W / SX)), iz = Math.round((z + H / 2) / (H / SZ));
    const hy = heights[Math.max(0, Math.min(heights.length - 1, iz * (SX + 1) + ix))] ?? 0;
    const s = (inner ? 0.75 : 1) * rng.range(0.8, 1.3);
    if (!items.has(key)) items.set(key, []);
    items.get(key)!.push({ x, y: Math.max(hy, 0) - 0.05, z, yaw: rng.next() * Math.PI * 2, s });
    if (/chene|sapin|saule|basalte/.test(name)) occupied.push([x, z, 1.1 * s]);
  };
  const innerN = Math.round(def.hw * def.hh * 0.32 * dens);
  for (let i = 0; i < innerN; i++) tryPlace(rng.range(-def.hw, def.hw), rng.range(-def.hh, def.hh), true);
  const outerN = Math.round(650 * dens);
  for (let i = 0; i < outerN; i++) {
    const x = rng.range(-W / 2 + 4, W / 2 - 4), z = rng.range(-H / 2 + 4, H / 2 - 12);
    if (Math.abs(x) < def.hw - 0.5 && Math.abs(z) < def.hh - 0.5) continue;
    if (z > def.hh + 3) continue; // dégager le bas de l'écran
    tryPlace(x, z, false);
  }
  // bordures de chemin : petites pierres, herbes et fleurs juste à côté de la terre battue
  const edgeSet = (DECOR[def.biome].inner.map(([n]) => n) as string[]).filter((n) => /herbe|fleurs|rocher|roseaux|champignon|crane|cristal/.test(n));
  if (edgeSet.length) for (const p of paths) {
    for (let d = 1; d < p.length; d += 1.1) {
      if (rng.next() > 0.55 * dens) continue;
      const i = Math.min(p.count - 1, Math.floor(d / 0.25));
      const side = rng.next() < 0.5 ? -1 : 1;
      const off = PATH_HALF_WIDTH + rng.range(0.35, 0.95);
      const x = p.xs[i] + p.nx[i] * side * off, z = p.zs[i] + p.nz[i] * side * off;
      if (!(Math.abs(x) < def.hw && Math.abs(z) < def.hh)) continue;
      if (distPool(x, z) < 0.4) continue;
      let blocked = false;
      for (const [ox, oz, r] of occupied) if ((x - ox) ** 2 + (z - oz) ** 2 < (r - 0.6) ** 2) { blocked = true; break; }
      if (blocked) continue;
      const name = edgeSet[rng.int(0, edgeSet.length - 1)];
      const key = name + '|' + rng.int(0, 2);
      if (!items.has(key)) items.set(key, []);
      items.get(key)!.push({ x, y: 0.02, z, yaw: rng.next() * Math.PI * 2, s: rng.range(0.3, 0.55) });
    }
  }
  for (const [key, list] of items) {
    const [name, v] = key.split('|');
    const big = /chene|sapin|saule|basalte|pic|arbre/.test(name);
    // GLB importé (variante demandée, sinon variante 0), sinon art en code
    const g = model(K.decor(def.biome, name, +v)) ?? model(K.decor(def.biome, name, 0));
    staticInstances(g ? g.geo : decorGeometry(def.biome, name, +v), list, group, big && settings.shadows, g ? g.map : null);
  }

  // ------------------------------------------------ porte et entrées
  const gi = ex.i;
  const p0 = paths[0];
  const gj = Math.min(p0.count - 1, gi + 8);
  const gateG = geoFor(K.gate(def.biome), () => gateGeometry(def.biome));
  const gatePool = new InstPool(gateG.geo, 1, group, settings.shadows, gateG.map);
  gatePool.begin();
  const gidx = gatePool.push(p0.xs[gj], 0, p0.zs[gj], Math.atan2(p0.nx[gi], p0.nz[gi]) + Math.PI / 2, 0.85);
  gatePool.setTeam(gidx, 0x1e3a8a);
  gatePool.end();
  const spawnG = geoFor(K.spawn(def.biome), () => spawnGeometry(def.biome));
  const spawnPool = new InstPool(spawnG.geo, entries.length, group, false, spawnG.map);
  spawnPool.begin();
  for (const e of entries) {
    const p = paths[e.path];
    spawnPool.push(e.x, 0, e.z, Math.atan2(p.nx[e.i], p.nz[e.i]) + Math.PI / 2, 1);
  }
  spawnPool.end();

  // ------------------------------------------------ emplacements
  const slotPool = new InstPool(slotGeometry(false), map.slots.length, group, false);
  const lockedPool = new InstPool(slotGeometry(true), map.slots.length, group, false);
  slotPool.mesh.receiveShadow = true;

  const heightAt = (x: number, z: number) => {
    const fx = Math.max(0, Math.min(SX - 1.001, (x + W / 2) / (W / SX))), fz = Math.max(0, Math.min(SZ - 1.001, (z + H / 2) / (H / SZ)));
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
    const h = (i: number, j: number) => heights[j * (SX + 1) + i] ?? 0;
    return (h(ix, iz) * (1 - u) + h(ix + 1, iz) * u) * (1 - v) + (h(ix, iz + 1) * (1 - u) + h(ix + 1, iz + 1) * u) * v;
  };
  return { group, theme, entries, exit, slotPool, lockedPool, heightAt };
}
