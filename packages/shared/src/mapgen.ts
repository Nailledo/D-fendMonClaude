import { PATH_HALF_WIDTH } from './constants';
import { MAPS, type MapDef } from './data/maps';
import { PropKind, SECRETS, type MapProp } from './data/props';
import { SampledPath } from './path';
import { Rng, hashString } from './rng';
import type { Biome } from './types';

export interface Slot {
  x: number;
  z: number;
  locked: boolean;
}

export interface RuntimeMap {
  def: MapDef;
  paths: SampledPath[];
  slots: Slot[];
  heroSpawn: { x: number; z: number };
  /**
   * Obstacles solides (rochers, troncs…) : placés de façon déterministe, identiques sur le serveur et chez
   * chaque joueur, quels que soient ses réglages graphiques. Les unités les contournent ; le client les dessine.
   */
  obstacles: Obstacle[];
  /** torches : la nuit, les archers proches gardent toute leur portée */
  torches: { x: number; z: number }[];
  /** carte interactive : pont, tonneaux, camp de mercenaires, secrets */
  props: MapProp[];
}

export interface Obstacle {
  x: number;
  z: number;
  /** rayon de collision */
  r: number;
  /** élément de décor dessiné et son échelle */
  name: string;
  s: number;
}

/** Décor solide de la zone jouable par biome : nom, poids, échelle, rayon de collision à l'échelle 1. */
const SOLID: Record<Biome, [string, number, number, number][]> = {
  vallee: [['rocher', 1, 0.85, 0.36], ['chene', 0.6, 0.95, 0.42]],
  marais: [['rocher', 1, 0.85, 0.46], ['arbremort', 0.6, 0.85, 0.32]],
  cendre: [['rocher', 3, 0.85, 0.36], ['cristal', 1.4, 0.32, 1.5], ['pic', 1, 0.55, 1.0], ['arbrecalcine', 0.6, 0.85, 0.36]],
};

/** Point où un chemin entre dans la zone jouable (ou en sort, depuis la fin). */
export function boundaryPoint(p: SampledPath, hw: number, hh: number, fromEnd: boolean) {
  const inside = (i: number) => Math.abs(p.xs[i]) < hw - 1.5 && Math.abs(p.zs[i]) < hh - 1.5;
  if (!fromEnd) {
    for (let i = 0; i < p.count; i++) if (inside(i)) return { x: p.xs[i], z: p.zs[i], i };
  } else {
    for (let i = p.count - 1; i >= 0; i--) if (inside(i)) return { x: p.xs[i], z: p.zs[i], i };
  }
  return { x: p.xs[0], z: p.zs[0], i: 0 };
}

function generateObstacles(def: MapDef, paths: SampledPath[], slots: { x: number; z: number }[]): Obstacle[] {
  const rng = new Rng(hashString('obstacles:' + def.id));
  const list = SOLID[def.biome] ?? [];
  if (!list.length) return [];
  const clear: [number, number, number][] = slots.map((s) => [s.x, s.z, 1.9]);
  for (const p of paths) {
    const a = boundaryPoint(p, def.hw, def.hh, false), b = boundaryPoint(p, def.hw, def.hh, true);
    clear.push([a.x, a.z, 3.5], [b.x, b.z, 6]);
  }
  let tot = 0;
  for (const [, w] of list) tot += w;
  const out: Obstacle[] = [];
  const n = Math.round(def.hw * def.hh * 0.05);
  for (let k = 0; k < n; k++) {
    const x = rng.range(-def.hw + 0.8, def.hw - 0.8), z = rng.range(-def.hh + 0.8, def.hh - 0.8);
    let r = rng.next() * tot, pick = list[0];
    for (const it of list) if ((r -= it[1]) <= 0) { pick = it; break; }
    const s = pick[2] * rng.range(0.85, 1.2);
    const rad = Math.round(pick[3] * (s / pick[2]) * 100) / 100;
    const tree = pick[0] !== 'rocher' && pick[0] !== 'cristal';
    // loin du chemin (les arbres encore plus), des mares, des emplacements, des entrées et des autres obstacles
    let ok = true;
    const minPath = PATH_HALF_WIDTH + 0.6 + rad + (tree ? 1.2 : 0);
    for (const p of paths) if (p.minDist2(x, z, 2) < minPath * minPath) { ok = false; break; }
    if (ok && def.pools) for (const [px, pz, pr] of def.pools) if ((x - px) ** 2 + (z - pz) ** 2 < (pr + rad + 0.8) ** 2) { ok = false; break; }
    if (ok) for (const [cx, cz, cr] of clear) if ((x - cx) ** 2 + (z - cz) ** 2 < (cr + rad) ** 2) { ok = false; break; }
    if (ok) for (const o of out) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + rad + 0.9) ** 2) { ok = false; break; }
    if (ok) out.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, r: rad, name: pick[0], s: Math.round(s * 100) / 100 });
  }
  return out;
}

const slotPart = [0.65, 0.8, 0.9, 1];

function inBounds(def: MapDef, x: number, z: number, margin: number) {
  return x > -def.hw + margin && x < def.hw - margin && z > -def.hh + margin && z < def.hh - margin;
}

/** Génère les emplacements de tours de façon déterministe à partir des chemins. */
function generateSlots(def: MapDef, paths: SampledPath[]): { x: number; z: number; score: number }[] {
  const cands: { x: number; z: number; score: number }[] = [];
  const minPath = PATH_HALF_WIDTH + 1.35;
  const minPath2 = minPath * minPath;
  for (const p of paths) {
    for (let d = 2; d < p.length; d += 1.6) {
      const i = Math.min(p.count - 1, Math.floor(d / 0.25));
      for (const side of [-1, 1]) {
        for (const off of [2.9, 4.2]) {
          const x = p.xs[i] + p.nx[i] * side * off;
          const z = p.zs[i] + p.nz[i] * side * off;
          if (!inBounds(def, x, z, 1.6)) continue;
          let ok = true;
          for (const q of paths) if (q.minDist2(x, z, 2) < minPath2) { ok = false; break; }
          if (!ok) continue;
          if (def.pools) for (const [px, pz, r] of def.pools) {
            const dx = px - x, dz = pz - z;
            if (dx * dx + dz * dz < (r + 1.4) * (r + 1.4)) { ok = false; break; }
          }
          if (!ok) continue;
          // couverture : nombre d'échantillons de chemin dans un rayon de 6.5
          let score = 0;
          for (const q of paths) {
            for (let k = 0; k < q.count; k += 4) {
              const dx = q.xs[k] - x, dz = q.zs[k] - z;
              if (dx * dx + dz * dz < 42.25) score++;
            }
          }
          cands.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, score });
        }
      }
    }
  }
  cands.sort((a, b) => b.score - a.score || a.x - b.x || a.z - b.z);
  const chosen: { x: number; z: number; score: number }[] = [];
  const spacing2 = 3.1 * 3.1;
  for (const c of cands) {
    if (chosen.length >= def.slotCount) break;
    let ok = true;
    for (const s of chosen) {
      const dx = s.x - c.x, dz = s.z - c.z;
      if (dx * dx + dz * dz < spacing2) { ok = false; break; }
    }
    if (ok) chosen.push(c);
  }
  return chosen;
}

const cache = new Map<string, { paths: SampledPath[]; slots: { x: number; z: number; score: number }[]; obstacles: Obstacle[]; torches: { x: number; z: number }[]; props: MapProp[] }>();

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Éléments interactifs, placés de façon déterministe : deux tonneaux de poudre au bord du chemin, un camp
 * de mercenaires près du milieu du parcours, deux secrets cachés vers les bords.
 */
function generateProps(def: MapDef, paths: SampledPath[], slots: { x: number; z: number }[], obstacles: Obstacle[], torches: { x: number; z: number }[]): MapProp[] {
  const rng = new Rng(hashString('props:' + def.id));
  const out: MapProp[] = [];
  const pools = def.pools ?? [];
  const distSlot = (x: number, z: number) => Math.min(...slots.map((s) => Math.hypot(s.x - x, s.z - z)));
  const distPool = (x: number, z: number) => Math.min(Infinity, ...pools.map(([px, pz, r]) => Math.hypot(px - x, pz - z) - r));
  const distPath = (x: number, z: number) => Math.sqrt(Math.min(...paths.map((p) => p.minDist2(x, z, 2))));
  const distProp = (x: number, z: number) => Math.min(Infinity, ...out.map((o) => Math.hypot(o.x - x, o.z - z)));
  const distTorch = (x: number, z: number) => Math.min(Infinity, ...torches.map((t) => Math.hypot(t.x - x, t.z - z)));
  const ends: [number, number][] = [];
  for (const p of paths) {
    const a = boundaryPoint(p, def.hw, def.hh, false), b = boundaryPoint(p, def.hw, def.hh, true);
    ends.push([a.x, a.z], [b.x, b.z]);
  }
  const distEnd = (x: number, z: number) => Math.min(...ends.map(([ex, ez]) => Math.hypot(ex - x, ez - z)));
  const p0 = paths[0];

  /** point libre (hors chemin, emplacements, obstacles, mares, autres éléments) */
  const free = (x: number, z: number, pathMin: number, slotMin: number, propMin: number, rad: number) =>
    inBounds(def, x, z, 1.4) && distPath(x, z) >= pathMin && distSlot(x, z) >= slotMin && distProp(x, z) >= propMin &&
    distPool(x, z) >= 0.9 && distEnd(x, z) >= 5 && distTorch(x, z) >= 1.2 && obstacles.every((o) => Math.hypot(o.x - x, o.z - z) >= o.r + rad + 0.3);

  // tonneaux de poudre : au bord d'un chemin, vers 25 % et 70 % du parcours
  const barrelPaths = paths.length > 1 ? [0, 1] : [0, 0];
  [0.25, 0.7].forEach((target, n) => {
    const p = paths[barrelPaths[n]];
    const cands: { x: number; z: number; score: number }[] = [];
    for (let d = 3; d < p.length - 3; d += 0.6) {
      const i = Math.min(p.count - 1, Math.floor(d / 0.25));
      for (const side of [-1, 1]) {
        const x = p.xs[i] + p.nx[i] * side * 2.0, z = p.zs[i] + p.nz[i] * side * 2.0;
        if (!free(x, z, 1.9, 1.7, 7, 0.4)) continue;
        cands.push({ x, z, score: -Math.abs(d / p.length - target) });
      }
    }
    cands.sort((a, b) => b.score - a.score || a.x - b.x);
    const c = cands[0];
    if (c) out.push({ kind: PropKind.Poudre, x: r2(c.x), z: r2(c.z), ang: r2(rng.next() * Math.PI * 2), v: 0, r: 0.9 });
  });

  // camp de mercenaires : à 3,5–6 m d'un chemin, vers le milieu du parcours principal
  {
    let c: { x: number; z: number; score: number } | null = null;
    for (let x = -def.hw + 3; x <= def.hw - 3; x += 0.75) {
      for (let z = -def.hh + 3; z <= def.hh - 3; z += 0.75) {
        const dp = distPath(x, z);
        if (dp < 3.5 || dp > 6) continue;
        if (!free(x, z, 3.5, 2.6, 5, 1.4)) continue;
        const pr = p0.project(x, z);
        const score = -Math.abs(pr.d / p0.length - 0.55) - Math.abs(dp - 4.2) * 0.05;
        if (!c || score > c.score) c = { x, z, score };
      }
    }
    if (c) out.push({ kind: PropKind.Camp, x: r2(c.x), z: r2(c.z), ang: r2(Math.atan2(-c.z, -c.x)), v: 0, r: 1.5 });
  }

  // secrets : deux variantes du biome, cachées près des bords (pas en bas, sous l'interface)
  const list = SECRETS[def.biome] ?? [];
  const picks = [0, 1, 2].slice(0, list.length);
  for (let k = picks.length - 1; k > 0; k--) {
    const j = rng.int(0, k);
    [picks[k], picks[j]] = [picks[j], picks[k]];
  }
  for (const v of picks.slice(0, 2)) {
    const cands: { x: number; z: number; score: number }[] = [];
    for (let x = -def.hw + 2; x <= def.hw - 2; x += 0.7) {
      for (let z = -def.hh + 2; z <= def.hh - 4; z += 0.7) {
        if (!free(x, z, 2.6, 2.2, 7, 0.6)) continue;
        const edge = Math.max(Math.abs(x) / def.hw, Math.abs(z) / def.hh);
        cands.push({ x, z, score: edge + rng.next() * 0.35 });
      }
    }
    cands.sort((a, b) => b.score - a.score || a.x - b.x);
    const c = cands[0];
    if (c) out.push({ kind: PropKind.Secret, x: r2(c.x), z: r2(c.z), ang: r2(rng.next() * Math.PI * 2), v, r: 0.9 });
  }
  return out;
}

/** Une torche pour un emplacement sur trois, posée juste derrière lui (à l'opposé du chemin le plus proche). */
function generateTorches(paths: SampledPath[], slots: { x: number; z: number }[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const o = { x: 0, z: 0 };
  slots.forEach((s, i) => {
    if (i % 3 !== 1) return;
    let best = Infinity, bx = s.x, bz = s.z;
    for (const p of paths) {
      const pr = p.project(s.x, s.z);
      if (pr.dist2 < best) { best = pr.dist2; p.at(pr.d, 0, o); bx = o.x; bz = o.z; }
    }
    const dx = s.x - bx, dz = s.z - bz, l = Math.hypot(dx, dz) || 1;
    out.push({ x: s.x + (dx / l) * 1.25, z: s.z + (dz / l) * 1.25 });
  });
  return out;
}

export function buildRuntimeMap(mapId: string, nPlayers: number): RuntimeMap {
  const def = MAPS[mapId];
  if (!def) throw new Error('Carte inconnue : ' + mapId);
  let c = cache.get(mapId);
  if (!c) {
    const paths = def.paths.map((p) => new SampledPath(p));
    const slots = generateSlots(def, paths);
    const torches = generateTorches(paths, slots);
    const obstacles = generateObstacles(def, paths, slots);
    c = { paths, slots, obstacles, torches, props: generateProps(def, paths, slots, obstacles, torches) };
    cache.set(mapId, c);
  }
  const unlocked = Math.round(c.slots.length * slotPart[Math.max(0, Math.min(3, nPlayers - 1))]);
  const slots = c.slots.map((s, i) => ({ x: s.x, z: s.z, locked: i >= unlocked }));
  let heroSpawn: { x: number; z: number };
  if (def.heroSpawn) heroSpawn = { x: def.heroSpawn[0], z: def.heroSpawn[1] };
  else {
    const p = c.paths[0];
    const o = { x: 0, z: 0 };
    p.at(p.length * 0.72, 0, o);
    heroSpawn = o;
  }
  return { def, paths: c.paths, slots, heroSpawn, obstacles: c.obstacles, torches: c.torches, props: c.props };
}
