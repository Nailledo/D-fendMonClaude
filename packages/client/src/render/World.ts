import * as THREE from 'three';
import { PATH_HALF_WIDTH, PropKind, Rng, boundaryPoint, type RuntimeMap } from '@dfend/shared';
import { DECOR, THEMES, decorGeometry, spawnGeometry, type BiomeTheme } from '../art/decor';
import { Castle } from './Castle';
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
  /** entrées des ennemis (bouche du tunnel) ; (ox, oz) : direction de la galerie, vers l'extérieur de la carte */
  entries: { x: number; z: number; path: number; i: number; ox: number; oz: number }[];
  exit: { x: number; z: number };
  slotPool: InstPool;
  lockedPool: InstPool;
  /** hauteur du terrain en (x, z) (interpolée sur la grille) */
  heightAt: (x: number, z: number) => number;
  /** château au bout du chemin (porte, herse, drapeaux) */
  castle: Castle;
  /** même relief en texture (une valeur par sommet de la grille) : les traces au sol l'épousent dans le shader */
  ground: { tex: THREE.DataTexture; w: number; h: number; sx: number; sz: number };
}

/**
 * Taille de chaque élément de décor (multiplicateur de son modèle), dans la zone jouable et en bordure de chemin :
 * proportions cohérentes avec les personnages (~1,7 de haut) au lieu d'une échelle unique pour tout.
 */
const DECOR_SIZE: Record<string, [number, number]> = {
  herbe: [1, 0.8], fleurs: [0.9, 0.75], buisson: [0.8, 0.6], rocher: [0.85, 0.42], roseaux: [0.9, 0.7], champignon: [0.65, 0.45],
  crane: [0.6, 0.45], cristal: [0.32, 0.2], pic: [0.55, 0.32], chene: [0.95, 0.95], arbremort: [0.85, 0.85], arbrecalcine: [0.85, 0.85],
};
/** décor solide : vient des obstacles de la carte (partagés avec la simulation), jamais tiré au hasard ici */
const SOLID = /^(rocher|chene|arbremort|arbrecalcine|pic|cristal)$/;

export interface WorldOptions {
  /** collines et décor tout autour (écran titre, caméra qui tourne) au lieu de dégager le bas de l'écran */
  surround?: boolean;
}

export function buildWorld(map: RuntimeMap, opts: WorldOptions = {}): WorldInfo {
  const def = map.def;
  const theme = THEMES[def.biome];
  const group = new THREE.Group();
  const mat = worldMaterial();
  const rng = new Rng(def.id.length * 7717 + 3);
  const paths = map.paths;
  const pools = def.pools ?? [];

  // entrées : le chemin sort d'une galerie creusée dans la colline ; en amont de la bouche, il passe sous terre
  const entries = paths.map((p, i) => {
    const b = boundaryPoint(p, def.hw, def.hh, false);
    const j = Math.min(p.count - 1, b.i + 3);
    const dx = p.xs[b.i] - p.xs[j], dz = p.zs[b.i] - p.zs[j], l = Math.hypot(dx, dz) || 1;
    return { x: b.x, z: b.z, i: b.i, path: i, ox: dx / l, oz: dz / l };
  });
  // château : sa porte enjambe le chemin juste après la sortie de la zone jouable, il s'étend au-delà
  const ex = boundaryPoint(paths[0], def.hw, def.hh, true);
  const castleAt = (() => {
    const p = paths[0], j = Math.min(p.count - 1, ex.i + 10);
    let dx = p.xs[j] - p.xs[ex.i], dz = p.zs[j] - p.zs[ex.i];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    return { x: ex.x + dx * 2.6, z: ex.z + dz * 2.6, dx, dz };
  })();
  /** emprise du château : le terrain y est aplani (cour, remparts) */
  const castleFlat = (x: number, z: number) => {
    const ox = x - castleAt.x, oz = z - castleAt.z;
    const a = ox * castleAt.dx + oz * castleAt.dz, c = Math.abs(ox * -castleAt.dz + oz * castleAt.dx);
    return (1 - smooth(10.4, 13, c)) * smooth(-4.5, -1.8, a) * (1 - smooth(11.8, 14.5, a));
  };
  /** distance au chemin visible (sans le tronçon souterrain, en amont de chaque entrée) */
  const distPathSq = (x: number, z: number, step: number) => {
    let best = Infinity;
    paths.forEach((p, k) => {
      for (let i = Math.max(0, entries[k].i - 1); i < p.count; i += step) {
        const d = (p.xs[i] - x) ** 2 + (p.zs[i] - z) ** 2;
        if (d < best) best = d;
      }
    });
    return best;
  };
  const distPath = (x: number, z: number) => Math.sqrt(distPathSq(x, z, 2));
  /** colline au-dessus de la galerie : plate devant la bouche, elle se relève derrière et sur les côtés */
  const mound = (x: number, z: number) => {
    let h = 0;
    for (const e of entries) {
      const dx = x - e.x, dz = z - e.z;
      const a = dx * e.ox + dz * e.oz, c = Math.abs(dx * -e.oz + dz * e.ox);
      if (a < -3 || a > 22 || c > 12) continue;
      // au-dessus de la galerie (|c| < 2.7), la colline ne commence qu'après le fond de la galerie
      const side = smooth(2.7, 3.9, c);
      const s0 = 3.4 + (-0.4 - 3.4) * side;
      const w = 4.2 + Math.max(0, a) * 0.35;
      const top = (e.z > 0 ? 2.6 : 3.4) + (noise(x * 0.4, z * 0.4) - 0.5) * 0.8;
      h = Math.max(h, top * smooth(s0, s0 + 1.0 + side * 0.6, a) * (1 - smooth(w, w + 4, c)) * (1 - smooth(14, 22, a)));
    }
    return h;
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
    if (z > def.hh && !opts.surround) h *= 0.45;
    const mh = mound(x, z);
    if (mh > 0.01) h = Math.max(h, mh);
    const cf = castleFlat(x, z);
    if (cf > 0) h *= 1 - cf;
    // sol de la galerie : le terrain ne dépasse pas sous la voûte
    for (const e of entries) {
      const dx = x - e.x, dz = z - e.z, a = dx * e.ox + dz * e.oz;
      if (a > -0.5 && a < 3.6 && Math.abs(dx * -e.oz + dz * e.ox) < 2.9) h = Math.min(h, -0.02);
    }
    heights[i] = h;
    pos.setY(i, h);
  }
  // carte de distances (chemin, mares) lue par le shader du sol : 3 texels par unité
  const MW = W * 3, MH = H * 3;
  const maskData = new Uint8Array(MW * MH * 4);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const x = -W / 2 + (i + 0.5) / 3, z = -H / 2 + (j + 0.5) / 3;
    let d2 = Infinity;
    d2 = distPathSq(x, z, 1);
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
  const exit = { x: ex.x, z: ex.z };
  occupied.push([exit.x, exit.z, 6], [castleAt.x + castleAt.dx * 5, castleAt.z + castleAt.dz * 5, 11.5]);
  for (const e of entries) occupied.push([e.x, e.z, 4.5], [e.x + e.ox * 2, e.z + e.oz * 2, 4]);
  // éléments interactifs : rien ne pousse dessus
  for (const p of map.props) occupied.push([p.x, p.z, p.kind === PropKind.Camp ? 2.4 : 1.2]);
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
    if (inner && SOLID.test(name)) return;
    // les grands éléments restent loin du chemin
    if (/chene|sapin|saule|basalte|pic|arbre/.test(name) && dp < PATH_HALF_WIDTH + 2.2) return;
    const variant = rng.int(0, 2);
    const key = name + '|' + variant;
    const ix = Math.round((x + W / 2) / (W / SX)), iz = Math.round((z + H / 2) / (H / SZ));
    const hy = heights[Math.max(0, Math.min(heights.length - 1, iz * (SX + 1) + ix))] ?? 0;
    const s = inner ? (DECOR_SIZE[name]?.[0] ?? 0.8) * rng.range(0.85, 1.2) : rng.range(0.8, 1.3);
    if (!items.has(key)) items.set(key, []);
    items.get(key)!.push({ x, y: Math.max(hy, 0) - 0.05, z, yaw: rng.next() * Math.PI * 2, s });
    if (/chene|sapin|saule|basalte/.test(name)) occupied.push([x, z, 1.1 * s]);
  };
  // obstacles solides (rochers, troncs) : toujours dessinés, à l'endroit exact où la simulation les connaît
  for (const o of map.obstacles) {
    const key = o.name + '|' + rng.int(0, 2);
    const ix = Math.round((o.x + W / 2) / (W / SX)), iz = Math.round((o.z + H / 2) / (H / SZ));
    const hy = heights[Math.max(0, Math.min(heights.length - 1, iz * (SX + 1) + ix))] ?? 0;
    if (!items.has(key)) items.set(key, []);
    items.get(key)!.push({ x: o.x, y: Math.max(hy, 0) - 0.05, z: o.z, yaw: rng.next() * Math.PI * 2, s: o.s });
    occupied.push([o.x, o.z, o.r + 0.4]);
  }
  const innerN = Math.round(def.hw * def.hh * 0.32 * dens);
  for (let i = 0; i < innerN; i++) tryPlace(rng.range(-def.hw, def.hw), rng.range(-def.hh, def.hh), true);
  const outerN = Math.round((opts.surround ? 900 : 650) * dens);
  for (let i = 0; i < outerN; i++) {
    const x = rng.range(-W / 2 + 4, W / 2 - 4), z = rng.range(-H / 2 + 4, H / 2 - (opts.surround ? 4 : 12));
    if (Math.abs(x) < def.hw - 0.5 && Math.abs(z) < def.hh - 0.5) continue;
    if (z > def.hh + 3 && !opts.surround) continue; // dégager le bas de l'écran
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
      items.get(key)!.push({ x, y: 0.02, z, yaw: rng.next() * Math.PI * 2, s: (DECOR_SIZE[name]?.[1] ?? 0.45) * rng.range(0.8, 1.2) });
    }
  }
  for (const [key, list] of items) {
    const [name, v] = key.split('|');
    const big = /chene|sapin|saule|basalte|pic|arbre/.test(name);
    // GLB importé (variante demandée, sinon variante 0), sinon art en code
    const g = model(K.decor(def.biome, name, +v)) ?? model(K.decor(def.biome, name, 0));
    staticInstances(g ? g.geo : decorGeometry(def.biome, name, +v), list, group, big && settings.shadows, g ? g.map : null);
  }

  // ------------------------------------------------ château et entrées
  // sortie vers la caméra (bas de l'écran) : château bas, pour ne pas masquer la carte
  const castle = new Castle(group, def.biome, castleAt.x, castleAt.z, castleAt.dx, castleAt.dz, castleAt.dz > 0.5 && !opts.surround);
  // galerie construite en code (taillée pour la colline du terrain), ouverture tournée vers la carte
  const spawnPool = new InstPool(spawnGeometry(def.biome), entries.length, group, settings.shadows);
  spawnPool.begin();
  for (const e of entries) spawnPool.push(e.x, 0, e.z, Math.atan2(-e.ox, -e.oz), 1);
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
  const half = new Uint16Array(heights.length);
  for (let i = 0; i < heights.length; i++) half[i] = THREE.DataUtils.toHalfFloat(heights[i]);
  const tex = new THREE.DataTexture(half, SX + 1, SZ + 1, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { group, theme, entries, exit, slotPool, lockedPool, heightAt, castle, ground: { tex, w: W, h: H, sx: SX, sz: SZ } };
}
