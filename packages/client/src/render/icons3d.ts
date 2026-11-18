import * as THREE from 'three';
import { GB } from '../art/builder';
import { toonGradient } from './materials';
import { CLASS_ICONS3D } from './iconsClasses';
import { GOLD, GOLD_D, GREEN, HEATER, IRON, IVORY, M, ORANGE, PURPLE, RED, STEEL, WOOD, YEL, arrow, bolt, drop, flame, rays, skull, sword } from './iconParts';

/**
 * Icônes du jeu rendues en 3D (style A) : petits objets low-poly éclairés comme le monde,
 * contour sombre pour la lisibilité, posés dans un médaillon à la couleur de leur élément
 * (les ressources affichées en ligne, comme l'or et les vies, n'ont pas de médaillon).
 */
export interface Icon3D {
  build: (g: GB) => void;
  /** couleur du médaillon (absent : objet seul) */
  medal?: number;
  /** rotation de présentation de l'objet */
  rot?: [number, number, number];
  /** zoom (1 : l'objet remplit le médaillon) */
  zoom?: number;
}


export const ICONS3D: Record<string, Icon3D> = {

  // ------------------------------------------------ HUD (sans médaillon, sauf l'appel de vague)
  horn: {
    // compteur de vagues : deux épées croisées (le combat qui arrive)
    rot: [0.12, -0.3, 0],
    build(g) {
      sword(g, -0.62, -0.7, -0.68, 2.1);
      sword(g, 0.62, -0.7, 0.68, 2.1);
    },
  },
  skull: { medal: M.red, rot: [0.1, -0.3, 0], build: (g) => skull(g, 0, 0, 1.3) },
  star: {
    rot: [0.2, -0.35, 0],
    build(g) {
      const pts: [number, number][] = [];
      for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.42 : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      g.shape(pts, 0.32, GOLD, 0, 0, 0);
      g.shape(pts, 0.36, 0xffd36b, 0, 0.02, 0.02, 0, 0, 0, 0.55);
    },
  },
  starEmpty: {
    rot: [0.2, -0.35, 0],
    build(g) {
      const pts: [number, number][] = [];
      for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.42 : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      g.shape(pts, 0.3, 0x6b7378, 0, 0, 0);
    },
  },
  trophy: {
    rot: [0.25, -0.35, 0],
    build(g) {
      g.cyl(0.62, 0.3, 0.75, 10, GOLD, 0, 0.35, 0);
      g.cyl(0.5, 0.5, 0.05, 10, GOLD_D, 0, 0.73, 0);
      for (const sx of [-1, 1]) g.torus(0.24, GOLD, sx * 0.62, 0.38, 0, 0, 0, 0);
      g.cyl(0.08, 0.12, 0.4, 6, GOLD_D, 0, -0.2, 0);
      g.cyl(0.42, 0.48, 0.18, 8, GOLD, 0, -0.48, 0);
      g.box(0.6, 0.14, 0.5, 0x5a3a22, 0, -0.64, 0);
      g.shape([[0, 0.18], [0.06, 0.05], [0.18, 0.04], [0.08, -0.04], [0.12, -0.18], [0, -0.09], [-0.12, -0.18], [-0.08, -0.04], [-0.18, 0.04], [-0.06, 0.05]], 0.06, 0xfff0b0, 0, 0.35, 0.55);
    },
  },
  lock: {
    rot: [0.15, -0.35, 0],
    build(g) {
      g.torus(0.42, 0x8a959c, 0, 0.35, 0, 0, 0, 0);
      g.box(1.15, 0.9, 0.42, IRON, 0, -0.3, 0);
      g.box(1.2, 0.12, 0.46, 0x7a858c, 0, 0.05, 0);
      g.ball(0.13, 0x1b1b1b, 0, -0.22, 0.22, 1, 1, 0.4);
      g.box(0.08, 0.26, 0.05, 0x1b1b1b, 0, -0.4, 0.21);
    },
  },
  gift: {
    rot: [0.3, -0.5, 0],
    build(g) {
      g.box(1.2, 0.9, 1.0, RED, 0, -0.3, 0);
      g.box(1.3, 0.22, 1.1, 0xc62f28, 0, 0.2, 0);
      g.box(0.2, 1.15, 1.04, GOLD, 0, -0.2, 0);
      g.box(1.24, 1.15, 0.2, GOLD, 0, -0.2, 0);
      g.torus(0.24, GOLD, -0.22, 0.48, 0, 0, 0.7, 0.3);
      g.torus(0.24, GOLD, 0.22, 0.48, 0, 0, -0.7, -0.3);
    },
  },
  // ------------------------------------------------ familles de tours
  fam_0: {
    medal: M.arch, rot: [0.1, -0.35, 0], zoom: 1.12,
    build(g) {
      // arc courbé, corde, flèche encochée
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i / 6) * Math.PI, x = Math.cos(a) * 0.45 - 0.35, y = Math.sin(a) * 1.0;
        g.box(0.2, 0.38, 0.18, i === 3 ? 0x3e2a18 : WOOD, x, y, 0, 0, 0, a);
      }
      g.box(0.03, 1.9, 0.03, 0xf5f0e0, -0.35, 0, 0);
      arrow(g, 0.15, 0, -Math.PI / 2, 1.7);
    },
  },
  fam_1: {
    medal: M.bar, rot: [0.15, -0.35, 0],
    build(g) {
      g.shape(HEATER, 0.22, 0xc62f28, 0, 0, 0);
      g.shape(HEATER.map(([x, y]) => [x * 1.1, y * 1.08 + 0.01] as [number, number]), 0.16, GOLD, 0, 0, -0.06);
      g.box(0.22, 1.25, 0.06, GOLD, 0, 0, 0.12);
      g.box(1.0, 0.22, 0.06, GOLD, 0, 0.25, 0.12);
    },
  },
  fam_2: {
    medal: M.mag, rot: [0.1, -0.35, 0],
    build(g) {
      g.cyl(0.08, 0.1, 1.4, 6, WOOD, 0, -0.7, 0);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; g.cone(0.07, 0.4, 4, GOLD, Math.cos(a) * 0.25, 0.05, Math.sin(a) * 0.25, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
      g.cyl(0.2, 0.12, 0.15, 8, GOLD, 0, -0.08, 0);
      g.ball(0.45, PURPLE, 0, 0.35, 0, 1, 1, 1, 1);
      g.ball(0.14, 0xe9d5ff, -0.15, 0.5, 0.33);
    },
  },
  fam_3: {
    medal: M.art, rot: [0.2, -0.6, 0],
    build(g) {
      g.cyl(0.3, 0.38, 1.6, 10, 0x37414a, 0.15, 0.15, 0, 0, 0, -1.1);
      g.cyl(0.42, 0.42, 0.14, 10, 0x262e35, 0.82, 0.48, 0, 0, 0, -1.1);
      g.box(1.0, 0.35, 0.6, WOOD, -0.15, -0.35, 0);
      for (const z of [-0.38, 0.38]) g.cyl(0.42, 0.42, 0.12, 10, 0x5a3a22, -0.15, -0.45, z, Math.PI / 2);
      for (const z of [-0.45, 0.45]) g.cyl(0.12, 0.12, 0.05, 6, GOLD, -0.15, -0.45, z, Math.PI / 2);
    },
  },
  fam_4: {
    medal: M.mine, rot: [0.25, -0.5, 0],
    build(g) {
      // pioche sur un tas de pépites
      g.box(0.12, 1.5, 0.12, WOOD, 0.1, 0.15, 0, 0, 0, -0.5);
      g.shape([[-0.75, 0], [0.75, 0], [0.55, 0.16], [0, 0.26], [-0.55, 0.16]], 0.13, STEEL, 0.45, 0.72, 0, 0, 0, -0.5);
      for (const [x, y, r] of [[-0.45, -0.5, 0.26], [-0.1, -0.62, 0.22], [-0.7, -0.62, 0.2], [-0.3, -0.3, 0.2]]) g.rock(r, GOLD, x, y, 0.1, 1, 0.8, 1);
    },
  },
  fam_5: {
    medal: M.camp, rot: [0.3, -0.5, 0],
    build(g) {
      // tente rayée et fanion
      g.cone(0.95, 1.2, 4, 0xf3e5c8, 0, -0.1, 0, 0, Math.PI / 4);
      g.cone(0.97, 0.6, 4, RED, 0, 0.2, 0, 0, Math.PI / 4);
      g.box(0.3, 0.55, 0.05, 0x3e2723, 0, -0.42, 0.62);
      g.box(0.05, 0.8, 0.05, WOOD, 0, 0.85, 0);
      g.shape([[0, 0], [0.45, 0.12], [0, 0.26]], 0.04, YEL, 0.03, 1.05, 0);
    },
  },
  // ------------------------------------------------ actions de tour
  up: {
    medal: M.gold, rot: [0.15, -0.35, 0],
    build(g) {
      g.shape([[0, 1], [0.7, 0.2], [0.28, 0.2], [0.28, -0.55], [-0.28, -0.55], [-0.28, 0.2], [-0.7, 0.2]], 0.3, 0x8fd36b, 0, 0.1, 0);
      g.box(1.1, 0.2, 0.6, 0x9aa4ab, 0, -0.62, 0);
    },
  },
  sell: {
    medal: M.neutral, rot: [0.2, -0.4, 0],
    build(g) {
      g.ball(0.62, 0x9a6b3c, -0.15, -0.15, 0, 1, 0.9, 0.85, 1);
      g.cyl(0.18, 0.32, 0.35, 8, 0x8a5a2b, -0.15, 0.55, 0);
      g.torus(0.2, GOLD, -0.15, 0.42, 0, Math.PI / 2);
      for (const [x, y, z] of [[0.55, -0.55, 0.3], [0.75, -0.35, 0.05], [0.4, -0.25, 0.45]] as const) g.cyl(0.24, 0.24, 0.08, 10, GOLD, x, y, z, 1.2, 0, 0.3);
    },
  },
  flag: {
    medal: M.neutral, rot: [0.1, -0.35, 0],
    build(g) {
      g.cyl(0.06, 0.06, 2, 6, WOOD, -0.45, 0, 0);
      g.ball(0.1, GOLD, -0.45, 1.02, 0);
      g.shape([[0, 0], [1.1, 0], [0.85, -0.35], [1.1, -0.7], [0, -0.7]], 0.08, 0xc62f28, -0.4, 0.95, 0);
      g.box(0.95, 0.08, 0.1, GOLD, 0.1, 0.92, 0.02);
      g.rock(0.35, 0x6d7b52, -0.45, -0.95, 0, 1.4, 0.5, 1);
    },
  },
  // ------------------------------------------------ compétences de Samuel
  sk_samuel_1: {
    medal: M.gold, rot: [0.15, -0.35, 0],
    build(g) {
      // cor de ralliement et ondes sonores
      for (let i = 0; i < 6; i++) {
        const t = i / 5, rad = 0.08 + t * 0.26;
        g.cyl(rad, rad * 0.8, 0.26, 8, i === 5 ? GOLD : i % 2 ? 0xd9a04a : IVORY, -0.75 + t * 1.0, -0.25 + t * 0.4, 0, 0, 0, -1.2);
      }
      for (const r of [0.35, 0.6]) for (let k = -1; k <= 1; k++) {
        const a = 0.35 + k * 0.38;
        g.box(0.1, 0.24, 0.06, 0xfff7e6, 0.45 + Math.cos(a) * r, 0.2 + Math.sin(a) * r, 0, 0, 0, a);
      }
    },
  },
  sk_samuel_2: {
    medal: 0xb7791f, rot: [0.15, -0.3, 0],
    build(g) {
      rays(g, 0, 0.2, 9, 0.6, 1.15, 0xfff3c0, 0, Math.PI * 2);
      g.rock(0.6, 0x7d746b, 0, -0.75, 0, 1.4, 0.45, 0.9);
      sword(g, 0, -0.45, 0, 1.9);
    },
  },
  // ------------------------------------------------ compétences de Patoche (Lyra)
  sk_lyra_1: {
    medal: M.lyra, rot: [0.1, -0.3, 0],
    build(g) {
      for (const [x, y] of [[-0.55, 0.15], [0, 0.4], [0.55, 0.05]] as const) arrow(g, x, y, Math.PI - 0.35, 1.3, GREEN);
      g.box(1.8, 0.12, 0.4, 0x6d7b52, 0, -0.95, 0);
    },
  },
  sk_lyra_2: {
    medal: 0xc2731c, rot: [0.1, -0.3, 0],
    build(g) {
      // soleil levant doré et salve de flèches
      g.cyl(0.6, 0.6, 0.12, 14, 0xffd36b, 0, -0.2, -0.3, Math.PI / 2);
      rays(g, 0, -0.2, 7, 0.72, 1.1, 0xfff0b0, 0.15, Math.PI - 0.15);
      g.box(2.0, 0.5, 0.4, 0x6d7b52, 0, -0.75, -0.1);
      for (const a of [-0.35, 0, 0.35]) arrow(g, Math.sin(-a) * 0.5, -0.1, a, 1.3, 0xffd36b, GOLD);
    },
  },
  // ------------------------------------------------ compétences de Matéo (Brom)
  sk_brom_0: {
    medal: M.brom, rot: [0.15, -0.35, 0],
    build(g) {
      g.box(1.9, 0.25, 0.5, 0x6b5a48, 0, -0.85, 0);
      for (const [x, r] of [[-0.45, 0.6], [0.4, -0.5], [0.05, 0.1]] as const) g.box(0.08, 0.5, 0.52, 0x2a2018, x, -0.85, 0.02, 0, 0, r);
      g.box(0.14, 1.3, 0.14, WOOD, 0.25, 0.05, 0, 0, 0, 0.5);
      g.box(0.95, 0.5, 0.5, 0x8b98a0, -0.1, -0.45, 0, 0, 0, 0.5);
      g.box(0.2, 0.56, 0.54, 0x5b6670, -0.48, -0.65, 0, 0, 0, 0.5);
      for (const [x, y] of [[-0.8, -0.55], [0.75, -0.6], [-0.65, -0.25]] as const) g.rock(0.12, 0x8a7560, x, y, 0.2);
    },
  },
  sk_brom_1: {
    medal: 0x52606d, rot: [0.25, -0.55, 0],
    build(g) {
      g.box(1.1, 0.3, 0.9, 0x6b5a48, 0, -0.7, 0);
      g.cyl(0.42, 0.5, 0.6, 8, 0x9aa7af, 0, -0.25, 0);
      g.cyl(0.4, 0.4, 0.15, 8, 0x5b6670, 0, 0.1, 0);
      g.cyl(0.12, 0.15, 0.9, 8, IRON, 0.5, 0.15, 0, 0, 0, -1.3);
      g.ball(0.12, ORANGE, -0.2, -0.2, 0.42);
      g.box(0.2, 0.25, 0.05, 0x2a3036, 0.2, -0.25, 0.45);
    },
  },
  sk_brom_2: {
    medal: 0xa8321c, rot: [0.2, -0.35, 0],
    build(g) {
      // forge ardente : creuset qui déverse du métal en fusion
      g.box(2.0, 0.18, 0.7, 0x2c2522, 0, -0.95, 0);
      g.cyl(0.85, 0.85, 0.06, 12, ORANGE, 0.1, -0.84, 0);
      g.cyl(0.5, 0.5, 0.08, 10, YEL, 0.1, -0.82, 0.05);
      g.cyl(0.5, 0.35, 0.65, 8, 0x4a4f55, -0.45, 0.45, 0, 0, 0, -0.9);
      g.cyl(0.44, 0.44, 0.06, 8, ORANGE, -0.18, 0.62, 0, 0, 0, -0.9);
      g.box(0.18, 1.2, 0.18, ORANGE, 0.12, -0.15, 0, 0, 0, 0.25);
      g.box(0.08, 1.1, 0.2, YEL, 0.13, -0.15, 0.02, 0, 0, 0.25);
    },
  },
  // ------------------------------------------------ compétences de William (Nox)
  sk_nox_0: {
    medal: M.nox, rot: [0.15, -0.35, 0],
    build(g) {
      // main squelettique qui sort de terre
      g.rock(0.7, 0x5d4037, 0, -0.85, 0, 1.4, 0.4, 1);
      g.box(0.36, 0.45, 0.2, IVORY, 0, -0.25, 0);
      g.box(0.12, 0.5, 0.12, IVORY, 0, -0.65, 0);
      for (const [x, l, r] of [[-0.14, 0.45, 0.15], [-0.04, 0.55, 0.05], [0.06, 0.52, -0.05], [0.16, 0.42, -0.15]] as const) g.box(0.07, l, 0.08, IVORY, x * 1.2, 0.2 + l / 2 - 0.15, 0, 0, 0, r);
      g.box(0.07, 0.35, 0.08, IVORY, -0.28, -0.05, 0, 0, 0, 0.9);
      for (const [x, y] of [[-0.6, 0.35], [0.55, 0.5], [0.45, -0.1]] as const) g.ball(0.08, 0xc4a8ff, x, y, 0.2);
    },
  },
  sk_nox_1: {
    medal: 0x3b1a6b, rot: [0.15, -0.3, 0],
    build(g) {
      drop(g, 0, -0.2, 1.05, 0xd32f2f);
      g.torus(0.8, PURPLE, 0, -0.05, 0, 1.25, 0, 0.3);
      for (const [x, y] of [[-0.85, 0.55], [0.8, -0.45], [0.7, 0.6]] as const) g.ball(0.08, 0xe9d5ff, x, y, 0.2);
    },
  },
  sk_nox_2: {
    medal: 0x3b1a6b, rot: [0.1, -0.3, 0],
    build(g) {
      skull(g, 0, 0.42, 0.62, 0xa855f7);
      skull(g, -0.55, -0.4, 0.58, 0xa855f7);
      skull(g, 0.55, -0.4, 0.58, 0xa855f7);
    },
  },
  // ------------------------------------------------ passifs
  pa_samuel: {
    medal: M.samuel, rot: [0.15, -0.35, 0],
    build(g) {
      g.shape(HEATER, 0.22, 0x2f6fd0, 0, 0, 0);
      g.shape(HEATER.map(([x, y]) => [x * 1.1, y * 1.08] as [number, number]), 0.16, GOLD, 0, 0, -0.06);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 16; k++) { const t = (k / 16) * Math.PI * 2; pts.push([Math.pow(Math.sin(t), 3) * 0.42, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17) * 0.42]); }
      g.shape(pts, 0.18, RED, 0, 0.05, 0.16);
    },
  },
  pa_lyra: {
    medal: M.lyra, rot: [0.1, -0.3, 0],
    build(g) {
      g.ball(0.95, 0xfff7e6, 0, 0, 0, 1, 0.55, 0.35, 1);
      g.cyl(0.42, 0.42, 0.1, 12, 0x3f9d3a, 0, 0, 0.3, Math.PI / 2);
      g.cyl(0.2, 0.2, 0.12, 10, 0x111111, 0, 0, 0.33, Math.PI / 2);
      g.ball(0.08, 0xffffff, -0.12, 0.12, 0.42);
      g.box(1.7, 0.08, 0.1, 0x1f5a16, 0, 0.48, 0.1, 0, 0, 0);
    },
  },
  pa_brom: {
    medal: M.brom, rot: [0.2, -0.45, 0],
    build(g) {
      // enclume
      g.shape([[-1, 0.45], [0.55, 0.45], [0.95, 0.25], [0.5, 0.12], [0.35, -0.05], [-0.55, -0.05], [-0.75, 0.25]], 0.55, 0x6f7a82, 0, 0.1, 0);
      g.box(0.6, 0.45, 0.4, 0x5b6670, -0.1, -0.2, 0);
      g.box(0.95, 0.2, 0.62, 0x5b6670, -0.1, -0.48, 0);
      g.cyl(0.55, 0.6, 0.35, 8, 0x8a5a33, -0.1, -0.78, 0);
    },
  },
  pa_nox: {
    medal: M.nox, rot: [0.1, -0.3, 0],
    build(g) {
      for (const sx of [-1, 1]) g.shape([[0, 0], [0.9, 0.45], [0.8, 0.1], [0.95, -0.15], [0.6, -0.1], [0.5, -0.35], [0.25, -0.15]].map(([x, y]) => [x * sx, y] as [number, number]), 0.08, 0x2a1640, sx * 0.25, 0.1, -0.15);
      drop(g, 0, -0.25, 0.85, 0xd32f2f);
    },
  },
  // ------------------------------------------------ améliorations : archers
  up_mortel: {
    medal: M.arch, rot: [0.1, -0.3, 0],
    build(g) { arrow(g, 0, -0.1, -0.75, 2.0, 0x2a2a2a); skull(g, -0.25, 0.25, 0.55, 0xd32f2f); },
  },
  up_faucon: {
    medal: M.arch, rot: [0.1, -0.3, 0],
    build(g) {
      g.torus(0.75, 0xfff7e6, 0, 0, 0);
      g.torus(0.42, 0xfff7e6, 0, 0, 0);
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; g.box(0.1, 0.45, 0.08, 0xfff7e6, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0, 0, 0, a + Math.PI / 2); }
      g.ball(0.2, 0xd32f2f, 0, 0, 0.1);
    },
  },
  up_poison: {
    medal: M.arch, rot: [0.1, -0.3, 0],
    build(g) { arrow(g, -0.1, 0.1, -0.75, 1.9, GREEN, 0x7cf05a); drop(g, 0.55, -0.4, 0.4, 0x7cf05a); drop(g, 0.25, -0.75, 0.28, 0x5ad13a); },
  },
  up_rafale: {
    medal: M.arch, rot: [0.1, -0.3, 0],
    build(g) { for (const a of [-0.45, 0, 0.45]) arrow(g, Math.sin(-a) * 0.35, -0.2 + Math.cos(a) * 0.1, a, 1.5, 0xcfd8dc); },
  },
  // ------------------------------------------------ améliorations : caserne
  up_bouclier: {
    medal: M.bar, rot: [0.15, -0.35, 0],
    build(g) {
      rays(g, 0, 0, 10, 0.95, 1.3, 0xfff3c0);
      g.shape(HEATER.map(([x, y]) => [x * 0.9, y * 0.9] as [number, number]), 0.22, 0xe0e6ea, 0, 0, 0);
      g.box(0.18, 1.0, 0.06, GOLD, 0, 0, 0.12);
      g.box(0.8, 0.18, 0.06, GOLD, 0, 0.2, 0.12);
    },
  },
  up_provoc: {
    medal: M.bar, rot: [0.1, -0.3, 0],
    build(g) {
      const pts: [number, number][] = [];
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k % 2 ? 0.7 : 1.05; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      g.shape(pts, 0.2, 0xd32f2f, 0, 0, 0);
      g.box(0.24, 0.85, 0.1, 0xfff7e6, 0, 0.15, 0.15);
      g.ball(0.15, 0xfff7e6, 0, -0.5, 0.15);
    },
  },
  up_bond: {
    medal: M.bar, rot: [0.15, -0.35, 0],
    build(g) {
      // botte ailée
      g.box(0.5, 0.9, 0.5, 0x8a5a33, -0.1, 0.05, 0);
      g.box(0.85, 0.35, 0.55, 0x8a5a33, 0.1, -0.5, 0);
      g.box(0.95, 0.1, 0.6, 0x3e2a18, 0.12, -0.72, 0);
      g.box(0.55, 0.12, 0.55, GOLD, -0.1, 0.45, 0);
      for (const [y, l] of [[0.35, 0.8], [0.1, 0.65], [-0.12, 0.5]] as const) g.shape([[0, 0], [-l, 0.25], [-l + 0.1, 0], [0, -0.12]], 0.06, 0xfff7e6, -0.35, y, 0.15);
    },
  },
  up_lames: {
    medal: M.bar, rot: [0.1, -0.3, 0],
    build(g) { sword(g, -0.35, -0.5, 0.6, 1.4); sword(g, 0.35, -0.5, -0.6, 1.4); },
  },
  // ------------------------------------------------ améliorations : mages
  up_desint: {
    medal: M.mag, rot: [0.1, -0.3, 0],
    build(g) {
      g.box(0.5, 2.3, 0.12, 0xc4a8ff, 0, 0, -0.1, 0, 0, -0.75);
      g.box(0.22, 2.3, 0.14, 0xffffff, 0, 0, -0.05, 0, 0, -0.75);
      for (const [x, y] of [[0.6, 0.15], [0.35, 0.65], [0.8, 0.5], [0.55, 0.85]] as const) g.box(0.14, 0.14, 0.14, 0xe9d5ff, x, y, 0.1, 0.5, 0.5, 0.3);
      g.ball(0.28, PURPLE, -0.65, -0.55, 0.1);
    },
  },
  up_teleport: {
    medal: M.mag, rot: [0.1, -0.3, 0],
    build(g) {
      g.cyl(0.62, 0.62, 0.1, 14, 0x12284a, 0, 0, -0.05, Math.PI / 2, 0, 0);
      g.torus(0.65, 0x4fc3f7, 0, 0, 0, 0, 0, 0);
      g.torus(0.45, 0x81d4fa, 0, 0, 0.05, 0, 0, 0.6);
      g.ball(0.16, 0xe1f5fe, 0, 0, 0.1);
      for (const [x, y] of [[-0.95, 0.4], [0.95, -0.3], [0.85, 0.6]] as const) g.ball(0.08, 0xe1f5fe, x, y, 0.1);
    },
  },
  up_blizzard: {
    medal: 0x2a6fb0, rot: [0.1, -0.3, 0],
    build(g) {
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        g.box(0.16, 2.0, 0.14, 0xe1f5fe, 0, 0, 0, 0, 0, a);
        for (const sgn of [-1, 1]) for (const d of [0.55, -0.55]) {
          const cx = -Math.sin(a) * d, cy = Math.cos(a) * d;
          g.box(0.1, 0.38, 0.1, 0xb3e5fc, cx + Math.cos(a) * 0.12 * sgn, cy + Math.sin(a) * 0.12 * sgn, 0.02, 0, 0, a + sgn * 0.8 + (d < 0 ? Math.PI : 0));
        }
      }
      g.ball(0.18, 0xffffff, 0, 0, 0.1);
    },
  },
  up_percant: {
    medal: 0x2a6fb0, rot: [0.15, -0.35, 0],
    build(g) {
      g.shape(HEATER.map(([x, y]) => [x * 0.85, y * 0.85] as [number, number]), 0.2, 0x8b98a0, -0.1, 0, -0.1);
      g.shape([[0, 0.9], [0.12, 0.2], [-0.1, 0.1], [0.08, -0.85], [-0.06, 0.05], [0.15, 0.15]], 0.24, 0x1b2a33, -0.1, 0, 0);
      g.cone(0.18, 1.1, 5, 0xb3e5fc, 0.45, 0.35, 0.2, 0, 0, 2.3);
    },
  },
  // ------------------------------------------------ améliorations : artillerie (et tesla)
  up_napalm: { medal: M.art, rot: [0.1, -0.3, 0], build: (g) => flame(g, 0, -0.75, 1.15) },
  up_frag: {
    medal: M.art, rot: [0.2, -0.35, 0],
    build(g) {
      g.ball(0.7, 0x37414a, -0.1, -0.15, 0, 1, 1, 1, 1);
      g.cyl(0.2, 0.2, 0.25, 8, 0x5b6670, 0.3, 0.45, 0, 0, 0, -0.6);
      g.cyl(0.04, 0.04, 0.4, 4, 0x8a5a33, 0.5, 0.75, 0, 0, 0, -0.9);
      g.ball(0.14, YEL, 0.68, 0.9, 0.05);
      g.ball(0.2, 0x9aa7af, -0.35, 0.15, 0.48, 1, 1, 0.5);
      for (const [x, y] of [[0.75, -0.55], [-0.85, -0.7], [0.9, 0.1]] as const) g.ball(0.13, 0x37414a, x, y, 0.1);
    },
  },
  up_surcharge: { medal: 0x8a6a10, rot: [0.1, -0.3, 0], build: (g) => bolt(g, 0, 0, 1) },
  up_statique: {
    medal: 0x1e5aa8, rot: [0.1, -0.3, 0],
    build(g) {
      g.ball(0.5, 0x4fc3f7, 0, 0, 0, 1, 1, 1, 1);
      g.ball(0.16, 0xe1f5fe, -0.15, 0.16, 0.38);
      for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + 0.3; bolt(g, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.28, 0xfde047); }
    },
  },
  // ------------------------------------------------ ressources (sans médaillon)
  coin: {
    rot: [0.35, -0.45, 0],
    build(g) {
      g.cyl(0.92, 0.92, 0.28, 12, GOLD, 0, 0, 0, Math.PI / 2);
      g.cyl(0.74, 0.74, 0.32, 12, GOLD_D, 0, 0, 0, Math.PI / 2);
      g.cyl(0.68, 0.68, 0.34, 12, GOLD, 0, 0, 0, Math.PI / 2);
      // couronne frappée
      g.box(0.62, 0.18, 0.1, GOLD_D, 0, -0.18, 0.2);
      for (const xx of [-0.24, 0, 0.24]) g.cone(0.09, 0.32, 4, GOLD_D, xx, 0.08, 0.2);
    },
  },
  heart: {
    rot: [0.25, -0.4, 0],
    build(g) {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 16; k++) {
        const t = (k / 16) * Math.PI * 2;
        pts.push([Math.pow(Math.sin(t), 3) * 0.9, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * 0.9]);
      }
      g.shape(pts, 0.45, RED, 0, 0.05, 0);
      // reflet
      g.ball(0.13, 0xff9a8f, -0.38, 0.38, 0.2, 1, 0.7, 0.5);
    },
  },
  // ------------------------------------------------ sorts
  meteor: {
    medal: 0xc2410c,
    rot: [0.15, -0.25, 0],
    build(g) {
      // boule de feu : rocher sombre dans une gerbe de flammes qui file vers le haut à droite
      const tongue = (ang: number, h: number, r: number, c: number, z: number) => {
        const dx = Math.cos(ang), dy = Math.sin(ang);
        g.cone(r, h, 8, c, dx * (h / 2 - 0.05), dy * (h / 2 - 0.05), z, 0, 0, ang - Math.PI / 2);
      };
      const A = Math.PI / 4;
      tongue(A, 1.7, 0.6, 0xe53935, -0.5);
      tongue(A + 0.42, 1.15, 0.36, 0xe53935, -0.42);
      tongue(A - 0.42, 1.15, 0.36, 0xe53935, -0.42);
      tongue(A, 1.35, 0.44, 0xff8f00, -0.3);
      tongue(A + 0.3, 0.9, 0.26, 0xff8f00, -0.25);
      tongue(A - 0.3, 0.9, 0.26, 0xff8f00, -0.25);
      tongue(A, 0.95, 0.26, 0xffd54f, -0.12);
      g.ball(0.62, 0xff8f00, 0, 0, -0.1, 1, 1, 0.8, 1);
      g.rock(0.46, 0x4e342e, -0.04, -0.04, 0.25, 1, 1, 1, 0.3);
      // points de lave sur le rocher
      g.ball(0.1, 0xffd54f, -0.16, 0.1, 0.66);
      g.ball(0.08, 0xffb300, 0.12, -0.14, 0.64);
      g.ball(0.07, 0xffd54f, -0.22, -0.22, 0.58);
    },
  },
  reinforce: {
    medal: 0x1e5aa8,
    rot: [0.12, -0.42, 0],
    zoom: 1.12,
    build(g) {
      // renforts : deux heaumes de miliciens, l'un derrière l'autre, plumets bleu et rouge
      const helm = (x: number, y: number, z: number, k: number, plume: number) => {
        g.cyl(0.5 * k, 0.52 * k, 0.72 * k, 10, STEEL, x, y - 0.05 * k, z);
        g.ball(0.5 * k, STEEL, x, y + 0.3 * k, z, 1, 0.75, 1, 1);
        g.cyl(0.54 * k, 0.54 * k, 0.12 * k, 10, GOLD, x, y - 0.4 * k, z);
        g.box(0.06 * k, 0.95 * k, 0.12 * k, GOLD, x, y + 0.12 * k, z + 0.46 * k);
        g.box(0.72 * k, 0.09 * k, 0.12 * k, 0x1b1b1b, x, y + 0.08 * k, z + 0.46 * k);
        for (const xx of [-0.2, 0.2]) for (const yy of [-0.14, -0.26]) g.box(0.08 * k, 0.05 * k, 0.12 * k, 0x1b1b1b, x + xx * k, y + yy * k, z + 0.47 * k);
        // crinière du cimier, couchée vers l'arrière
        g.ball(0.2 * k, plume, x, y + 0.66 * k, z + 0.12 * k, 0.7, 1, 1);
        g.ball(0.22 * k, plume, x, y + 0.74 * k, z - 0.12 * k, 0.75, 1.1, 1.2);
        g.ball(0.18 * k, plume, x, y + 0.68 * k, z - 0.38 * k, 0.7, 1, 1);
      };
      helm(-0.42, 0.22, -0.5, 0.85, 0x3f7ee0);
      helm(0.3, -0.12, 0.2, 1, RED);
    },
  },
  // ------------------------------------------------ compétences
  sk_samuel_0: {
    medal: 0x334155,
    rot: [0.1, -0.3, 0],
    build(g) {
      const rz = -0.85, dx = -Math.sin(rz), dy = Math.cos(rz), px = -dy, py = dx;
      sword(g, 0.3, 0, rz, 2.0);
      // traînée de vitesse : trois traits dans l'axe de l'élan, derrière le pommeau
      const bx = 0.3 - dx * 0.95, by = 0 - dy * 0.95;
      for (const [k, l] of [[-0.28, 0.55], [0, 0.85], [0.28, 0.55]] as const) {
        g.box(l, 0.07, 0.04, 0xe2e8f0, bx + px * k - dx * l * 0.5, by + py * k - dy * l * 0.5, 0, 0, 0, Math.atan2(dy, dx));
      }
    },
  },
  sk_lyra_0: {
    medal: 0x2f7d32,
    rot: [0.15, -0.55, 0],
    build(g) {
      // cible
      g.cyl(0.78, 0.78, 0.16, 14, 0xfff7e6, 0.1, 0, 0, Math.PI / 2);
      g.cyl(0.58, 0.58, 0.18, 14, RED, 0.1, 0, 0, Math.PI / 2);
      g.cyl(0.38, 0.38, 0.2, 14, 0xfff7e6, 0.1, 0, 0, Math.PI / 2);
      g.cyl(0.18, 0.18, 0.22, 14, RED, 0.1, 0, 0, Math.PI / 2);
      // flèche qui la traverse
      g.box(2.2, 0.08, 0.08, WOOD, 0.05, 0.05, 0.05, 0, 0.5, 0);
      g.cone(0.13, 0.32, 4, STEEL, 1.05, 0.05, -0.5, 0, 0.5, -Math.PI / 2);
      for (const s of [1, -1]) g.shape([[0, 0], [0.42, 0], [0.5, 0.2 * s], [0.12, 0.2 * s]], 0.03, 0x7bd36b, -1.08, 0.05, 0.62, 0, 0.5, 0);
    },
  },
  // ------------------------------------------------ compétences et passifs des classes (cs_<id>, cp_<id>)
  ...CLASS_ICONS3D,
};

let gl: THREE.WebGLRenderer | null = null;

/** Rend les icônes demandées en images (data URL), `size` pixels de côté. */
export function renderIcons3D(keys: string[] = Object.keys(ICONS3D), size = 192): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    gl ??= new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  // le moteur est réutilisé d'un lot à l'autre : on lit toujours son propre canevas
  const canvas = gl.domElement;
  const inner = Math.round(size * 0.86);
  gl.setPixelRatio(1);
  gl.setSize(inner, inner, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4a3a, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-2, 3, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const out2d = document.createElement('canvas');
  out2d.width = out2d.height = size;
  const cx = out2d.getContext('2d')!;
  const sil = document.createElement('canvas');
  sil.width = sil.height = inner;
  const sx = sil.getContext('2d')!;

  for (const key of keys) {
    const def = ICONS3D[key];
    if (!def) continue;
    const g = new GB(7);
    g.jitter = 0.05;
    g.ao = false;
    def.build(g);
    const geo = g.build();
    const mesh = new THREE.Mesh(geo, mat);
    const [rx, ry, rz] = def.rot ?? [0, 0, 0];
    mesh.rotation.set(rx, ry, rz);
    // cadrage : la sphère englobante remplit l'image
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere!;
    mesh.position.set(-bs.center.x, -bs.center.y, -bs.center.z).applyEuler(mesh.rotation);
    const fill = (def.medal ? 0.78 : 0.96) * (def.zoom ?? 1);
    const d = bs.radius / Math.tan(THREE.MathUtils.degToRad(11)) / fill;
    cam.position.set(0, 0, d);
    cam.lookAt(0, 0, 0);
    scene.add(mesh);
    gl.render(scene, cam);
    scene.remove(mesh);
    geo.dispose();

    cx.clearRect(0, 0, size, size);
    const c = size / 2;
    // médaillon : disque teinté, bord sombre, reflet en haut
    if (def.medal !== undefined) {
      const col = new THREE.Color(def.medal);
      const hex = (k: number) => '#' + col.clone().multiplyScalar(k).getHexString();
      const r = size * 0.46;
      cx.fillStyle = 'rgba(0,0,0,0.35)';
      cx.beginPath(); cx.arc(c, c + size * 0.025, r, 0, Math.PI * 2); cx.fill();
      const grd = cx.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r);
      grd.addColorStop(0, '#' + col.clone().lerp(new THREE.Color(0xffffff), 0.25).getHexString());
      grd.addColorStop(1, hex(0.7));
      cx.fillStyle = grd;
      cx.beginPath(); cx.arc(c, c, r, 0, Math.PI * 2); cx.fill();
      cx.lineWidth = size * 0.045;
      cx.strokeStyle = hex(0.42);
      cx.beginPath(); cx.arc(c, c, r - cx.lineWidth / 2, 0, Math.PI * 2); cx.stroke();
      cx.lineWidth = size * 0.02;
      cx.strokeStyle = 'rgba(255,255,255,0.28)';
      cx.beginPath(); cx.arc(c, c, r * 0.8, Math.PI * 1.1, Math.PI * 1.7); cx.stroke();
    }
    // contour sombre : silhouette de l'objet tamponnée autour, puis l'objet
    const off = (size - inner) / 2;
    sx.clearRect(0, 0, inner, inner);
    sx.globalCompositeOperation = 'source-over';
    sx.drawImage(canvas, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = '#14181b';
    sx.fillRect(0, 0, inner, inner);
    sx.globalCompositeOperation = 'source-over';
    const w = size * 0.022;
    cx.globalAlpha = 0.35;
    cx.drawImage(sil, off + w * 0.6, off + w * 1.6);
    cx.globalAlpha = 1;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      cx.drawImage(sil, off + Math.cos(a) * w, off + Math.sin(a) * w);
    }
    cx.drawImage(canvas, off, off);
    out[key] = out2d.toDataURL('image/png');
  }
  mat.dispose();
  return out;
}

/** Libère le contexte WebGL des icônes (une fois toutes générées). */
export function disposeIcons3D() {
  if (!gl) return;
  gl.setSize(1, 1, false);
  gl.dispose();
  gl = null;
}

/** Génère toutes les icônes par petits lots entre deux images (aucun gel de l'écran titre). */
export function renderIcons3DProgressive(onChunk: (icons: Record<string, string>) => void, size = 160, per = 6, onProgress?: (done: number, total: number) => void): Promise<void> {
  const keys = Object.keys(ICONS3D);
  let i = 0;
  return new Promise((done) => {
    const step = () => {
      const chunk = keys.slice(i, i + per);
      i += per;
      onChunk(renderIcons3D(chunk, size));
      onProgress?.(Math.min(i, keys.length), keys.length);
      if (i < keys.length) setTimeout(step, 16);
      else {
        disposeIcons3D();
        done();
      }
    };
    setTimeout(step, 30);
  });
}
