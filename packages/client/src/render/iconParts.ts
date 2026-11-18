import type { GB } from '../art/builder';

/** Pièces communes des icônes 3D (épées, flèches, flammes...). */
export const GOLD = 0xf2b33d, GOLD_D = 0xb8781a, STEEL = 0xd5dde2, STEEL_D = 0x8b9aa3, WOOD = 0x8a5a33, RED = 0xd63a32;

/** lame d'épée le long de +y (pointe en haut), garde dorée, poignée, pommeau */
export function sword(g: GB, x: number, y: number, rz: number, len = 1.5, blade = STEEL) {
  const c = Math.cos(rz), s = Math.sin(rz);
  const at = (d: number): [number, number] => [x - s * d, y + c * d];
  const [bx, by] = at(len * 0.38);
  g.box(0.17, len * 0.75, 0.07, blade, bx, by, 0, 0, 0, rz);
  const [tx, ty] = at(len * 0.78);
  g.shape([[-0.085, 0], [0.085, 0], [0, 0.2]], 0.07, blade, tx, ty, 0, 0, 0, rz);
  // arête centrale plus sombre
  g.box(0.035, len * 0.72, 0.09, STEEL_D, bx, by, 0, 0, 0, rz);
  const [gx, gy] = at(0);
  g.box(0.52, 0.11, 0.13, GOLD, gx, gy, 0, 0, 0, rz);
  const [hx, hy] = at(-0.2);
  g.box(0.1, 0.32, 0.1, WOOD, hx, hy, 0, 0, 0, rz);
  const [px, py] = at(-0.4);
  g.ball(0.09, GOLD, px, py, 0);
}


export const IVORY = 0xefe6d4, IRON = 0x5b6670, PURPLE = 0x9b5cf6, GREEN = 0x7bd36b, ORANGE = 0xff8f00, YEL = 0xffd54f;
/** couleurs des médaillons */
export const M = {
  arch: 0x4f9a32, bar: 0x2f6fa8, mag: 0x7c4fc4, art: 0xc4621f, gold: 0xc8901c, neutral: 0x3a444b,
  mine: 0xb8860b, camp: 0xa8432f,
  red: 0xb8322c, samuel: 0x2f5fa8, lyra: 0x2f7d32, brom: 0xa0521e, nox: 0x5b2a9a, steel: 0x334155,
};

/** flèche le long de +y (pointe en haut), rotation rz */
export function arrow(g: GB, x: number, y: number, rz: number, len = 1.6, fletch = GREEN, tip = STEEL) {
  const c = Math.cos(rz), s = Math.sin(rz);
  const at = (d: number): [number, number] => [x - s * d, y + c * d];
  const [mx, my] = at(0);
  g.box(0.09, len, 0.09, WOOD, mx, my, 0, 0, 0, rz);
  const [tx, ty] = at(len / 2 + 0.12);
  g.cone(0.14, 0.3, 4, tip, tx, ty, 0, 0, 0, rz);
  const [fx, fy] = at(-len / 2 + 0.15);
  g.shape([[0, 0.25], [0.2, -0.05], [0.2, -0.22], [0, 0.05]], 0.03, fletch, fx, fy, 0, 0, 0, rz);
  g.shape([[0, 0.25], [-0.2, -0.05], [-0.2, -0.22], [0, 0.05]], 0.03, fletch, fx, fy, 0, 0, 0, rz);
}
/** flamme : cônes emboîtés */
export function flame(g: GB, x: number, y: number, k = 1) {
  g.cone(0.5 * k, 1.3 * k, 7, 0xe53935, x, y + 0.6 * k, -0.1);
  g.cone(0.36 * k, 1.0 * k, 7, ORANGE, x + 0.05 * k, y + 0.45 * k, 0.05);
  g.cone(0.2 * k, 0.6 * k, 7, YEL, x + 0.05 * k, y + 0.28 * k, 0.2);
  g.cone(0.18 * k, 0.6 * k, 6, 0xe53935, x - 0.38 * k, y + 0.25 * k, 0, 0, 0, 0.5);
  g.cone(0.16 * k, 0.5 * k, 6, ORANGE, x + 0.4 * k, y + 0.2 * k, 0, 0, 0, -0.5);
}
/** crâne */
export function skull(g: GB, x: number, y: number, k = 1, eye = 0x1b1b1b) {
  g.ball(0.55 * k, IVORY, x, y + 0.1 * k, 0, 1, 0.92, 0.9, 1);
  g.box(0.62 * k, 0.32 * k, 0.5 * k, IVORY, x, y - 0.38 * k, 0.05 * k);
  g.ball(0.15 * k, eye, x - 0.21 * k, y + 0.05 * k, 0.42 * k, 1, 1.1, 0.6);
  g.ball(0.15 * k, eye, x + 0.21 * k, y + 0.05 * k, 0.42 * k, 1, 1.1, 0.6);
  g.cone(0.07 * k, 0.14 * k, 3, 0x2a2a2a, x, y - 0.17 * k, 0.48 * k, 0, 0, Math.PI);
  for (const xx of [-0.16, 0, 0.16]) g.box(0.04 * k, 0.2 * k, 0.05 * k, 0x6b6257, x + xx * k, y - 0.42 * k, 0.31 * k);
}
/** éclair */
export function bolt(g: GB, x: number, y: number, k = 1, col = YEL) {
  g.shape([[0.15, 1], [-0.45, -0.05], [-0.02, -0.05], [-0.22, -1], [0.45, 0.15], [0.02, 0.15], [0.3, 1]], 0.25, col, x, y, 0, 0, 0, 0, k);
}
/** rayons qui partent d'un point */
export function rays(g: GB, x: number, y: number, n: number, r0: number, r1: number, col: number, a0 = 0, a1 = Math.PI * 2, w = 0.09) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n, r = (r0 + r1) / 2;
    g.box(w, r1 - r0, 0.05, col, x + Math.cos(a) * r, y + Math.sin(a) * r, -0.2, 0, 0, a - Math.PI / 2);
  }
}
/** bouclier en écu, pointe en bas */
export const HEATER: [number, number][] = [[-0.75, 0.8], [0.75, 0.8], [0.75, 0.05], [0.45, -0.5], [0, -0.9], [-0.45, -0.5], [-0.75, 0.05]];
/** goutte (pointe en haut) */
export function drop(g: GB, x: number, y: number, k: number, col: number) {
  g.ball(0.5 * k, col, x, y, 0, 1, 1, 0.8, 1);
  g.cone(0.42 * k, 0.75 * k, 8, col, x, y + 0.52 * k, 0);
  g.ball(0.11 * k, 0xffffff, x - 0.2 * k, y + 0.12 * k, 0.32 * k, 1, 1.4, 0.5);
}
