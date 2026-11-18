import type { GB } from '../art/builder';
import type { Icon3D } from './icons3d';
import { GOLD, GOLD_D, GREEN, HEATER, IRON, ORANGE, PURPLE, RED, STEEL, WOOD, YEL, arrow, bolt, drop, flame, rays, skull, sword } from './iconParts';

/**
 * Icônes 3D des compétences (cs_<id>) et des passifs (cp_<id>) des classes du héros :
 * une image par compétence, qui montre ce qu'elle fait. Médaillon à la couleur de la classe
 * (ou de l'élément pour le mage).
 */

/** médaillons par classe */
const C = {
  aventurier: 0x8a5a33, epeiste: 0x2f5fa8, gardien: 0x4b5a6b, archer: 0x2f7d32,
  feu: 0xc2410c, givre: 0x2a6fb0, arcane: 0x6d3fc0, necro: 0x4c1d95, peste: 0x3f6b1f, artificier: 0x0f766e, poudre: 0x9a3412,
};
const BONE = 0xe8dfc8, ICE = 0xb3e5fc, ICE_L = 0xe1f5fe, TOXIC = 0x8bd64a, TOXIC_D = 0x4f8f2a, VIOLET = 0xc084fc, BLOOD = 0xc62828;

// ------------------------------------------------------------ pièces
function heartPts(k: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    pts.push([Math.pow(Math.sin(t), 3) * k, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17) * k]);
  }
  return pts;
}
function heart(g: GB, x: number, y: number, k: number, col = RED, z = 0) {
  g.shape(heartPts(k), 0.4 * k, col, x, y, z);
  g.ball(0.13 * k, 0xff9a8f, x - 0.4 * k, y + 0.38 * k, z + 0.2 * k, 1, 0.7, 0.5);
}
/** écu (bouclier), pointe en bas */
function shield(g: GB, x: number, y: number, k: number, face: number, rim = GOLD, z = 0) {
  g.shape(HEATER.map(([a, b]) => [a * k, b * k] as [number, number]), 0.2 * k, face, x, y, z);
  g.shape(HEATER.map(([a, b]) => [a * k * 1.1, b * k * 1.08] as [number, number]), 0.14 * k, rim, x, y, z - 0.06 * k);
}
/** petite étoile plate (étourdissement, éclat) */
function star(g: GB, x: number, y: number, k: number, col = YEL, z = 0.2, n = 5) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? 0.42 : 1; pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]); }
  g.shape(pts, 0.12 * k + 0.04, col, x, y, z);
}
/** marteau de guerre : manche le long de +y, tête en haut */
function hammer(g: GB, x: number, y: number, rz: number, k = 1, head = 0x8b98a0) {
  const c = Math.cos(rz), s = Math.sin(rz);
  const at = (d: number): [number, number] => [x - s * d * k, y + c * d * k];
  const [mx, my] = at(0);
  g.box(0.13 * k, 1.5 * k, 0.13 * k, WOOD, mx, my, 0, 0, 0, rz);
  const [hx, hy] = at(0.75);
  g.box(1.05 * k, 0.52 * k, 0.52 * k, head, hx, hy, 0, 0, 0, rz);
  for (const d of [-0.42, 0.42]) {
    const ex = hx + c * d * k, ey = hy + s * d * k;
    g.box(0.12 * k, 0.6 * k, 0.6 * k, 0x5b6670, ex, ey, 0, 0, 0, rz);
  }
  const [px, py] = at(-0.78);
  g.ball(0.1 * k, GOLD, px, py, 0);
}
/** nuage en boules */
function cloud(g: GB, x: number, y: number, k: number, col: number, dark: number) {
  for (const [dx, dy, r, c] of [[-0.55, -0.1, 0.42, dark], [0.55, -0.1, 0.42, dark], [0, -0.15, 0.5, dark], [-0.25, 0.2, 0.48, col], [0.3, 0.18, 0.44, col], [0, 0.42, 0.4, col]] as const) {
    g.ball(r * k, c, x + dx * k, y + dy * k, 0, 1, 0.85, 0.8, 1);
  }
}
/** os : tige et deux paires de nœuds */
function bone(g: GB, x1: number, y1: number, x2: number, y2: number, k = 1, z = 0) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  g.box(len, 0.16 * k, 0.16 * k, BONE, (x1 + x2) / 2, (y1 + y2) / 2, z, 0, 0, a);
  const px = -Math.sin(a) * 0.09 * k, py = Math.cos(a) * 0.09 * k;
  for (const [ex, ey] of [[x1, y1], [x2, y2]]) for (const sg of [-1, 1]) g.ball(0.12 * k, BONE, ex + px * sg, ey + py * sg, z);
}
/** flocon à six branches dans le plan de l'image */
function flake(g: GB, x: number, y: number, k: number, col = ICE_L, z = 0) {
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.box(0.12 * k, 1.8 * k, 0.1 * k, col, x, y, z, 0, 0, a);
    for (const d of [0.55, -0.55]) for (const sg of [-1, 1]) {
      const cx = x - Math.sin(a) * d * k, cy = y + Math.cos(a) * d * k;
      g.box(0.08 * k, 0.34 * k, 0.08 * k, ICE, cx + Math.cos(a) * 0.1 * k * sg, cy + Math.sin(a) * 0.1 * k * sg, z, 0, 0, a + sg * 0.8 + (d < 0 ? Math.PI : 0));
    }
  }
}
/** tourelle de forge (petit canon sur socle) */
function turret(g: GB, x: number, y: number, k = 1, z = 0) {
  g.box(1.0 * k, 0.25 * k, 0.8 * k, 0x6b5a48, x, y - 0.45 * k, z);
  g.cyl(0.38 * k, 0.45 * k, 0.5 * k, 8, 0x9aa7af, x, y - 0.08 * k, z);
  g.cyl(0.36 * k, 0.36 * k, 0.12 * k, 8, 0x5b6670, x, y + 0.2 * k, z);
  g.cyl(0.11 * k, 0.14 * k, 0.8 * k, 8, IRON, x + 0.42 * k, y + 0.25 * k, z, 0, 0, -1.3);
  g.ball(0.1 * k, ORANGE, x - 0.15 * k, y - 0.05 * k, z + 0.4 * k);
}
/** pièce d'or vue de face */
function coin(g: GB, x: number, y: number, z: number, k = 1, tilt = 0) {
  g.cyl(0.3 * k, 0.3 * k, 0.1 * k, 12, GOLD, x, y, z, Math.PI / 2 + tilt, 0, tilt);
  g.cyl(0.22 * k, 0.22 * k, 0.12 * k, 12, GOLD_D, x, y, z, Math.PI / 2 + tilt, 0, tilt);
}
/** bombe ronde à mèche */
function bomb(g: GB, x: number, y: number, k = 1, body = 0x37414a) {
  g.ball(0.62 * k, body, x, y, 0, 1, 1, 1, 1);
  g.cyl(0.18 * k, 0.18 * k, 0.22 * k, 8, 0x5b6670, x + 0.32 * k, y + 0.5 * k, 0, 0, 0, -0.6);
  g.cyl(0.04 * k, 0.04 * k, 0.35 * k, 4, 0x8a5a33, x + 0.48 * k, y + 0.75 * k, 0, 0, 0, -0.9);
  g.ball(0.18 * k, 0x9aa7af, x - 0.28 * k, y + 0.22 * k, 0.45 * k, 1, 1, 0.5);
}
/** étincelle de mèche */
function spark(g: GB, x: number, y: number, k = 1) {
  star(g, x, y, 0.28 * k, YEL, 0.1, 4);
  g.ball(0.1 * k, 0xffffff, x, y, 0.2);
}
/** fiole ronde à long col */
function flask(g: GB, x: number, y: number, k: number, liquid: number, rz = 0, z = 0) {
  const c = Math.cos(rz), s = Math.sin(rz);
  const at = (d: number): [number, number] => [x - s * d * k, y + c * d * k];
  // fiole conique : verre, liquide au fond, col et bouchon
  let [px, py] = at(0.05);
  g.cone(0.62 * k, 1.0 * k, 8, 0xd8f0f0, px, py, z - 0.08 * k, 0, 0, rz);
  [px, py] = at(-0.18);
  g.cyl(0.42 * k, 0.6 * k, 0.5 * k, 8, liquid, px, py, z + 0.02 * k, 0, 0, rz);
  [px, py] = at(0.62);
  g.cyl(0.15 * k, 0.17 * k, 0.45 * k, 8, 0xd8f0f0, px, py, z, 0, 0, rz);
  [px, py] = at(0.9);
  g.cyl(0.19 * k, 0.17 * k, 0.18 * k, 8, WOOD, px, py, z, 0, 0, rz);
  [px, py] = at(0.0);
  g.ball(0.08 * k, 0xffffff, px - c * 0.22 * k, py - s * 0.22 * k, z + 0.35 * k, 1, 2, 0.5);
}
/** petit soldat (casque et écu) pour les compétences qui touchent les alliés */
function soldier(g: GB, x: number, y: number, k = 1, z = 0) {
  g.cyl(0.24 * k, 0.28 * k, 0.5 * k, 8, 0x3b6fb5, x, y - 0.25 * k, z);
  g.ball(0.22 * k, 0xf0c8a0, x, y + 0.12 * k, z);
  g.ball(0.25 * k, STEEL, x, y + 0.2 * k, z, 1, 0.75, 1, 1);
  g.shape(HEATER.map(([a, b]) => [a * 0.28 * k, b * 0.28 * k] as [number, number]), 0.06 * k, RED, x + 0.18 * k, y - 0.25 * k, z + 0.28 * k);
}
/** squelette miniature */
function skeleton(g: GB, x: number, y: number, k = 1) {
  skull(g, x, y + 0.45 * k, 0.45 * k, 0xa855f7);
  for (const yy of [0.02, -0.14, -0.3]) g.box(0.5 * k, 0.07 * k, 0.12 * k, BONE, x, y + yy * k, 0);
  g.box(0.08 * k, 0.55 * k, 0.1 * k, BONE, x, y - 0.12 * k, 0.02);
}
/** volute de vent (arc de cercle en segments) */
function swirl(g: GB, x: number, y: number, r: number, a0: number, a1: number, col: number, w = 0.12, z = 0, n = 7) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const seg = (Math.abs(a1 - a0) * r) / n + 0.03;
    g.box(seg, w * (0.5 + (0.5 * (i + 1)) / n), 0.06, col, x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0, 0, a + Math.PI / 2);
  }
}

export const CLASS_ICONS3D: Record<string, Icon3D> = {
  // ============================================================ Aventurier
  cs_coup: {
    medal: C.aventurier, rot: [0.1, -0.3, 0],
    build(g) {
      // épée plantée d'un coup dans le sol, éclats tout autour
      g.rock(0.7, 0x7d746b, 0, -0.95, 0, 1.6, 0.4, 0.9);
      rays(g, 0, -0.62, 7, 0.45, 0.95, 0xfff3c0, 0.15, Math.PI - 0.15, 0.12);
      sword(g, 0, 0.45, Math.PI, 2.0);
      star(g, -0.85, 0.35, 0.2);
      star(g, 0.8, 0.5, 0.17);
    },
  },
  cs_souffle: {
    medal: 0x2f7d4f, rot: [0.15, -0.35, 0],
    build(g) {
      // cœur qui se remplit, volutes vertes qui montent
      heart(g, 0, -0.1, 0.72, RED);
      swirl(g, 0, -0.1, 0.95, -0.6, 1.6, 0xa7f3a0, 0.16, 0.1);
      g.box(0.16, 0.5, 0.1, 0xffffff, 0, -0.05, 0.35);
      g.box(0.5, 0.16, 0.1, 0xffffff, 0, -0.05, 0.35);
      for (const [x, y] of [[-0.8, 0.6], [0.75, 0.75], [-0.55, -0.8]] as const) g.ball(0.09, 0xa7f3a0, x, y, 0.2);
    },
  },
  cs_elan: {
    medal: 0xb7791f, rot: [0.15, -0.35, 0],
    build(g) {
      rays(g, 0, 0.1, 10, 0.95, 1.3, 0xfff3c0);
      shield(g, 0, 0, 0.85, 0x2f6fd0, GOLD, -0.3);
      sword(g, 0, -0.75, 0, 1.8);
    },
  },

  // ============================================================ Épéiste
  cs_tourbillon: {
    medal: C.epeiste, rot: [0.35, -0.3, 0],
    build(g) {
      // lame en pleine rotation : deux arcs de vent fléchés autour
      sword(g, 0.45, -0.45, 0.8, 1.9);
      for (const a0 of [0.35, Math.PI + 0.35]) {
        swirl(g, 0, 0, 1.0, a0, a0 + 2.2, 0xbfe3ff, 0.24, 0.1, 9);
        const a = a0 + 2.2;
        g.cone(0.2, 0.38, 3, 0xbfe3ff, Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.1, 0, 0, a);
      }
    },
  },
  cs_lames: {
    medal: 0x1e3a8a, rot: [0.1, -0.3, 0],
    build(g) {
      // éventail de six lames qui convergent vers un point
      for (let i = 0; i < 6; i++) {
        const a = -1.05 + (i * 2.1) / 5;
        sword(g, Math.sin(a) * 0.15, -0.95, -a, 1.55, i % 2 ? STEEL : 0xbfe3ff);
      }
      star(g, 0, 0.95, 0.25, 0xffffff, 0.15);
    },
  },
  cs_onde: {
    medal: 0x2563a8, rot: [0.1, -0.25, 0],
    build(g) {
      // croissant d'air tranchant qui file, traînée derrière
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) { const a = -1.2 + (i * 2.4) / 10; pts.push([Math.cos(a) * 0.8, Math.sin(a) * 0.95]); }
      for (let i = 10; i >= 0; i--) { const a = -1.2 + (i * 2.4) / 10; pts.push([Math.cos(a) * 0.45 + 0.05, Math.sin(a) * 0.62]); }
      g.shape(pts, 0.14, 0xe0f2fe, 0.25, 0, 0.1);
      g.shape(pts.map(([x, y]) => [x * 0.9 - 0.05, y * 0.85] as [number, number]), 0.1, 0x7dd3fc, 0.25, 0, 0.12);
      for (const [y, l] of [[0.45, 0.8], [0, 1.1], [-0.45, 0.8]] as const) g.box(l, 0.08, 0.05, 0xe2e8f0, -0.15 - l / 2, y, 0);
    },
  },
  cs_cyclone: {
    medal: 0x1e4f8a, rot: [0.2, -0.3, 0],
    build(g) {
      // tornade d'anneaux, lames prises dans le vent
      for (let i = 0; i < 6; i++) {
        const t = i / 5, r = 0.2 + t * 0.75;
        g.torus(r, i % 2 ? 0xe2e8f0 : 0xbfdbfe, Math.sin(t * 5) * 0.1, -1.0 + t * 1.85, 0, Math.PI / 2 - 0.15, 0, 0);
      }
      sword(g, -0.75, 0.3, 1.2, 0.9);
      sword(g, 0.7, -0.15, -1.9, 0.8);
      sword(g, 0.45, 0.85, -1.1, 0.7);
    },
  },

  // ============================================================ Gardien
  cs_defi: {
    medal: C.gardien, rot: [0.15, -0.35, 0],
    build(g) {
      // écu dressé et cri de défi : arcs rouges et étoiles d'étourdissement
      shield(g, -0.15, -0.05, 0.85, 0x8b98a0, GOLD);
      g.box(0.2, 0.55, 0.08, 0xd32f2f, -0.15, 0.12, 0.16);
      g.ball(0.12, 0xd32f2f, -0.15, -0.35, 0.16);
      for (const r of [0.85, 1.15]) for (let k = -1; k <= 1; k++) {
        const a = k * 0.38;
        g.box(0.11, 0.3, 0.06, 0xff6b5a, -0.15 + Math.cos(a) * r, Math.sin(a) * r, 0.05, 0, 0, a);
      }
      star(g, -0.95, 0.85, 0.2);
      star(g, 0.65, 0.95, 0.16);
    },
  },
  cs_rempart: {
    medal: 0x334155, rot: [0.15, -0.4, 0],
    build(g) {
      // grand pavois de tour, rivets d'or, sol qui tremble
      g.box(1.25, 1.75, 0.22, 0x8b98a0, 0, 0.05, 0);
      g.box(1.4, 1.9, 0.14, GOLD, 0, 0.05, -0.08);
      g.box(0.2, 1.6, 0.08, GOLD, 0, 0.05, 0.14);
      g.box(1.1, 0.2, 0.08, GOLD, 0, 0.35, 0.14);
      for (const [x, y] of [[-0.45, 0.75], [0.45, 0.75], [-0.45, -0.65], [0.45, -0.65]] as const) g.ball(0.07, GOLD_D, x, y, 0.14);
      star(g, -1.0, 0.75, 0.18);
      star(g, 1.0, 0.55, 0.15);
      g.box(2.3, 0.14, 0.5, 0x6b5a48, 0, -0.95, 0);
    },
  },
  cs_egide: {
    medal: 0x2f5fa8, rot: [0.15, -0.35, 0],
    build(g) {
      // dôme de lumière sur trois écus
      swirl(g, 0, -0.55, 1.1, 0.05, Math.PI - 0.05, 0x9fd3ff, 0.2, -0.3, 11);
      swirl(g, 0, -0.55, 1.3, 0.25, Math.PI - 0.25, 0xe0f2fe, 0.12, -0.3, 9);
      g.box(2.3, 0.12, 0.5, 0x6b5a48, 0, -0.6, -0.3);
      shield(g, -0.62, -0.1, 0.5, 0x3b6fb5);
      shield(g, 0.62, -0.1, 0.5, 0x3b6fb5);
      shield(g, 0, 0.05, 0.7, 0xe0e6ea, GOLD, 0.25);
      g.box(0.12, 0.8, 0.06, GOLD, 0, 0.1, 0.42);
      g.box(0.6, 0.12, 0.06, GOLD, 0, 0.25, 0.42);
    },
  },
  cs_sanctuaire: {
    medal: 0x2f7d4f, rot: [0.2, -0.35, 0],
    build(g) {
      // petit temple rayonnant, croix de soin entre les colonnes
      rays(g, 0, 0.1, 10, 1.0, 1.35, 0xfff3c0);
      g.box(1.7, 0.2, 0.7, 0xe8dfc8, 0, -0.85, 0);
      for (const x of [-0.6, 0.6]) g.cyl(0.13, 0.15, 1.1, 8, 0xf5efe0, x, -0.2, 0);
      g.box(1.6, 0.16, 0.7, 0xe8dfc8, 0, 0.42, 0);
      g.roof(1.75, 0.5, 0.75, GOLD, 0, 0.5, 0);
      g.box(0.22, 0.7, 0.2, 0x4caf50, 0, -0.25, 0.2);
      g.box(0.7, 0.22, 0.2, 0x4caf50, 0, -0.2, 0.2);
    },
  },
  cs_seisme: {
    medal: 0x7c4a1e, rot: [0.3, -0.4, 0], zoom: 1.1,
    build(g) {
      // sol fendu, blocs soulevés et poussière
      g.box(1.0, 0.35, 1.4, 0x7d6a55, -0.58, -0.55, 0, 0, 0, 0.18);
      g.box(1.0, 0.35, 1.4, 0x8a7560, 0.58, -0.62, 0, 0, 0, -0.14);
      g.box(0.1, 0.4, 1.45, 0xff8f00, 0.0, -0.62, 0);
      g.shape([[-0.05, 0.2], [0.12, 0.05], [-0.06, -0.12], [0.1, -0.3], [-0.02, -0.3], [-0.2, -0.12], [-0.03, 0.03], [-0.18, 0.2]], 0.1, 0xffb74d, 0, -0.55, 0.72, -0.3, 0, 0, 1.6);
      for (const [x, y, r] of [[-0.35, 0.15, 0.3], [0.4, 0.35, 0.26], [0.05, 0.8, 0.2], [-0.8, 0.55, 0.17]] as const) g.rock(r, 0x9a8670, x, y, 0.2);
      for (const [x, y] of [[-1.05, -0.1], [1.05, -0.2]] as const) g.box(0.08, 0.35, 0.06, 0xfff3c0, x, y, 0.2, 0, 0, x < 0 ? 0.5 : -0.5);
    },
  },
  cs_colere: {
    medal: 0x8a2a1e, rot: [0.15, -0.35, 0],
    build(g) {
      // marteau titanesque doré, ondes de choc au sol, éclairs
      // marteau titanesque levé, chargé d'éclairs ; trois coups au sol
      g.rock(0.7, 0x6b5a48, 0, -1.05, 0, 1.6, 0.3, 0.9);
      for (const x of [-0.75, 0, 0.75]) star(g, x, -0.8, 0.2, 0xffb74d, 0.3);
      hammer(g, -0.15, -0.45, -0.55, 1.1, GOLD);
      bolt(g, -0.85, 0.55, 0.32, YEL);
      bolt(g, 1.0, -0.1, 0.26, YEL);
    },
  },

  // ============================================================ Archer
  cs_visee: {
    medal: C.archer, rot: [0.1, -0.3, 0],
    build(g) {
      // réticule de visée, flèche qui file au centre
      g.torus(0.85, 0xfff7e6, 0, 0, 0);
      g.torus(0.4, 0xd32f2f, 0, 0, 0.02);
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; g.box(0.1, 0.42, 0.08, 0xfff7e6, Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.02, 0, 0, a + Math.PI / 2); }
      g.ball(0.12, 0xd32f2f, 0, 0, 0.1);
      arrow(g, 0.55, 0.55, 2.36, 1.3, GREEN);
    },
  },
  cs_jugement: {
    medal: 0xb7791f, rot: [0.1, -0.3, 0],
    build(g) {
      // flèche dorée qui tombe du ciel dans un rai de lumière
      g.torus(0.55, RED, 0, -0.95, 0, Math.PI / 2 - 0.3, 0, 0);
      g.torus(0.28, 0xfff7e6, 0, -0.95, 0.02, Math.PI / 2 - 0.3, 0, 0);
      arrow(g, 0, 0.1, Math.PI, 2.1, 0xfff0b0, GOLD);
      for (const [x, y, k] of [[-0.6, 0.75, 0.22], [0.6, 0.45, 0.2], [-0.55, -0.05, 0.15], [0.5, 1.0, 0.14]] as const) star(g, x, y, k, 0xfff3c0, 0.1, 4);
    },
  },
  cs_piege: {
    medal: 0x5a4a1e, rot: [0.3, -0.25, 0],
    build(g) {
      // piège à mâchoires vu d'en haut : anneau d'acier, dents tournées vers la plaque
      g.torus(0.8, 0x8b98a0, 0, 0.1, 0);
      for (let i = 0; i < 14; i++) {
        const a = (i * Math.PI * 2) / 14;
        g.cone(0.1, 0.32, 4, STEEL, Math.cos(a) * 0.62, 0.1 + Math.sin(a) * 0.62, 0.02, 0, 0, a + Math.PI / 2);
      }
      g.cyl(0.26, 0.26, 0.1, 10, 0xb8860b, 0, 0.1, 0, Math.PI / 2);
      g.box(1.85, 0.09, 0.1, 0x5b6670, 0, 0.1, -0.05);
      for (let i = 0; i < 4; i++) g.torus(0.1, 0x6f7a82, 0.55 + i * 0.05, -0.75 - i * 0.18, 0, 0, i % 2 ? Math.PI / 2 : 0, 0);
    },
  },
  cs_filet: {
    medal: 0x3f6b2a, rot: [0.15, -0.3, 0],
    build(g) {
      // grand filet tendu, lests aux coins
      for (let i = -2; i <= 2; i++) {
        g.box(0.06, 1.9, 0.06, 0xd7c49e, i * 0.4, 0, 0, 0, 0, 0.12);
        g.box(1.9, 0.06, 0.06, 0xd7c49e, 0, i * 0.4, 0, 0, 0, 0.12);
      }
      for (const [x, y] of [[-0.95, 0.9], [0.85, 1.0], [-0.85, -1.0], [0.95, -0.85]] as const) g.ball(0.16, IRON, x, y, 0.05);
      for (const [x, y] of [[-0.2, 0.2], [0.2, -0.2], [0.2, 0.6], [-0.6, -0.2]] as const) g.ball(0.06, 0xd7c49e, x, y, 0.04);
    },
  },

  // ============================================================ Mage
  cs_boule: {
    medal: C.feu, rot: [0.1, -0.3, 0],
    build(g) {
      // boule de feu en vol : sphère ardente, queue de flammes
      for (const [a, h, r, c] of [[0, 1.4, 0.5, 0xe53935], [0.4, 0.95, 0.3, 0xe53935], [-0.4, 0.95, 0.3, 0xe53935], [0, 1.1, 0.36, ORANGE], [0, 0.8, 0.22, YEL]] as const) {
        const ang = Math.PI * 1.25 + a;
        g.cone(r, h, 8, c, 0.15 + Math.cos(ang) * (h / 2), 0.15 + Math.sin(ang) * (h / 2), -0.3 + r * 0.3, 0, 0, ang - Math.PI / 2);
      }
      g.ball(0.6, ORANGE, 0.3, 0.3, 0, 1, 1, 1, 1);
      g.ball(0.42, YEL, 0.38, 0.38, 0.22, 1, 1, 1, 1);
      g.ball(0.18, 0xfff8e1, 0.42, 0.45, 0.5);
    },
  },
  cs_flammes: {
    medal: 0xa8321c, rot: [0.2, -0.4, 0],
    build(g) {
      // mur de flammes sur une bande de terre
      g.box(2.2, 0.2, 0.6, 0x4e342e, 0, -0.95, 0);
      flame(g, -0.7, -0.8, 0.6);
      flame(g, 0.7, -0.8, 0.6);
      flame(g, 0, -0.85, 0.85);
    },
  },
  cs_meteore: {
    medal: 0x7c2d12, rot: [0.15, -0.3, 0],
    build(g) {
      // rocher en flammes qui s'écrase : cratère et gerbe au sol
      // gros rocher en flammes qui s'écrase, gerbe de lave au sol
      g.rock(0.75, 0x4e342e, 0, -1.05, 0, 1.6, 0.3, 0.9);
      rays(g, -0.35, -0.8, 6, 0.45, 0.85, ORANGE, 0.2, Math.PI - 0.2, 0.13);
      const A = Math.PI / 4;
      for (const [d, h, r, c] of [[0, 1.5, 0.55, 0xe53935], [0.35, 1.0, 0.3, 0xe53935], [-0.35, 1.0, 0.3, 0xe53935], [0, 1.1, 0.36, ORANGE], [0, 0.7, 0.2, YEL]] as const) {
        const ang = A + d;
        g.cone(r, h, 8, c, 0.05 + Math.cos(ang) * (h / 2), 0.05 + Math.sin(ang) * (h / 2), -0.7 + r * 0.6, 0, 0, ang - Math.PI / 2);
      }
      g.rock(0.62, 0x5d4037, -0.15, -0.15, 0.2);
      g.ball(0.12, YEL, -0.3, -0.05, 0.8);
      g.ball(0.1, 0xffb300, 0.05, -0.35, 0.75);
    },
  },
  cs_nova: {
    medal: C.givre, rot: [0.1, -0.3, 0],
    build(g) {
      // éclatement de givre : pics de glace en couronne autour d'un cœur gelé
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, l = i % 2 ? 0.5 : 0.75;
        g.cone(0.17, l, 5, i % 2 ? ICE : ICE_L, Math.cos(a) * (0.5 + l / 2), Math.sin(a) * (0.5 + l / 2), 0, 0, 0, a - Math.PI / 2);
      }
      g.ball(0.48, 0x81d4fa, 0, 0, 0, 1, 1, 1, 0);
      g.ball(0.3, ICE_L, -0.08, 0.1, 0.2);
      g.torus(0.62, 0xe1f5fe, 0, 0, -0.1);
    },
  },
  cs_blizzard: {
    medal: 0x1e4f8a, rot: [0.1, -0.3, 0],
    build(g) {
      // nuage de tempête, flocons et vent
      cloud(g, 0, 0.45, 0.85, 0xeef4f8, 0xb0c4d0);
      flake(g, -0.55, -0.55, 0.28);
      flake(g, 0.3, -0.75, 0.24);
      flake(g, 0.8, -0.3, 0.2);
      for (const [y, l] of [[-0.25, 0.7], [-0.95, 0.55]] as const) g.box(l, 0.06, 0.05, 0xe1f5fe, -0.6 + l / 2, y, 0.1, 0, 0, -0.25);
    },
  },
  cs_eclair: {
    medal: C.arcane, rot: [0.1, -0.3, 0],
    build(g) {
      // éclair qui frappe un ennemi puis rebondit sur deux autres
      bolt(g, -0.45, 0.25, 0.75, 0xe9d5ff);
      for (const [x, y] of [[-0.6, -0.75], [0.35, -0.55], [0.85, 0.35]] as const) g.ball(0.22, 0x7c3aed, x, y, 0.05, 1, 1, 1, 1);
      for (const [x1, y1, x2, y2] of [[-0.6, -0.75, 0.35, -0.55], [0.35, -0.55, 0.85, 0.35]] as const) {
        const mx = (x1 + x2) / 2 + 0.12, my = (y1 + y2) / 2 + 0.1;
        for (const [a, b, c, d] of [[x1, y1, mx, my], [mx, my, x2, y2]]) g.box(Math.hypot(c - a, d - b), 0.09, 0.06, 0xfde047, (a + c) / 2, (b + d) / 2, 0.15, 0, 0, Math.atan2(d - b, c - a));
      }
    },
  },
  cs_prison: {
    medal: 0x4c1d95, rot: [0.15, -0.35, 0],
    build(g) {
      // sablier figé dans un cercle runique
      g.torus(1.0, VIOLET, 0, 0, -0.1);
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.box(0.12, 0.12, 0.06, 0xe9d5ff, Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.05, 0, 0, a); }
      for (const y of [0.75, -0.75]) g.cyl(0.5, 0.5, 0.12, 8, GOLD, 0, y, 0);
      for (const x of [-0.42, 0.42]) g.box(0.07, 1.45, 0.07, GOLD_D, x, 0, 0.3);
      g.cone(0.4, 0.65, 10, 0xd8e6f0, 0, 0.36, 0, Math.PI);
      g.cone(0.4, 0.65, 10, 0xd8e6f0, 0, -0.36, 0);
      g.cone(0.25, 0.3, 8, 0xc084fc, 0, -0.5, 0.02);
      g.cone(0.2, 0.22, 8, 0xc084fc, 0, 0.5, 0.02, Math.PI);
    },
  },

  // ============================================================ Nécromancien
  cs_faux: {
    medal: C.necro, rot: [0.1, -0.3, 0],
    build(g) {
      // grande faux spectrale
      g.box(0.12, 2.1, 0.12, 0x3e2a18, 0.2, -0.1, 0, 0, 0, 0.35);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([-t * 1.35, 0.15 * Math.sin(t * Math.PI) + 0.05 - t * 0.35]); }
      for (let i = 10; i >= 0; i--) { const t = i / 10; pts.push([-t * 1.35, 0.15 * Math.sin(t * Math.PI) + 0.05 - t * 0.35 + 0.32 * (1 - t) + 0.02]); }
      g.shape(pts, 0.08, 0xc9d6df, 0.55, 0.8, 0.05);
      g.shape(pts.map(([x, y]) => [x, y + 0.1] as [number, number]), 0.06, 0xa78bfa, 0.55, 0.82, -0.05);
      for (const [x, y] of [[-0.75, -0.2], [-0.4, -0.7], [0.8, -0.6]] as const) g.ball(0.09, VIOLET, x, y, 0.2);
    },
  },
  cs_golem: {
    medal: 0x3b1a6b, rot: [0.15, -0.35, 0],
    build(g) {
      // colosse d'os : crâne, cage thoracique, bras massifs
      skull(g, 0, 0.6, 0.55, 0xa855f7);
      g.box(0.14, 1.1, 0.14, BONE, 0, -0.35, 0);
      for (const [y, w] of [[0.05, 1.0], [-0.2, 0.9], [-0.45, 0.75]] as const) g.box(w, 0.12, 0.3, BONE, 0, y, 0.05);
      bone(g, -0.55, 0.15, -0.95, -0.55, 1.3);
      bone(g, 0.55, 0.15, 0.95, -0.55, 1.3);
      g.box(1.3, 0.2, 0.3, BONE, 0, 0.2, 0);
      g.box(0.6, 0.2, 0.3, BONE, 0, -0.9, 0);
    },
  },
  cs_peste: {
    medal: C.peste, rot: [0.1, -0.3, 0],
    build(g) {
      // nuée toxique avec un crâne dedans, gouttes qui tombent
      cloud(g, 0, 0.15, 0.95, TOXIC, TOXIC_D);
      skull(g, 0, 0.1, 0.42, 0x1b3a0c);
      drop(g, -0.5, -0.8, 0.22, TOXIC);
      drop(g, 0.45, -0.95, 0.18, TOXIC);
    },
  },
  cs_malediction: {
    medal: 0x2e1065, rot: [0.25, -0.3, 0],
    build(g) {
      // cercle maudit au sol, crâne surmonté de flammes violettes
      g.torus(1.0, VIOLET, 0, -0.1, -0.4);
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + 0.2; g.box(0.16, 0.16, 0.06, 0xe9d5ff, Math.cos(a) * 1.0, -0.1 + Math.sin(a) * 1.0, -0.3, 0, 0, a); }
      for (const [x, k, c] of [[0, 0.9, 0x7c3aed], [-0.3, 0.6, 0xa855f7], [0.32, 0.65, 0xa855f7], [0.02, 0.5, 0xe9d5ff]] as const) g.cone(0.3 * k, 1.0 * k, 7, c, x, 0.3 + k * 0.4, -0.1);
      skull(g, 0, -0.25, 0.85, 0xa855f7);
    },
  },

  // ============================================================ Artificier
  cs_bombe: {
    medal: C.artificier, rot: [0.15, -0.35, 0],
    build(g) {
      bomb(g, -0.15, -0.2, 1.15);
      spark(g, 0.55, 0.75, 1.2);
    },
  },
  cs_acide: {
    medal: 0x3f6b1f, rot: [0.15, -0.35, 0],
    build(g) {
      // fiole renversée, flaque d'acide qui bouillonne
      g.cyl(0.95, 0.95, 0.08, 14, TOXIC_D, 0, -0.85, 0, 0.25, 0, 0);
      g.cyl(0.7, 0.7, 0.1, 14, TOXIC, 0, -0.82, 0.02, 0.25, 0, 0);
      for (const [x, z, r] of [[-0.35, 0.1, 0.12], [0.3, 0.2, 0.09], [0.05, -0.05, 0.15]] as const) g.ball(r, 0xc5f78a, x, -0.72 + r * 0.5, z);
      flask(g, 0.3, 0.35, 0.75, TOXIC, 2.3);
      drop(g, -0.2, -0.25, 0.2, TOXIC);
    },
  },
  cs_transmutation: {
    medal: 0x8a6a10, rot: [0.15, -0.3, 0],
    build(g) {
      // cercle d'alchimie qui éclate en pièces d'or
      g.torus(0.95, GOLD, 0, 0, -0.1);
      const tri: [number, number][] = [[0, 0.85], [0.74, -0.43], [-0.74, -0.43]];
      for (let i = 0; i < 3; i++) {
        const [a, b] = tri[i], [c, d] = tri[(i + 1) % 3];
        g.box(Math.hypot(c - a, d - b), 0.08, 0.06, GOLD_D, (a + c) / 2, (b + d) / 2, -0.05, 0, 0, Math.atan2(d - b, c - a));
      }
      star(g, 0, 0, 0.45, 0xfff3c0, 0.05, 8);
      for (const [x, y, z, t] of [[-0.55, 0.55, 0.35, 0.3], [0.6, 0.45, 0.3, -0.4], [0.1, -0.55, 0.4, 0.1], [0.75, -0.5, 0.2, 0.5]] as const) coin(g, x, y, z, 1, t);
    },
  },
  cs_usine: {
    medal: 0x115e59, rot: [0.2, -0.45, 0],
    build(g) {
      // trois tourelles déployées en triangle
      turret(g, -0.55, 0.3, 0.75, -0.6);
      turret(g, 0.6, 0.3, 0.75, -0.6);
      turret(g, 0, -0.35, 0.9, 0.2);
    },
  },
  cs_grenades: {
    medal: C.poudre, rot: [0.15, -0.3, 0],
    build(g) {
      // chapelet de trois grenades liées par la mèche
      g.box(2.0, 0.05, 0.05, 0x8a5a33, 0, -0.05, 0.2, 0, 0, 0.45);
      for (const [x, y] of [[-0.7, -0.4], [0, -0.05], [0.7, 0.3]] as const) {
        g.ball(0.36, 0x4a5a3a, x, y, 0, 1, 1.15, 1, 1);
        g.cyl(0.1, 0.12, 0.15, 6, 0x8b98a0, x, y + 0.45, 0);
        g.box(0.06, 0.28, 0.06, 0x8b98a0, x + 0.15, y + 0.3, 0.1, 0, 0, -0.4);
      }
      spark(g, 0.95, 0.72, 0.9);
    },
  },
  cs_barrage: {
    medal: 0x7c2d12, rot: [0.15, -0.3, 0],
    build(g) {
      // obus qui pleuvent, explosion au sol
      g.rock(0.75, 0x4e342e, 0, -1.05, 0, 1.6, 0.3, 0.9);
      star(g, 0.45, -0.75, 0.42, ORANGE, 0.1, 7);
      star(g, 0.45, -0.75, 0.24, YEL, 0.15, 7);
      for (const [x, y] of [[-0.6, 0.0], [0.05, 0.55], [0.75, 0.6]] as const) {
        g.cyl(0.24, 0.24, 0.62, 8, 0x55606a, x, y, 0, 0, 0, 0.35);
        g.cone(0.24, 0.4, 8, GOLD_D, x + 0.18, y - 0.5, 0, 0, 0, Math.PI + 0.35);
        g.box(0.12, 0.55, 0.05, 0xffcc80, x - 0.17, y + 0.55, -0.15, 0, 0, 0.35);
      }
    },
  },

  // ============================================================ passifs : Épéiste
  cp_riposte: {
    medal: C.epeiste, rot: [0.1, -0.3, 0],
    build(g) {
      // deux lames qui se croisent, éclat du coup critique
      sword(g, -0.4, -0.55, -0.6, 1.5);
      sword(g, 0.4, -0.55, 0.6, 1.5, 0xbfe3ff);
      star(g, 0, 0.35, 0.42, YEL, 0.2, 6);
    },
  },
  cp_execution: {
    medal: 0x7f1d1d, rot: [0.1, -0.3, 0],
    build(g) {
      // crâne tranché par une lame
      skull(g, -0.15, -0.1, 0.9, 0xd32f2f);
      sword(g, 0.55, -0.65, 0.75, 1.9);
    },
  },
  cp_inspiration: {
    medal: 0x2f5fa8, rot: [0.15, -0.35, 0],
    build(g) {
      // bannière levée au-dessus de deux soldats
      g.cyl(0.05, 0.05, 2.0, 6, WOOD, -0.1, 0.1, -0.2);
      g.shape([[0, 0], [0.95, 0], [0.75, -0.3], [0.95, -0.6], [0, -0.6]], 0.06, RED, -0.08, 1.0, -0.2);
      star(g, 0.35, 0.72, 0.15, YEL, -0.12);
      soldier(g, -0.6, -0.45, 1, 0.2);
      soldier(g, 0.55, -0.55, 1, 0.3);
    },
  },
  cp_saignement: {
    medal: 0x7f1d1d, rot: [0.1, -0.3, 0],
    build(g) {
      // lame qui goutte de sang
      sword(g, -0.25, -0.35, 0.55, 1.8);
      drop(g, 0.4, -0.25, 0.3, BLOOD);
      drop(g, 0.65, -0.85, 0.22, BLOOD);
      drop(g, 0.05, -0.85, 0.16, BLOOD);
    },
  },
  cp_fureur: {
    medal: 0x9a1c1c, rot: [0.1, -0.3, 0],
    build(g) {
      // cœur fendu dans des flammes de rage
      flame(g, 0, -0.95, 1.05);
      heart(g, 0, -0.15, 0.5, 0x8b0000, 0.35);
      g.box(0.07, 0.6, 0.1, 0x1b1b1b, 0.02, -0.15, 0.6, 0, 0, 0.3);
    },
  },

  // ============================================================ passifs : Gardien
  cp_epines: {
    medal: C.gardien, rot: [0.15, -0.35, 0],
    build(g) {
      // écu hérissé de pointes
      shield(g, 0, 0, 0.9, 0x6f7a82, 0x8b98a0);
      for (const [x, y, a] of [[-0.95, 0.5, 1.57], [0.95, 0.5, -1.57], [-0.9, -0.1, 1.9], [0.9, -0.1, -1.9], [-0.55, -0.7, 2.4], [0.55, -0.7, -2.4], [0, 1.0, 0], [0, -1.05, Math.PI]] as const) g.cone(0.13, 0.4, 4, STEEL, x, y, 0, 0, 0, a);
      for (const [x, y] of [[-0.3, 0.3], [0.3, 0.3], [0, -0.15]] as const) g.cone(0.1, 0.3, 4, STEEL, x, y, 0.25, Math.PI / 2);
    },
  },
  cp_garde: {
    medal: 0x2f5fa8, rot: [0.15, -0.35, 0],
    build(g) {
      // grand écu qui couvre un soldat
      soldier(g, 0.5, -0.15, 1.7, -0.4);
      shield(g, -0.35, -0.1, 0.8, 0x8b98a0, GOLD, 0.25);
      g.box(0.18, 0.9, 0.06, GOLD, -0.35, -0.05, 0.4);
    },
  },
  cp_soin: {
    medal: 0x2f7d4f, rot: [0.15, -0.35, 0],
    build(g) {
      // soldat dans un halo vert, croix de soin
      g.torus(0.9, 0x86efac, 0, -0.95, 0, Math.PI / 2 - 0.3, 0, 0);
      soldier(g, -0.15, -0.25, 1.9);
      g.box(0.2, 0.62, 0.15, 0x4caf50, 0.7, 0.6, 0.3);
      g.box(0.62, 0.2, 0.15, 0x4caf50, 0.7, 0.6, 0.3);
      for (const [x, y] of [[0.75, -0.2], [-0.85, 0.5], [0.3, 1.0]] as const) g.ball(0.08, 0xb9f6ca, x, y, 0.3);
    },
  },
  cp_commotion: {
    medal: 0x52606d, rot: [0.15, -0.35, 0],
    build(g) {
      // casque cabossé et étoiles qui tournent
      g.ball(0.62, 0x8b98a0, 0, -0.3, 0, 1, 0.85, 1, 1);
      g.cyl(0.66, 0.66, 0.12, 12, 0x5b6670, 0, -0.55, 0);
      g.box(0.6, 0.08, 0.1, 0x1b1b1b, 0, -0.4, 0.58);
      g.ball(0.18, 0x5b6670, 0.25, 0.05, 0.45, 1, 0.6, 0.5);
      for (const [x, y, k] of [[-0.7, 0.55, 0.3], [0.05, 0.85, 0.34], [0.75, 0.5, 0.28]] as const) star(g, x, y, k, YEL, 0.3);
    },
  },
  cp_lourd: {
    medal: 0x52606d, rot: [0.15, -0.35, 0],
    build(g) {
      // marteau qui fend une plaque d'armure
      shield(g, -0.3, -0.25, 0.75, 0x8b98a0, 0x5b6670);
      g.shape([[0, 0.7], [0.12, 0.15], [-0.1, 0.05], [0.08, -0.65], [-0.06, 0.0], [0.15, 0.1]], 0.3, 0x1b2a33, -0.3, -0.25, 0);
      hammer(g, 0.45, 0.0, -0.7, 0.65);
    },
  },

  // ============================================================ passifs : Archer
  cp_tirmortel: {
    medal: 0x1f3a1a, rot: [0.1, -0.3, 0],
    build(g) {
      arrow(g, 0, -0.05, -0.75, 2.1, 0x2a2a2a);
      skull(g, -0.3, 0.25, 0.6, 0xd32f2f);
    },
  },
  cp_multi: {
    medal: C.archer, rot: [0.1, -0.3, 0],
    build(g) {
      // deux flèches jumelles qui divergent
      arrow(g, -0.3, -0.05, 0.3, 1.8, GREEN);
      arrow(g, 0.3, -0.05, -0.3, 1.8, 0xfff0b0);
      g.ball(0.12, GOLD, 0, -0.9, 0.1);
    },
  },
  cp_portee: {
    medal: 0x1f5a4a, rot: [0.15, -0.35, 0],
    build(g) {
      // tête de faucon
      g.ball(0.7, 0x8a5a33, 0, 0.05, 0, 1, 1.05, 0.9, 1);
      g.ball(0.45, 0xf3e5c8, 0.15, -0.3, 0.35, 1, 0.9, 0.6, 1);
      g.cone(0.22, 0.6, 5, GOLD, 0.62, -0.05, 0.25, 0, 0, -1.9);
      g.ball(0.17, 0xffd54f, 0.22, 0.25, 0.55);
      g.ball(0.09, 0x111111, 0.27, 0.27, 0.68);
      g.box(0.5, 0.1, 0.1, 0x3e2a18, 0.15, 0.48, 0.5, 0, 0, -0.25);
    },
  },
  cp_venin: {
    medal: 0x3f6b1f, rot: [0.1, -0.3, 0],
    build(g) {
      arrow(g, -0.15, 0.1, -0.75, 1.9, GREEN, 0x7cf05a);
      drop(g, 0.5, -0.45, 0.38, TOXIC);
      drop(g, 0.15, -0.85, 0.24, 0x5ad13a);
    },
  },
  cp_chasseur: {
    medal: 0x2f5f7d, rot: [0.1, -0.3, 0],
    build(g) {
      // oiseau en vol transpercé d'une flèche
      g.ball(0.35, 0x5d4037, 0, 0.1, 0, 1.5, 0.9, 0.9, 1);
      for (const sg of [-1, 1]) g.shape([[0, 0], [1.0 * sg, 0.55], [0.85 * sg, 0.25], [0.95 * sg, 0.05], [0.6 * sg, 0.05], [0.4 * sg, -0.15]], 0.06, 0x795548, sg * 0.15, 0.15, -0.05);
      g.ball(0.2, 0x5d4037, 0.45, 0.25, 0.05);
      g.cone(0.08, 0.2, 4, GOLD, 0.68, 0.22, 0.05, 0, 0, -1.57);
      arrow(g, -0.1, -0.15, -0.95, 2.0, GREEN);
    },
  },

  // ============================================================ passifs : Mage
  cp_brulure: {
    medal: C.feu, rot: [0.1, -0.3, 0],
    build(g) {
      // orbe magique qui s'embrase
      flame(g, 0, -0.55, 0.9);
      g.ball(0.42, PURPLE, 0, -0.45, 0.35, 1, 1, 1, 1);
      g.ball(0.12, 0xe9d5ff, -0.12, -0.3, 0.7);
    },
  },
  cp_combustion: {
    medal: 0x9a3412, rot: [0.1, -0.3, 0],
    build(g) {
      // crâne qui explose en éclats de feu
      star(g, 0, 0, 1.05, ORANGE, -0.2, 8);
      star(g, 0, 0, 0.75, YEL, -0.1, 8);
      skull(g, 0, 0, 0.6, 0xff5722);
    },
  },
  cp_givre: {
    medal: C.givre, rot: [0.15, -0.3, 0],
    build(g) {
      // botte prise dans la glace
      g.box(0.45, 0.75, 0.45, 0x8a5a33, -0.1, 0.1, 0);
      g.box(0.8, 0.32, 0.5, 0x8a5a33, 0.08, -0.38, 0);
      g.box(1.4, 0.75, 0.75, 0xb3e5fc, 0, -0.45, 0.05);
      for (const [x, y] of [[-0.6, -0.1], [0.55, 0.0], [0.65, -0.65]] as const) g.cone(0.13, 0.45, 4, ICE_L, x, y, 0.3);
      flake(g, 0.7, 0.75, 0.25);
    },
  },
  cp_focalisation: {
    medal: C.arcane, rot: [0.1, -0.3, 0],
    build(g) {
      // cristal focalisant au centre d'une horloge
      g.torus(0.9, GOLD, 0, 0, -0.1);
      for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; g.box(0.06, k % 3 ? 0.12 : 0.22, 0.06, 0xfff3c0, Math.cos(a) * 0.72, Math.sin(a) * 0.72, -0.05, 0, 0, a + Math.PI / 2); }
      g.cone(0.32, 0.6, 6, 0xc084fc, 0, 0.3, 0.2);
      g.cone(0.32, 0.6, 6, 0x9333ea, 0, -0.3, 0.2, Math.PI);
      g.box(0.06, 0.5, 0.06, 0xfff3c0, 0.3, 0.2, 0.45, 0, 0, -0.6);
    },
  },
  cp_clairvoyance: {
    medal: 0x4c1d95, rot: [0.1, -0.3, 0],
    build(g) {
      // troisième œil ouvert, rayons de vision
      g.ball(0.95, 0xfff7e6, 0, 0, 0, 1, 0.55, 0.35, 1);
      g.cyl(0.42, 0.42, 0.1, 12, 0x9333ea, 0, 0, 0.3, Math.PI / 2);
      g.cyl(0.2, 0.2, 0.12, 10, 0x1b0b33, 0, 0, 0.33, Math.PI / 2);
      g.ball(0.08, 0xffffff, -0.12, 0.12, 0.42);
      rays(g, 0, 0, 9, 1.0, 1.3, 0xe9d5ff, 0.2, Math.PI - 0.2);
    },
  },
  cp_resonance: {
    medal: C.arcane, rot: [0.1, -0.3, 0],
    build(g) {
      // cristal qui vibre : anneaux concentriques
      for (const r of [0.55, 0.8, 1.05]) g.torus(r, r === 0.8 ? 0xc084fc : 0xe9d5ff, 0, 0, -0.1);
      g.cone(0.28, 0.55, 6, 0xe9d5ff, 0, 0.27, 0.15);
      g.cone(0.28, 0.55, 6, 0xa855f7, 0, -0.27, 0.15, Math.PI);
    },
  },

  // ============================================================ passifs : Nécromancien
  cp_moisson: {
    medal: C.necro, rot: [0.1, -0.3, 0],
    build(g) {
      // âme aspirée d'un crâne vers un cœur
      skull(g, -0.45, -0.4, 0.55, 0xa855f7);
      heart(g, 0.45, 0.4, 0.42, BLOOD, 0.1);
      swirl(g, 0, 0, 0.6, Math.PI * 1.2, Math.PI * 0.3, 0xc4a8ff, 0.14, 0.3);
    },
  },
  cp_ossements: {
    medal: 0x3b1a6b, rot: [0.1, -0.3, 0],
    build(g) {
      // deux os croisés et un écu violet : invocations robustes
      bone(g, -0.85, -0.85, 0.85, 0.85, 1.4);
      bone(g, -0.85, 0.85, 0.85, -0.85, 1.4, 0.05);
      shield(g, 0, 0, 0.4, 0x7c3aed, GOLD, 0.3);
    },
  },
  cp_legion: {
    medal: C.necro, rot: [0.1, -0.3, 0],
    build(g) {
      // rangs de squelettes
      skeleton(g, -0.6, 0.3, 0.7);
      skeleton(g, 0.6, 0.3, 0.7);
      skeleton(g, 0, -0.35, 0.9);
    },
  },
  cp_contagion: {
    medal: C.peste, rot: [0.1, -0.3, 0],
    build(g) {
      // orbe de poison, bulles qui se répandent
      g.ball(0.6, TOXIC_D, -0.15, -0.1, 0, 1, 1, 1, 1);
      g.ball(0.45, TOXIC, -0.2, -0.05, 0.2, 1, 1, 1, 1);
      g.ball(0.12, 0xe6ffd0, -0.35, 0.15, 0.6);
      for (const [x, y, r] of [[0.6, 0.55, 0.2], [0.75, -0.1, 0.15], [0.35, 0.95, 0.12], [-0.7, 0.7, 0.13], [0.5, -0.75, 0.18]] as const) g.ball(r, TOXIC, x, y, 0.1, 1, 1, 1, 1);
    },
  },
  cp_pourriture: {
    medal: 0x3a4a1a, rot: [0.1, -0.3, 0],
    build(g) {
      // flaque putride, os rongés, mouches
      g.cyl(0.95, 0.95, 0.1, 14, 0x556b2f, 0, -0.65, 0, 0.3, 0, 0);
      bone(g, -0.6, -0.45, 0.4, -0.25, 1.0, 0.3);
      skull(g, 0.15, 0.15, 0.5, 0x6b8e23);
      for (const [x, y] of [[-0.6, 0.6], [0.75, 0.75], [0.8, 0.1]] as const) { g.ball(0.07, 0x1b1b1b, x, y, 0.3); g.ball(0.06, 0xe0e0e0, x + 0.06, y + 0.06, 0.28, 1.4, 0.6, 0.5); }
    },
  },

  // ============================================================ passifs : Artificier
  cp_instable: {
    medal: C.artificier, rot: [0.1, -0.3, 0],
    build(g) {
      // fiole qui déborde et crépite
      flask(g, 0, -0.35, 0.85, 0xf97316);
      bolt(g, -0.75, 0.45, 0.28, YEL);
      bolt(g, 0.75, 0.35, 0.24, YEL);
      for (const [x, y] of [[0.0, 0.95], [-0.35, 0.7], [0.4, 0.95]] as const) g.ball(0.1, 0xfdba74, x, y, 0.2);
    },
  },
  cp_catalyse: {
    medal: 0x3f6b1f, rot: [0.1, -0.3, 0],
    build(g) {
      // deux fioles qui se mélangent en un éclat
      flask(g, -0.5, -0.3, 0.6, TOXIC, 0.4);
      flask(g, 0.5, -0.3, 0.6, 0xf97316, -0.4);
      star(g, 0, 0.6, 0.4, 0xfff3c0, 0.1, 6);
    },
  },
  cp_mecanique: {
    medal: 0x115e59, rot: [0.15, -0.35, 0],
    build(g) {
      // engrenage et clé
      const pts: [number, number][] = [];
      for (let k = 0; k < 24; k++) { const a = (k * Math.PI) / 12, r = k % 4 < 2 ? 0.85 : 0.65; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      g.shape(pts, 0.3, 0x9aa7af, -0.15, 0.05, 0);
      g.cyl(0.28, 0.28, 0.36, 10, 0x5b6670, -0.15, 0.05, 0, Math.PI / 2);
      g.box(0.2, 1.4, 0.14, GOLD, 0.45, -0.25, 0.3, 0, 0, -0.75);
      g.torus(0.22, GOLD, 0.9, 0.22, 0.3, 0, 0, 0.8);
    },
  },
  cp_forge: {
    medal: 0xa8321c, rot: [0.2, -0.4, 0],
    build(g) {
      // enclume portative et braises
      g.shape([[-1, 0.45], [0.55, 0.45], [0.95, 0.25], [0.5, 0.12], [0.35, -0.05], [-0.55, -0.05], [-0.75, 0.25]], 0.5, 0x6f7a82, 0, -0.15, 0);
      g.box(0.6, 0.4, 0.4, 0x5b6670, -0.1, -0.45, 0);
      g.box(0.95, 0.18, 0.6, 0x5b6670, -0.1, -0.7, 0);
      flame(g, 0.05, 0.3, 0.45);
    },
  },
  cp_poudre: {
    medal: C.poudre, rot: [0.2, -0.4, 0],
    build(g) {
      // baril de poudre noire
      g.cyl(0.55, 0.6, 1.3, 12, 0x8a5a33, 0, -0.2, 0);
      for (const y of [-0.7, 0.3]) g.cyl(0.62, 0.62, 0.1, 12, 0x3e2a18, 0, y, 0);
      g.cyl(0.5, 0.5, 0.06, 12, 0x2a2a2a, 0, 0.46, 0);
      g.box(0.55, 0.32, 0.05, 0x2a2a2a, 0, -0.2, 0.6);
      g.box(0.06, 0.45, 0.06, 0x8a5a33, 0.25, 0.65, 0, 0, 0, -0.4);
      spark(g, 0.45, 0.95, 1.0);
    },
  },
  cp_shrapnel: {
    medal: 0x9a3412, rot: [0.1, -0.3, 0],
    build(g) {
      // éclats brûlants qui volent hors d'une explosion
      star(g, 0, -0.1, 0.65, ORANGE, -0.1, 7);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + 0.3;
        g.rock(0.15, 0x37414a, Math.cos(a) * 0.85, -0.1 + Math.sin(a) * 0.85, 0.2);
        g.box(0.35, 0.07, 0.05, ORANGE, Math.cos(a) * 0.55, -0.1 + Math.sin(a) * 0.55, 0.1, 0, 0, a);
      }
    },
  },
};

