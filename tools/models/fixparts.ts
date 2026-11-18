/**
 * Corrige les parties animées des modèles déjà cuits (public/models/*.glb) :
 *   pnpm tsx tools/models/fixparts.ts [id…]   (sans argument : tous les ennemis)
 *
 * La cuisson devinait jambes / bras / ailes d'après la forme : sur les créatures rondes (gobelin, loup)
 * la bouche et la langue suivaient les « jambes », sur les volants les yeux battaient avec les ailes.
 * Ici on travaille par îlots (morceaux de maillage séparés) :
 *  - créatures sans membres : tout le corps d'un bloc ;
 *  - volants : seuls les îlots qui s'étendent loin sur les côtés sont des ailes ;
 *  - autres : un îlot qui traverse le centre (torse, tête) appartient au corps, un « bras » qui touche le sol
 *    est une jambe, et chaque membre bouge d'un bloc autour de son articulation.
 * Les modèles d'un seul tenant (personnages riggés) gardent leurs poids par sommet.
 */
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Mesh, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS = join(ROOT, 'packages/client/public/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const enum P { Body = 0, LegL = 1, LegR = 2, ArmL = 3, ArmR = 4, WingL = 5, WingR = 6 }
/** créatures sans membres (boules, limaces) */
const BLOBS = new Set(['gobelin', 'loup', 'limon', 'petitlimon', 'ver', 'vasiere', 'invocateur']);
const FLYERS = new Set(['corbeau', 'chauvesouris', 'gargouille']);
/**
 * Créatures sans jambes (tête, bras, ailes) : elles ne doivent pas avancer sur leurs mains.
 * Les bras sont relevés vers l'avant (griffes en avant, `raise` radians autour de l'épaule) et ne bougent
 * qu'à `weight` de l'animation des bras ; les ailes battent. Elles restent au sol ou volent selon la simulation.
 */
const HELD_ARMS: Record<string, { raise: number; weight: number }> = {
  diablotin: { raise: 0.9, weight: 0.35 },
  gargouille: { raise: 0.5, weight: 0.35 },
  kessin3: { raise: 0.85, weight: 0.35 },
};
/** créatures à pattes avec des ailes dans le dos, restées accrochées au corps (immobiles) */
const BACK_WINGS = new Set(['cornu', 'kessin1']);
/** membres antérieurs détachés pris pour des jambes : ce sont des bras (le crapaud trotte à quatre pattes) */
const LEGS_ARE_ARMS = new Set(['crapaud']);
const ONLY = new Set(process.argv.slice(2));

function read(p: Primitive, s: string) {
  const a = p.getAttribute(s)!, out: number[] = [], e: number[] = new Array(a.getElementSize()).fill(0);
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); out.push(...e); }
  return out;
}

function islands(pos: number[], idx: ArrayLike<number>) {
  const n = pos.length / 3;
  const par = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const uni = (x: number, y: number) => { const a = find(x), b = find(y); if (a !== b) par[a] = b; };
  const key = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 2000)},${Math.round(pos[i * 3 + 1] * 2000)},${Math.round(pos[i * 3 + 2] * 2000)}`;
    const o = key.get(k);
    if (o !== undefined) uni(i, o); else key.set(k, i);
  }
  for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
  const map = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { const r = find(i); let v = map.get(r); if (!v) map.set(r, (v = [])); v.push(i); }
  return [...map.values()];
}

type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; cx: number; cy: number; cz: number };
function box(pos: number[], v: number[]): Box {
  const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9, cx: 0, cy: 0, cz: 0 };
  for (const i of v) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
    b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); b.cx += x; b.cy += y; b.cz += z;
  }
  b.cx /= v.length; b.cy /= v.length; b.cz /= v.length;
  return b;
}
const setV = (anim: number[], weight: number[], i: number, part: number, w: number, px = 0, py = 0, pz = 0) => {
  anim[i * 4] = part; anim[i * 4 + 1] = px; anim[i * 4 + 2] = py; anim[i * 4 + 3] = pz; weight[i] = w;
};
/** aile : son articulation au bord intérieur, le poids monte doucement depuis l'épaule */
function wing(pos: number[], anim: number[], weight: number[], v: number[], b: Box) {
  const left = b.cx > 0, inner = left ? b.x0 : b.x1, reach = Math.max(Math.abs(b.x0), Math.abs(b.x1));
  for (const i of v) {
    const d = Math.abs(pos[i * 3] - inner) / Math.max(1e-3, reach - Math.abs(inner));
    setV(anim, weight, i, left ? P.WingL : P.WingR, Math.min(1, 0.35 + d * 1.2), inner, b.cy, b.cz);
  }
}
/** le plus gros îlot qui traverse le centre : le corps (tête, torse) */
function bodyOf(isl: number[][], pos: number[], hw: number) {
  let best: Box | null = null, size = 0;
  for (const v of isl) { const b = box(pos, v); if (b.x0 < -hw * 0.1 && b.x1 > hw * 0.1 && v.length > size) { size = v.length; best = b; } }
  return best!;
}

/**
 * Créature sans jambes : îlots latéraux qui descendent sous le corps = bras (relevés une seule fois, signature
 * dans les `extras` du maillage), îlots latéraux qui s'étendent loin = ailes, tout le reste = corps.
 */
function heldArms(mesh: Mesh, prim: Primitive, pos: number[], anim: number[], weight: number[], isl: number[][], hw: number, cfg: { raise: number; weight: number }) {
  const body = bodyOf(isl, pos, hw);
  const sig = JSON.stringify(cfg);
  const extras = (mesh.getExtras() ?? {}) as { heldArms?: string };
  const raise = extras.heldArms !== sig;
  const nor = raise ? read(prim, 'NORMAL') : null;
  for (const v of isl) {
    const b = box(pos, v);
    // d'un seul côté du corps (à un léger débord près)
    const lateral = v.length > 40 && (b.cx > body.cx ? b.x0 > body.cx - hw * 0.05 : b.x1 < body.cx + hw * 0.05);
    // bras : membre latéral qui descend sous le bas du corps (même relevé) ; aile : membre latéral qui s'étend loin
    const arm = lateral && b.y0 < body.y0 + (body.y1 - body.y0) * 0.3;
    if (!arm) {
      if (lateral && Math.max(Math.abs(b.x0), Math.abs(b.x1)) > hw * 0.65) wing(pos, anim, weight, v, b);
      else for (const i of v) setV(anim, weight, i, P.Body, 1);
      continue;
    }
    const left = b.cx > 0;
    // épaule : haut du bras
    let sx = 0, sz = 0, c = 0;
    for (const i of v) if (pos[i * 3 + 1] > b.y1 - (b.y1 - b.y0) * 0.12) { sx += pos[i * 3]; sz += pos[i * 3 + 2]; c++; }
    sx /= c; sz /= c;
    let sy = b.y1;
    // déjà relevé : on garde l'épaule d'origine (le haut du bras a bougé avec la rotation)
    const p0 = v[0] * 4;
    if (!raise && (anim[p0] === P.ArmL || anim[p0] === P.ArmR)) { sx = anim[p0 + 1]; sy = anim[p0 + 2]; sz = anim[p0 + 3]; }
    if (raise) {
      // rotation autour de l'axe x passant par l'épaule : la main part vers l'avant (+z) et se soulève
      const co = Math.cos(cfg.raise), si = Math.sin(cfg.raise);
      for (const i of v) {
        const dy = pos[i * 3 + 1] - sy, dz = pos[i * 3 + 2] - sz;
        pos[i * 3 + 1] = sy + dy * co + dz * si; pos[i * 3 + 2] = sz - dy * si + dz * co;
        const ny = nor![i * 3 + 1], nz = nor![i * 3 + 2];
        nor![i * 3 + 1] = ny * co + nz * si; nor![i * 3 + 2] = -ny * si + nz * co;
      }
    }
    for (const i of v) setV(anim, weight, i, left ? P.ArmL : P.ArmR, cfg.weight, sx, sy, sz);
  }
  if (raise) {
    prim.getAttribute('POSITION')!.setArray(new Float32Array(pos));
    prim.getAttribute('NORMAL')!.setArray(new Float32Array(nor!));
    mesh.setExtras({ ...extras, heldArms: sig });
  }
}

/** ailes accrochées dans le dos, restées « corps » : îlots latéraux hauts, entièrement derrière le corps */
function backWings(pos: number[], anim: number[], weight: number[], isl: number[][], H: number, hw: number) {
  const body = bodyOf(isl, pos, hw);
  for (const v of isl) {
    const b = box(pos, v);
    if (v.length < 40 || Math.sign(b.x0 - body.cx) !== Math.sign(b.x1 - body.cx)) continue;
    if (b.y0 < H * 0.45 || b.z1 > body.cz) continue;
    if (v.some((i) => anim[i * 4] !== P.Body && anim[i * 4] !== P.WingL && anim[i * 4] !== P.WingR)) continue;
    wing(pos, anim, weight, v, { ...b, cx: b.cx - body.cx });
  }
}

for (const file of readdirSync(MODELS).filter((f) => f.startsWith('enemy-') && f.endsWith('.glb'))) {
  const id = file.slice(6, -4);
  if (ONLY.size && !ONLY.has(id)) continue;
  const doc = await io.read(join(MODELS, file));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const pos = read(prim, 'POSITION');
  const anim = read(prim, '_ANIM');
  const weight = read(prim, '_WEIGHT');
  const idx = prim.getIndices()!.getArray()!;
  const n = pos.length / 3;
  let H = 0, hw = 0;
  for (let i = 0; i < n; i++) { H = Math.max(H, pos[i * 3 + 1]); hw = Math.max(hw, Math.abs(pos[i * 3])); }
  const set = (i: number, part: number, w: number, px = 0, py = 0, pz = 0) => {
    anim[i * 4] = part; anim[i * 4 + 1] = px; anim[i * 4 + 2] = py; anim[i * 4 + 3] = pz; weight[i] = w;
  };
  const before = anim.filter((_, k) => k % 4 === 0).filter((p) => p !== 0).length;
  const isl = islands(pos, idx);
  const biggest = Math.max(...isl.map((v) => v.length));

  if (BLOBS.has(id)) {
    for (let i = 0; i < n; i++) set(i, P.Body, 1);
  } else if (HELD_ARMS[id]) {
    heldArms(doc.getRoot().listMeshes()[0], prim, pos, anim, weight, isl, hw, HELD_ARMS[id]);
  } else if (FLYERS.has(id)) {
    for (const v of isl) {
      let x0 = 1e9, x1 = -1e9, cx = 0, y1 = -1e9, cy = 0, cz = 0;
      for (const i of v) { const x = pos[i * 3]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); cx += x; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; y1 = Math.max(y1, pos[i * 3 + 1]); }
      cx /= v.length; cy /= v.length; cz /= v.length;
      const reach = Math.max(Math.abs(x0), Math.abs(x1));
      // aile : îlot qui s'étend loin sur un côté, sans traverser le centre
      const wing = reach > hw * 0.65 && Math.sign(x0) === Math.sign(x1) && Math.abs(cx) > hw * 0.3;
      if (!wing) { for (const i of v) set(i, P.Body, 1); continue; }
      // articulation : bord intérieur de l'aile ; le poids monte doucement depuis l'épaule
      const inner = cx > 0 ? x0 : x1;
      for (const i of v) {
        const d = Math.abs(pos[i * 3] - inner) / Math.max(1e-3, reach - Math.abs(inner));
        set(i, cx > 0 ? P.WingL : P.WingR, Math.min(1, 0.35 + d * 1.2), inner, cy, cz);
      }
    }
  } else if (biggest < n * 0.6) {
    // modèle en plusieurs morceaux : chaque îlot bouge d'un bloc
    for (const v of isl) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, cx = 0, cz = 0;
      const count = new Map<number, number>();
      for (const i of v) {
        const x = pos[i * 3], y = pos[i * 3 + 1];
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        cx += x; cz += pos[i * 3 + 2];
        count.set(anim[i * 4], (count.get(anim[i * 4]) ?? 0) + 1);
      }
      cx /= v.length; cz /= v.length;
      let part = P.Body, best = 0;
      for (const [p, c] of count) if (p !== P.Body && c > best) { best = c; part = p; }
      const central = x0 < -hw * 0.18 && x1 > hw * 0.18;
      if (central || best < v.length * 0.5) {
        // morceau central (torse, tête, corps avec jambes) : on garde le découpage sommet par sommet,
        // sauf les sommets mal placés — « jambe » au-dessus de sa hanche, « bras » au milieu du torse
        for (const i of v) {
          const p = anim[i * 4], x = pos[i * 3], y = pos[i * 3 + 1], px = anim[i * 4 + 1], py = anim[i * 4 + 2];
          if ((p === P.LegL || p === P.LegR) && y > py + H * 0.04) set(i, P.Body, 1);
          else if ((p === P.ArmL || p === P.ArmR) && (Math.abs(x) < Math.abs(px) * 0.7 || y > py + H * 0.06 || (Math.abs(x) < hw * 0.3 && y > py - H * 0.08))) set(i, P.Body, 1);
          else if ((p === P.WingL || p === P.WingR) && Math.abs(x) < Math.abs(px)) set(i, P.Body, 1);
        }
        continue;
      }
      const left = cx >= 0;
      if (LEGS_ARE_ARMS.has(id) && (part === P.LegL || part === P.LegR)) part = P.ArmL;
      if (part === P.ArmL || part === P.ArmR) part = left ? P.ArmL : P.ArmR;
      else if (part === P.LegL || part === P.LegR) part = left ? P.LegL : P.LegR;
      else if (part === P.WingL || part === P.WingR) part = left ? P.WingL : P.WingR;
      // articulation en haut du membre (jambes, bras) ou à sa base intérieure (ailes)
      const isWing = part === P.WingL || part === P.WingR;
      for (const i of v) set(i, part, 1, isWing ? (left ? x0 : x1) : cx, y1, cz);
    }
  }
  if (BACK_WINGS.has(id)) backWings(pos, anim, weight, isl, H, hw);
  const after = anim.filter((_, k) => k % 4 === 0).filter((p) => p !== 0).length;
  const buf = doc.getRoot().listBuffers()[0];
  prim.setAttribute('_ANIM', doc.createAccessor().setType('VEC4').setArray(new Float32Array(anim)).setBuffer(buf));
  prim.setAttribute('_WEIGHT', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(weight)).setBuffer(buf));
  for (const a of doc.getRoot().listAccessors()) if (!a.listParents().some((pp) => pp.propertyType !== 'Root')) a.dispose();
  await io.write(join(MODELS, file), doc);
  console.log(`${id.padEnd(14)} îlots ${String(isl.length).padStart(3)}  sommets animés ${before} → ${after}${BLOBS.has(id) ? ' (sans membres)' : HELD_ARMS[id] ? ' (bras relevés, ailes)' : FLYERS.has(id) ? ' (volant)' : biggest < n * 0.6 ? ' (par îlots)' : ' (inchangé)'}${BACK_WINGS.has(id) ? ' + ailes dans le dos' : ''}`);
}
