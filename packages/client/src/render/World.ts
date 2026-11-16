import * as THREE from 'three';
import { PATH_HALF_WIDTH, Rng, type RuntimeMap, type SampledPath } from '@dfend/shared';
import { DECOR, THEMES, decorGeometry, gateGeometry, spawnGeometry, type BiomeTheme } from '../art/decor';
import { K, geoFor, model } from '../art/models';
import { slotGeometry } from '../art/towers';
import { settings } from '../settings';
import { InstPool, staticInstances } from './InstPool';
import { liquidMaterial, worldMaterial } from './materials';

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
  const geo = plane.toNonIndexed();
  const gp = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(gp.count * 3);
  const hill = new THREE.Color(theme.hill), rock = new THREE.Color(theme.hill).lerp(new THREE.Color(theme.dirtEdge), 0.55).multiplyScalar(0.9);
  const edgeDark = new THREE.Color(theme.fog).multiplyScalar(0.9);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
  for (let i = 0; i < gp.count; i += 3) {
    // couleur par face (aspect facetté), teintée par la hauteur, la pente et la distance au chemin
    const cx = (gp.getX(i) + gp.getX(i + 1) + gp.getX(i + 2)) / 3;
    const cz = (gp.getZ(i) + gp.getZ(i + 1) + gp.getZ(i + 2)) / 3;
    const cy = (gp.getY(i) + gp.getY(i + 1) + gp.getY(i + 2)) / 3;
    _a.set(gp.getX(i + 1) - gp.getX(i), gp.getY(i + 1) - gp.getY(i), gp.getZ(i + 1) - gp.getZ(i));
    _b.set(gp.getX(i + 2) - gp.getX(i), gp.getY(i + 2) - gp.getY(i), gp.getZ(i + 2) - gp.getZ(i));
    const slope = 1 - Math.abs(_n.crossVectors(_a, _b).normalize().y);
    const n = noise(cx * 0.22, cz * 0.22) * 0.7 + noise(cx * 0.6 + 5, cz * 0.6) * 0.3;
    _c.set(theme.grass[Math.floor(n * theme.grass.length * 0.999)]);
    _c2.set(theme.grass[Math.floor(hash(cx, cz) * theme.grass.length)]);
    _c.lerp(_c2, 0.18);
    if (cy > 0.8) _c.lerp(hill, smooth(0.8, 4, cy));
    if (slope > 0.3) _c.lerp(rock, smooth(0.3, 0.7, slope));
    const dp = distPath(cx, cz);
    if (dp < PATH_HALF_WIDTH + 1.6) _c.lerp(_c2.set(theme.dirtEdge), 0.5 * smooth(PATH_HALF_WIDTH + 1.6, PATH_HALF_WIDTH, dp));
    if (cy < -0.1) _c.lerp(_c2.set(theme.dirtEdge), 0.6);
    // vignette : les bords de la carte se fondent dans la brume
    const edge = Math.max(Math.abs(cx) / (W / 2), Math.abs(cz) / (H / 2));
    _c.lerp(edgeDark, smooth(0.62, 1, edge) * 0.55);
    const k = 0.96 + hash(cz, cx) * 0.07;
    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = _c.r * k;
      colors[(i + v) * 3 + 1] = _c.g * k;
      colors[(i + v) * 3 + 2] = _c.b * k;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // ------------------------------------------------ chemins (rubans)
  paths.forEach((p, pi) => {
    const step = 2; // échantillons
    const verts: number[] = [];
    const cols: number[] = [];
    const w = PATH_HALF_WIDTH + 0.15;
    const dirt = new THREE.Color(theme.dirt), edge = new THREE.Color(theme.dirtEdge);
    const y = 0.035 + pi * 0.004;
    for (let i = 0; i + step < p.count; i += step) {
      const j = Math.min(p.count - 1, i + step);
      const lx0 = p.xs[i] + p.nx[i] * w, lz0 = p.zs[i] + p.nz[i] * w;
      const rx0 = p.xs[i] - p.nx[i] * w, rz0 = p.zs[i] - p.nz[i] * w;
      const lx1 = p.xs[j] + p.nx[j] * w, lz1 = p.zs[j] + p.nz[j] * w;
      const rx1 = p.xs[j] - p.nx[j] * w, rz1 = p.zs[j] - p.nz[j] * w;
      // bande centrale + 2 bords
      const mids = [0.72, -0.72];
      const L0 = [p.xs[i] + p.nx[i] * w * mids[0], p.zs[i] + p.nz[i] * w * mids[0]];
      const R0 = [p.xs[i] + p.nx[i] * w * mids[1], p.zs[i] + p.nz[i] * w * mids[1]];
      const L1 = [p.xs[j] + p.nx[j] * w * mids[0], p.zs[j] + p.nz[j] * w * mids[0]];
      const R1 = [p.xs[j] + p.nx[j] * w * mids[1], p.zs[j] + p.nz[j] * w * mids[1]];
      const quad = (a: number[], b: number[], c: number[], d: number[], col: THREE.Color) => {
        const k = 0.93 + hash(a[0], a[1]) * 0.12;
        verts.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], b[0], y, b[1], d[0], y, d[1], c[0], y, c[1]);
        for (let v = 0; v < 6; v++) cols.push(col.r * k, col.g * k, col.b * k);
      };
      quad([lx0, lz0], [lx1, lz1], L0, L1, edge);
      quad(L0, L1, R0, R1, dirt);
      quad(R0, R1, [rx0, rz0], [rx1, rz1], edge);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
  });

  // ------------------------------------------------ eau / lave / vase
  const liq = liquidMaterial(theme.liquid);
  for (const [px, pz, r] of pools) {
    const g = new THREE.CircleGeometry(r + 0.4, 18);
    g.rotateX(-Math.PI / 2);
    const edge = new Float32Array(g.attributes.position.count);
    for (let i = 0; i < edge.length; i++) {
      const x = g.attributes.position.getX(i), z = g.attributes.position.getZ(i);
      edge[i] = Math.sqrt(x * x + z * z) / (r + 0.4);
    }
    g.setAttribute('edge', new THREE.BufferAttribute(edge, 1));
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

  return { group, theme, entries, exit, slotPool, lockedPool };
}
