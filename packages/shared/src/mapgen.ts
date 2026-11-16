import { PATH_HALF_WIDTH } from './constants';
import { MAPS, type MapDef } from './data/maps';
import { SampledPath } from './path';

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

const cache = new Map<string, { paths: SampledPath[]; slots: { x: number; z: number; score: number }[] }>();

export function buildRuntimeMap(mapId: string, nPlayers: number): RuntimeMap {
  const def = MAPS[mapId];
  if (!def) throw new Error('Carte inconnue : ' + mapId);
  let c = cache.get(mapId);
  if (!c) {
    const paths = def.paths.map((p) => new SampledPath(p));
    c = { paths, slots: generateSlots(def, paths) };
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
  return { def, paths: c.paths, slots, heroSpawn };
}
