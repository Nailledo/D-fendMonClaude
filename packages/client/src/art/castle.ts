import type * as THREE from 'three';
import type { Biome } from '@dfend/shared';
import { GB, Part, shade } from './builder';

/**
 * Château au bout du chemin (ce qu'on défend). Repère local : la porte est centrée en x = 0,
 * sa herse dans le plan z ≈ 0 ; la façade regarde vers +z (vers la carte) et le château s'étend vers -z.
 * Trois pièces : le corps (statique), la herse (qui se lève quand les monstres forcent l'entrée) et un drapeau.
 */

/** hauteur de levée de la herse (elle rentre dans le bloc de la porte) */
export const PORTCULLIS_LIFT = 2.5;
/** ouverture de la porte : demi-largeur et hauteur */
const GATE_HW = 1.35, GATE_H = 3.3;

interface Palette { stone: number; stoneD: number; roof: number; wood: number; ground: number }
function palette(biome: Biome): Palette {
  if (biome === 'cendre') return { stone: 0x5a4f4a, stoneD: 0x3f3632, roof: 0x7f1d1d, wood: 0x3e2a22, ground: 0x4a3d36 };
  if (biome === 'marais') return { stone: 0x8a8f82, stoneD: 0x676c60, roof: 0x2f5d3a, wood: 0x5a4632, ground: 0x6b5c43 };
  return { stone: 0xc2b8a6, stoneD: 0x948a7a, roof: 0x2b4fa8, wood: 0x6d4c33, ground: 0xb89a6a };
}

/** créneaux sur une ligne de (x0, z0) à (x1, z1) */
function merlonsLine(g: GB, c: number, x0: number, z0: number, x1: number, z1: number, y: number, n: number, d = 0.5) {
  const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    g.box(0.5, 0.5, d, c, x0 + (x1 - x0) * t, y + 0.25, z0 + (z1 - z0) * t, 0, ry, 0);
  }
}

/** créneaux en couronne */
function merlonsRing(g: GB, c: number, x: number, z: number, r: number, y: number, n: number) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    g.box(0.42, 0.5, 0.36, c, x + Math.cos(a) * r, y + 0.25, z + Math.sin(a) * r, 0, -a, 0);
  }
}

/** pierres en léger relief sur une face (+z) d'un mur : rompt les grands aplats */
function stones(g: GB, c: number, x0: number, x1: number, y0: number, y1: number, z: number, n: number, rnd: () => number) {
  for (let k = 0; k < n; k++) {
    const w = 0.35 + rnd() * 0.45, h = 0.22 + rnd() * 0.18;
    g.box(w, h, 0.08, shade(c, 0.86 + rnd() * 0.2), x0 + w / 2 + rnd() * (x1 - x0 - w), y0 + h / 2 + rnd() * (y1 - y0 - h), z);
  }
}

/** meurtrière (fente sombre surmontée d'une pierre) sur la face d'une tour ronde, à l'angle a */
function slit(g: GB, x: number, z: number, r: number, a: number, y: number) {
  g.box(0.14, 0.55, 0.12, 0x15110e, x + Math.sin(a) * r, y, z + Math.cos(a) * r, 0, a, 0);
}

/** tour ronde : fût, corniche, créneaux, toit conique */
function roundTower(g: GB, p: Palette, x: number, z: number, r: number, h: number, roofH: number, rnd: () => number) {
  g.cyl(r, r * 1.12, h, 10, p.stone, x, h / 2, z);
  g.cyl(r * 1.16, r * 1.22, 0.45, 10, p.stoneD, x, 0.22, z);
  g.cyl(r * 1.15, r, 0.3, 10, p.stoneD, x, h + 0.15, z);
  merlonsRing(g, p.stone, x, z, r * 1.08, h + 0.3, 9);
  g.cone(r * 1.28, roofH, 10, p.roof, x, h + 0.55 + roofH / 2, z);
  g.ball(0.12, 0xd4af37, x, h + 0.6 + roofH, z);
  // anneaux de pierre plus sombres : le fût n'est pas lisse
  for (const fy of [h * 0.35, h * 0.7]) g.cyl(r * 1.03, r * 1.03, 0.12, 10, shade(p.stone, 0.88), x, fy, z);
  void rnd;
}

/** torche murale : support de bois, flamme vive */
function torch(g: GB, x: number, y: number, z: number) {
  g.box(0.08, 0.4, 0.08, 0x3e2723, x, y, z, 0.35);
  g.cone(0.13, 0.24, 6, 0x4e342e, x, y + 0.25, z + 0.08, Math.PI);
  g.ball(0.13, 0xffb300, x, y + 0.38, z + 0.1, 1, 1.4, 1);
  g.ball(0.07, 0xfff3c4, x, y + 0.36, z + 0.13, 1, 1.3, 1);
}

export interface CastleGeometry {
  body: THREE.BufferGeometry;
  portcullis: THREE.BufferGeometry;
  flag: THREE.BufferGeometry;
  /** mâts : position locale (x, y, z) et taille de chaque drapeau */
  flags: [number, number, number, number][];
  /** sommets fumants quand le château est mal en point (local) */
  chimneys: [number, number, number][];
}

/**
 * `low` : version basse (sortie vers la caméra) — pas de donjon ni de tours hautes qui masqueraient la carte.
 */
export function castleGeometry(biome: Biome, low = false): CastleGeometry {
  const p = palette(biome);
  const g = new GB(91);
  g.jitter = 0.03;
  let sd = 11;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const flags: [number, number, number, number][] = [];
  const chimneys: [number, number, number][] = [];
  const k = low ? 0.75 : 1;

  // ---------------- cour : sol de terre battue
  g.box(17, 0.1, 10.5, p.ground, 0, 0.04, -5.6);

  // ---------------- châtelet : deux tours rondes et le bloc de la porte
  const gtH = 5.6 * k, gx = 2.45;
  for (const s of [-1, 1]) {
    roundTower(g, p, s * gx, -0.7, 1.15, gtH, 2.3 * k, rnd);
    slit(g, s * gx, -0.7, 1.16, 0.25 * s, 2.4 * k);
    slit(g, s * gx, -0.7, 1.16, -0.25 * s, 4.1 * k);
    flags.push([s * gx, gtH + 0.55 + 2.3 * k, -0.7, 0.8]);
    // bannière aux couleurs du joueur, sous les créneaux
    g.setPart(Part.Team).box(0.75, 1.5 * k, 0.06, 0xffffff, s * gx, gtH - 1.3 * k, -0.7 + 1.18);
    g.setPart(Part.Body);
    g.box(0.85, 0.08, 0.1, 0x3e2723, s * gx, gtH - 0.5 * k, -0.7 + 1.2);
    g.cone(0.2, 0.3, 3, 0xffffff, s * gx, gtH - 2.15 * k, -0.7 + 1.18, Math.PI, 0, 0);
  }
  // bloc au-dessus de la porte (la herse levée y disparaît)
  const blockTop = GATE_H + PORTCULLIS_LIFT;
  g.box(3.6, blockTop - GATE_H + 0.1, 2.3, p.stone, 0, (GATE_H + blockTop) / 2, -0.6);
  merlonsLine(g, p.stone, -1.6, 0.35, 1.6, 0.35, blockTop, 4, 0.4);
  stones(g, p.stone, -1.7, 1.7, GATE_H + 0.15, blockTop - 0.2, 0.56, 6, rnd);
  // encadrement de la porte : piédroits, linteau en arc (voussoirs), clé de voûte
  for (const s of [-1, 1]) g.box(0.4, GATE_H, 0.35, p.stoneD, s * (GATE_HW + 0.12), GATE_H / 2, 0.42);
  for (let v = 0; v < 7; v++) {
    const a = Math.PI * (v / 6);
    g.box(0.42, 0.5, 0.38, v === 3 ? shade(p.stoneD, 0.85) : p.stoneD, Math.cos(a) * (GATE_HW + 0.05), GATE_H - 0.05 + Math.sin(a) * 0.32, 0.44, 0, 0, a - Math.PI / 2);
  }
  // passage : parois et voûte sombres, fond noir (les monstres y disparaissent)
  for (const s of [-1, 1]) g.box(0.12, GATE_H, 2.2, 0x2a221c, s * GATE_HW, GATE_H / 2, -0.75);
  g.box(GATE_HW * 2, 0.12, 2.2, 0x1f1914, 0, GATE_H, -0.75);
  g.box(GATE_HW * 2, GATE_H, 0.12, 0x0b0907, 0, GATE_H / 2, -1.62);
  // revers de la porte côté cour : mur de pierre (le fond noir n'est visible que depuis l'entrée)
  g.box(GATE_HW * 2 + 0.6, GATE_H + 0.1, 0.24, p.stoneD, 0, (GATE_H + 0.1) / 2, -1.8);
  g.box(GATE_HW * 2, 0.05, 2.6, shade(p.ground, 0.6), 0, 0.03, -0.6);
  // torches de part et d'autre
  for (const s of [-1, 1]) torch(g, s * (GATE_HW + 0.55), 2.1, 0.5);
  // seuil de planches (pont-levis abaissé)
  g.box(GATE_HW * 2 + 0.2, 0.12, 1.6, p.wood, 0, 0.06, 1.15);
  for (let b = 0; b < 6; b++) g.box(0.06, 0.13, 1.6, shade(p.wood, 0.7), -GATE_HW + 0.1 + b * 0.52, 0.065, 1.15);
  // chaînes du pont-levis : du bout du tablier (bas, côté carte) jusqu'au mur au-dessus de la porte (haut)
  {
    const z0 = 1.9, y0 = 0.14, z1 = 0.62, y1 = 3.75;
    const len = Math.hypot(z0 - z1, y1 - y0), a = Math.atan2(y1 - y0, z0 - z1);
    for (const s of [-1, 1]) {
      const cx = s * (GATE_HW - 0.05);
      // boîte orientée selon z, inclinée autour de x : son extrémité +z descend vers le tablier
      g.box(0.06, 0.06, len, 0x37474f, cx, (y0 + y1) / 2, (z0 + z1) / 2, a);
      g.box(0.16, 0.16, 0.08, 0x2b2f33, cx, y1, z1 - 0.02); // ancrage dans le mur
      g.box(0.14, 0.1, 0.14, 0x2b2f33, cx, y0 + 0.02, z0); // anneau sur le tablier
    }
  }

  // ---------------- courtines et tours d'angle
  const wallH = 3.6 * k, cx = 8.6;
  for (const s of [-1, 1]) {
    const x0 = s * (gx + 0.9), x1 = s * (cx - 1.1);
    const mx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    g.box(w, wallH, 1.2, p.stone, mx, wallH / 2, -0.85);
    g.box(w + 0.1, 0.45, 1.45, p.stoneD, mx, 0.22, -0.85);
    g.box(w, 0.18, 1.35, p.stoneD, mx, wallH, -0.85);
    merlonsLine(g, p.stone, x0, -0.3, x1, -0.3, wallH + 0.09, 6, 0.35);
    stones(g, p.stone, Math.min(x0, x1), Math.max(x0, x1), 0.5, wallH - 0.2, -0.22, 14, rnd);
    // tour d'angle avant et tours arrière
    roundTower(g, p, s * cx, -1.0, 1.3, 5.0 * k, 2.4 * k, rnd);
    slit(g, s * cx, -1.0, 1.31, 0, 2.8 * k);
    flags.push([s * cx, 5.0 * k + 0.55 + 2.4 * k, -1.0, 0.7]);
    // courtines latérales vers l'arrière
    g.box(1.2, wallH, 7.6, p.stone, s * cx, wallH / 2, -5.9);
    g.box(1.45, 0.45, 7.7, p.stoneD, s * cx, 0.22, -5.9);
    merlonsLine(g, p.stone, s * (cx + 0.55), -2.3, s * (cx + 0.55), -9.6, wallH, 9, 0.35);
    roundTower(g, p, s * cx, -10.4, 1.15, 4.4 * k, 2.0 * k, rnd);
  }
  // mur du fond
  g.box(cx * 2 - 1.6, wallH, 1.2, p.stone, 0, wallH / 2, -10.4);
  merlonsLine(g, p.stone, -cx + 1, -9.85, cx - 1, -9.85, wallH, 16, 0.35);

  // ---------------- maisons de la cour (toits visibles par-dessus les remparts)
  for (const [hx, hz, ry] of [[-5, -4.2, 0.1], [5.2, -4.0, -0.15], [-5.6, -7.6, 0], [5.4, -7.8, 0.05]] as const) {
    g.box(2.4, 2.6 * k, 2.0, 0xe8dcc0, hx, 1.3 * k, hz, 0, ry, 0);
    g.box(2.45, 0.12, 2.05, p.wood, hx, 2.0 * k, hz, 0, ry, 0);
    g.roof(2.8, 1.3, 2.4, p.roof === 0x2b4fa8 ? 0xb5452e : shade(p.roof, 1.15), hx, 2.6 * k, hz, ry);
    g.box(0.3, 0.8, 0.3, p.stoneD, hx + 0.7, 2.6 * k + 1.0, hz - 0.3);
    chimneys.push([hx + 0.7, 2.6 * k + 1.5, hz - 0.3]);
  }

  // ---------------- donjon
  if (!low) {
    const kx = 0.6, kz = -6.2;
    g.box(5.2, 7.2, 4.6, p.stone, kx, 3.6, kz);
    g.box(5.5, 0.5, 4.9, p.stoneD, kx, 0.25, kz);
    g.box(5.6, 0.3, 5.0, p.stoneD, kx, 7.3, kz);
    merlonsLine(g, p.stone, kx - 2.6, kz + 2.4, kx + 2.6, kz + 2.4, 7.45, 6, 0.4);
    merlonsLine(g, p.stone, kx - 2.6, kz - 2.4, kx + 2.6, kz - 2.4, 7.45, 6, 0.4);
    merlonsLine(g, p.stone, kx - 2.7, kz + 2.2, kx - 2.7, kz - 2.2, 7.45, 5, 0.4);
    merlonsLine(g, p.stone, kx + 2.7, kz + 2.2, kx + 2.7, kz - 2.2, 7.45, 5, 0.4);
    g.roof(4.4, 2.0, 3.8, p.roof, kx, 7.45, kz);
    // contreforts et pierres de la façade
    for (const s of [-1, 1]) g.box(0.5, 6.6, 0.5, p.stoneD, kx + s * 2.55, 3.3, kz + 2.3);
    stones(g, p.stone, kx - 2.4, kx + 2.4, 0.6, 6.8, kz + 2.32, 22, rnd);
    // fenêtres en arc et grande porte
    for (const [wx, wy] of [[-1.3, 5.2], [0, 5.2], [1.3, 5.2], [-1.3, 3.2], [1.3, 3.2]]) {
      g.box(0.45, 0.8, 0.1, 0x1a1410, kx + wx, wy, kz + 2.33);
      g.cyl(0.225, 0.225, 0.1, 8, 0x1a1410, kx + wx, wy + 0.4, kz + 2.33, Math.PI / 2);
      g.box(0.6, 0.08, 0.16, p.stoneD, kx + wx, wy - 0.44, kz + 2.36);
    }
    g.box(1.2, 1.8, 0.12, p.wood, kx, 0.9, kz + 2.34);
    g.cyl(0.6, 0.6, 0.12, 10, p.wood, kx, 1.8, kz + 2.34, Math.PI / 2);
    // grande tour du donjon
    const tx = kx - 2.3, tz = kz - 1.6;
    roundTower(g, p, tx, tz, 1.35, 10.2, 3.2, rnd);
    for (const sy of [4, 6.2, 8.4]) slit(g, tx, tz, 1.36, 0.6, sy);
    flags.push([tx, 10.2 + 0.55 + 3.2, tz, 1.25]);
    chimneys.push([kx + 1.2, 8.6, kz], [tx, 11.5, tz]);
    // bannière du roi sur la façade
    g.setPart(Part.Team).box(1.1, 2.4, 0.06, 0xffffff, kx, 5.9, kz + 2.4);
    g.setPart(Part.Body);
    g.box(1.3, 0.1, 0.12, 0x3e2723, kx, 7.15, kz + 2.42);
    g.box(0.36, 0.36, 0.05, 0xd4af37, kx, 6.1, kz + 2.44, 0, 0, Math.PI / 4);
  }

  // ---------------- herse : barreaux de fer, pointes en bas (repère : bas de la herse à y = 0)
  const h = new GB(92);
  h.ao = false;
  const iron = 0x2b2f33;
  for (let b = 0; b < 7; b++) {
    const x = -GATE_HW + 0.2 + (b * (GATE_HW * 2 - 0.4)) / 6;
    h.box(0.1, GATE_H - 0.1, 0.1, iron, x, GATE_H / 2 + 0.05, 0);
    h.cone(0.07, 0.22, 4, 0x4a5058, x, 0.02, 0, Math.PI);
  }
  for (let r = 0; r < 4; r++) h.box(GATE_HW * 2 - 0.2, 0.09, 0.14, iron, 0, 0.55 + r * 0.8, 0);
  // ---------------- drapeau : mât et étendard (l'étendard ondule, partie Sway)
  const f = new GB(93);
  f.ao = false;
  f.cyl(0.035, 0.035, 1.6, 4, 0x3e2723, 0, 0.8, 0);
  f.setPart(Part.Team).box(0.9, 0.55, 0.04, 0xffffff, 0.47, 1.3, 0);
  f.setPart(Part.Body);
  f.cone(0.12, 0.3, 3, 0xffffff, 0.98, 1.3, 0, 0, 0, -Math.PI / 2);
  return { body: g.build(), portcullis: h.build(), flag: f.build(), flags, chimneys };
}
