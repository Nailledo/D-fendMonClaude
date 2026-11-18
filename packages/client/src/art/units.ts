import type * as THREE from 'three';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { GB, Part } from './builder';

const SKIN = 0xf2c9a0;

function body(g: GB, o: { legs: number; torso: number; arms: number; head?: number; w?: number; h?: number; scale?: number }) {
  const w = o.w ?? 0.4;
  const hip = 0.45;
  g.setPart(Part.LegL, 0.1, hip, 0).box(0.15, hip, 0.17, o.legs, 0.1, hip / 2, 0);
  g.setPart(Part.LegR, -0.1, hip, 0).box(0.15, hip, 0.17, o.legs, -0.1, hip / 2, 0);
  g.setPart(Part.Body);
  g.box(w, 0.46, 0.28, o.torso, 0, 0.68, 0);
  g.setPart(Part.ArmL, w / 2 + 0.07, 0.88, 0).box(0.12, 0.42, 0.13, o.arms, w / 2 + 0.07, 0.68, 0);
  g.setPart(Part.ArmR, -w / 2 - 0.07, 0.88, 0).box(0.12, 0.42, 0.13, o.arms, -w / 2 - 0.07, 0.68, 0);
  g.setPart(Part.Body);
  g.box(0.3, 0.3, 0.28, o.head ?? SKIN, 0, 1.07, 0.01);
  g.ball(0.035, 0x2b1d14, 0.07, 1.09, 0.16);
  g.ball(0.035, 0x2b1d14, -0.07, 1.09, 0.16);
}

function inRight(g: GB, w: number, fn: () => void) {
  g.setPart(Part.ArmR, -w / 2 - 0.07, 0.88, 0);
  fn();
  g.setPart(Part.Body);
}
function inLeft(g: GB, w: number, fn: () => void) {
  g.setPart(Part.ArmL, w / 2 + 0.07, 0.88, 0);
  fn();
  g.setPart(Part.Body);
}

function sword(g: GB, x: number, y: number, color = 0xdfe6ea, len = 0.7) {
  g.box(0.05, 0.05, 0.2, 0x5d4037, x, y, 0.06);
  g.box(0.22, 0.04, 0.05, 0xc9a227, x, y, 0.16);
  g.box(0.07, 0.03, len, color, x, y, 0.18 + len / 2);
}

function cape(g: GB, w = 0.42, h = 0.7) {
  g.setPart(Part.Team).box(w, h, 0.04, 0xffffff, 0, 0.92 - h / 2 + 0.05, -0.17, -0.1);
  g.setPart(Part.Body);
}

export const HERO_MODELS: Record<string, (g: GB) => void> = {
  samuel(g) {
    const steel = 0xb8c4cf;
    body(g, { legs: 0x5a6672, torso: steel, arms: steel, w: 0.44 });
    g.setPart(Part.Team).box(0.3, 0.4, 0.04, 0xffffff, 0, 0.66, 0.15);
    g.setPart(Part.Body);
    g.box(0.12, 0.12, 0.05, 0xffd54f, 0, 0.74, 0.18);
    cape(g, 0.46, 0.75);
    g.box(0.34, 0.14, 0.32, 0x8a5a2b, 0, 1.24, -0.02);
    g.box(0.36, 0.06, 0.06, 0x8a5a2b, 0, 1.18, 0.14);
    inRight(g, 0.44, () => sword(g, -0.29, 0.5, 0xe8eef2, 0.85));
    inLeft(g, 0.44, () => {
      g.box(0.08, 0.5, 0.42, 0x1e3a8a, 0.36, 0.62, 0.08);
      g.box(0.09, 0.14, 0.14, 0xffd54f, 0.4, 0.66, 0.1);
    });
    g.box(0.08, 0.12, 0.05, 0xff8a65, 0.16, 1.24, 0.12);
  },
  lyra(g) {
    const leaf = 0x2e7d32;
    body(g, { legs: 0x4e342e, torso: leaf, arms: 0x388e3c, w: 0.38 });
    cape(g, 0.4, 0.8);
    g.setPart(Part.Team).cone(0.24, 0.42, 5, 0xffffff, 0, 1.3, -0.04, -0.2);
    g.setPart(Part.Body);
    g.box(0.32, 0.12, 0.3, 0xffb74d, 0, 1.2, -0.06);
    g.box(0.06, 0.5, 0.05, 0xffb74d, 0.08, 0.95, -0.17);
    inLeft(g, 0.38, () => {
      g.shape([[0, -0.6], [0.08, -0.6], [0.2, 0], [0.08, 0.6], [0, 0.6], [0.12, 0]], 0.04, 0x8d6e63, 0.3, 0.5, 0.18, 0, Math.PI / 2, 0);
      g.box(0.01, 1.15, 0.01, 0xeeeeee, 0.26, 0.5, 0.2);
    });
    g.box(0.12, 0.45, 0.12, 0x6d4c41, -0.12, 0.85, -0.2, 0.3);
    for (let k = 0; k < 3; k++) g.box(0.03, 0.18, 0.03, 0xe53935, -0.1 + k * 0.04, 1.12, -0.28, 0.3);
  },
  brom(g) {
    const s = 0.9;
    g.setPart(Part.LegL, 0.13, 0.32, 0).box(0.2, 0.32, 0.22, 0x5d4037, 0.13, 0.16, 0);
    g.setPart(Part.LegR, -0.13, 0.32, 0).box(0.2, 0.32, 0.22, 0x5d4037, -0.13, 0.16, 0);
    g.setPart(Part.Body);
    g.box(0.58 * s, 0.5, 0.42, 0x8d6e63, 0, 0.56, 0);
    g.box(0.6, 0.12, 0.44, 0x3e2723, 0, 0.38, 0);
    g.setPart(Part.Team).box(0.5, 0.36, 0.04, 0xffffff, 0, 0.56, 0.22);
    g.setPart(Part.Body);
    g.setPart(Part.ArmL, 0.36, 0.76, 0).box(0.17, 0.42, 0.18, SKIN, 0.36, 0.56, 0);
    g.setPart(Part.ArmR, -0.36, 0.76, 0).box(0.17, 0.42, 0.18, SKIN, -0.36, 0.56, 0);
    g.cyl(0.04, 0.04, 0.85, 5, 0x5d4037, -0.36, 0.38, 0.25, Math.PI / 2.4);
    g.box(0.38, 0.26, 0.26, 0x78909c, -0.36, 0.62, 0.62);
    g.setPart(Part.Body);
    g.box(0.34, 0.3, 0.3, SKIN, 0, 0.95, 0.02);
    g.box(0.38, 0.36, 0.14, 0xd84315, 0, 0.78, 0.15);
    g.cone(0.17, 0.3, 5, 0xd84315, 0, 0.55, 0.17, Math.PI);
    g.box(0.38, 0.12, 0.34, 0x90a4ae, 0, 1.13, 0);
    g.cone(0.05, 0.18, 4, 0xeeeeee, 0.2, 1.22, 0, 0, 0, -1);
    g.cone(0.05, 0.18, 4, 0xeeeeee, -0.2, 1.22, 0, 0, 0, 1);
    g.ball(0.035, 0x2b1d14, 0.07, 0.99, 0.17);
    g.ball(0.035, 0x2b1d14, -0.07, 0.99, 0.17);
  },
  nox(g) {
    const robe = 0x4a148c;
    g.cone(0.36, 0.95, 7, robe, 0, 0.48, 0);
    g.setPart(Part.LegL, 0.08, 0.2, 0).box(0.1, 0.2, 0.1, 0x1a0f22, 0.08, 0.1, 0);
    g.setPart(Part.LegR, -0.08, 0.2, 0).box(0.1, 0.2, 0.1, 0x1a0f22, -0.08, 0.1, 0);
    g.setPart(Part.Body);
    g.box(0.36, 0.3, 0.26, robe, 0, 0.88, 0);
    g.setPart(Part.ArmL, 0.24, 0.98, 0).box(0.12, 0.4, 0.13, 0x6a1b9a, 0.24, 0.78, 0);
    g.setPart(Part.ArmR, -0.24, 0.98, 0).box(0.12, 0.4, 0.13, 0x6a1b9a, -0.24, 0.78, 0);
    g.cyl(0.03, 0.03, 1.3, 5, 0x37474f, -0.24, 0.85, 0.12);
    g.ball(0.12, 0xeeeeee, -0.24, 1.5, 0.12);
    g.ball(0.04, 0x76ff03, -0.21, 1.52, 0.22);
    g.ball(0.04, 0x76ff03, -0.27, 1.52, 0.22);
    g.setPart(Part.Body);
    g.box(0.28, 0.3, 0.26, 0xe0d4f0, 0, 1.18, 0.02);
    g.setPart(Part.Team).cone(0.26, 0.5, 6, 0xffffff, 0, 1.35, -0.05, -0.15);
    g.setPart(Part.Body);
    g.box(0.32, 0.1, 0.06, 0x1a0f22, 0, 1.3, 0.13);
    g.ball(0.035, 0x76ff03, 0.06, 1.2, 0.15);
    g.ball(0.035, 0x76ff03, -0.06, 1.2, 0.15);
    g.box(0.26, 0.6, 0.04, 0xe0d4f0, 0, 0.75, -0.2);
  },
};

// Personnages de l'histoire (portraits uniquement)
HERO_MODELS.ethan = (g) => {
  g.cone(0.5, 1.0, 9, 0xec4899, 0, 0.5, 0);
  g.cone(0.42, 0.5, 9, 0xf9a8d4, 0, 0.35, 0.02);
  g.box(0.34, 0.32, 0.24, 0xec4899, 0, 1.0, 0);
  g.setPart(Part.ArmL, 0.24, 1.1, 0).box(0.1, 0.38, 0.11, SKIN, 0.24, 0.92, 0);
  g.setPart(Part.ArmR, -0.24, 1.1, 0).box(0.1, 0.38, 0.11, SKIN, -0.24, 0.92, 0);
  g.setPart(Part.Body);
  g.box(0.28, 0.3, 0.27, SKIN, 0, 1.3, 0.01);
  g.box(0.34, 0.2, 0.3, 0xf59e0b, 0, 1.43, -0.03);
  g.box(0.32, 0.5, 0.1, 0xf59e0b, 0, 1.2, -0.15);
  g.cyl(0.13, 0.15, 0.1, 6, 0xffd700, 0, 1.58, 0);
  for (let k = 0; k < 5; k++) g.cone(0.03, 0.1, 4, 0xffd700, Math.cos(k * 1.26) * 0.12, 1.67, Math.sin(k * 1.26) * 0.12);
  g.ball(0.035, 0x2b1d14, 0.07, 1.32, 0.15);
  g.ball(0.035, 0x2b1d14, -0.07, 1.32, 0.15);
  g.ball(0.04, 0x60a5fa, 0, 1.58, 0.13);
};
HERO_MODELS.roi = (g) => {
  g.cone(0.48, 1.0, 8, 0xb91c1c, 0, 0.5, 0);
  g.box(0.5, 0.36, 0.34, 0xb91c1c, 0, 1.0, 0);
  g.box(0.52, 0.1, 0.36, 0xfafafa, 0, 1.2, 0);
  g.setPart(Part.ArmL, 0.3, 1.15, 0).box(0.13, 0.4, 0.14, 0xb91c1c, 0.3, 0.95, 0);
  g.setPart(Part.ArmR, -0.3, 1.15, 0).box(0.13, 0.4, 0.14, 0xb91c1c, -0.3, 0.95, 0);
  g.setPart(Part.Body);
  g.box(0.3, 0.3, 0.28, SKIN, 0, 1.38, 0.01);
  g.box(0.32, 0.26, 0.12, 0xeeeeee, 0, 1.24, 0.12);
  g.cyl(0.17, 0.19, 0.14, 7, 0xffd700, 0, 1.6, 0);
  for (let k = 0; k < 6; k++) g.cone(0.04, 0.14, 4, 0xffd700, Math.cos(k * 1.05) * 0.16, 1.72, Math.sin(k * 1.05) * 0.16);
  g.ball(0.035, 0x2b1d14, 0.07, 1.42, 0.15);
  g.ball(0.035, 0x2b1d14, -0.07, 1.42, 0.15);
};

export const SOLDIER_MODELS: ((g: GB) => void)[] = [
  // 0 Milicien
  (g) => {
    body(g, { legs: 0x5d4037, torso: 0x8d6e63, arms: 0x8d6e63 });
    g.setPart(Part.Team).box(0.42, 0.1, 0.3, 0xffffff, 0, 0.5, 0);
    g.setPart(Part.Body);
    g.box(0.32, 0.1, 0.3, 0x6d4c41, 0, 1.24, 0);
    inRight(g, 0.4, () => {
      g.cyl(0.025, 0.025, 1.3, 4, 0x8d6e63, -0.27, 0.6, 0.1, Math.PI / 2.5);
      g.cone(0.05, 0.16, 4, 0xcfd8dc, -0.27, 0.86, 0.66, Math.PI / 2.5);
    });
  },
  // 1 Soldat
  (g) => {
    body(g, { legs: 0x546e7a, torso: 0x90a4ae, arms: 0x78909c });
    g.setPart(Part.Team).box(0.3, 0.3, 0.04, 0xffffff, 0, 0.66, 0.15);
    g.setPart(Part.Body);
    g.cyl(0.18, 0.2, 0.16, 7, 0x90a4ae, 0, 1.26, 0);
    inRight(g, 0.4, () => sword(g, -0.27, 0.48));
    inLeft(g, 0.4, () => g.cyl(0.24, 0.24, 0.06, 8, 0x8d6e63, 0.33, 0.62, 0.1, 0, 0, Math.PI / 2));
  },
  // 2 Chevalier
  (g) => {
    body(g, { legs: 0x78909c, torso: 0xcfd8dc, arms: 0xb0bec5, head: 0xb0bec5 });
    g.setPart(Part.Team).box(0.3, 0.32, 0.04, 0xffffff, 0, 0.66, 0.15);
    g.box(0.06, 0.25, 0.25, 0xffffff, 0, 1.33, -0.05);
    g.setPart(Part.Body);
    g.box(0.22, 0.04, 0.03, 0x263238, 0, 1.09, 0.15);
    inRight(g, 0.4, () => sword(g, -0.27, 0.48, 0xeceff1, 0.8));
    inLeft(g, 0.4, () => g.box(0.06, 0.48, 0.36, 0x37474f, 0.33, 0.62, 0.1));
  },
  // 3 Garde royal
  (g) => {
    body(g, { legs: 0x8d6e00, torso: 0xffc107, arms: 0xe0a800, head: 0xe0a800, w: 0.46 });
    g.setPart(Part.Team).box(0.46, 0.7, 0.04, 0xffffff, 0, 0.6, -0.17, -0.1);
    g.setPart(Part.Body);
    g.cone(0.2, 0.25, 6, 0xffd54f, 0, 1.33, 0);
    g.box(0.22, 0.04, 0.03, 0x263238, 0, 1.09, 0.15);
    inRight(g, 0.46, () => g.cyl(0.03, 0.03, 1.6, 4, 0x6d4c41, -0.3, 0.8, 0.12));
    inLeft(g, 0.46, () => {
      g.box(0.07, 0.7, 0.48, 0xffb300, 0.36, 0.62, 0.1);
      g.box(0.08, 0.18, 0.18, 0xd32f2f, 0.4, 0.66, 0.1);
    });
  },
  // 4 Rôdeur
  (g) => {
    body(g, { legs: 0x33691e, torso: 0x2e4a2a, arms: 0x3e5a36 });
    g.setPart(Part.Team).cone(0.22, 0.38, 5, 0xffffff, 0, 1.28, -0.03, -0.2);
    g.setPart(Part.Body);
    inRight(g, 0.4, () => sword(g, -0.27, 0.48, 0xb0bec5, 0.5));
    inLeft(g, 0.4, () => sword(g, 0.27, 0.48, 0xb0bec5, 0.5));
  },
  // 5 Renfort
  (g) => {
    body(g, { legs: 0x6d4c41, torso: 0xa1887f, arms: 0xa1887f });
    g.setPart(Part.Team).box(0.42, 0.46, 0.04, 0xffffff, 0, 0.68, 0.15);
    g.setPart(Part.Body);
    g.cyl(0.17, 0.2, 0.14, 6, 0x8d6e63, 0, 1.25, 0);
    inRight(g, 0.4, () => sword(g, -0.27, 0.48, 0xbdbdbd, 0.55));
  },
  // 6 Squelette
  (g) => {
    const bone = 0xeae6d8;
    g.setPart(Part.LegL, 0.1, 0.45, 0).box(0.07, 0.45, 0.07, bone, 0.1, 0.22, 0);
    g.setPart(Part.LegR, -0.1, 0.45, 0).box(0.07, 0.45, 0.07, bone, -0.1, 0.22, 0);
    g.setPart(Part.Body);
    g.box(0.06, 0.45, 0.06, bone, 0, 0.68, 0);
    for (let k = 0; k < 3; k++) g.box(0.32, 0.04, 0.2, bone, 0, 0.6 + k * 0.1, 0);
    g.setPart(Part.ArmL, 0.2, 0.86, 0).box(0.06, 0.42, 0.06, bone, 0.2, 0.66, 0);
    g.setPart(Part.ArmR, -0.2, 0.86, 0).box(0.06, 0.42, 0.06, bone, -0.2, 0.66, 0);
    sword(g, -0.2, 0.46, 0x9e9e9e, 0.5);
    g.setPart(Part.Body);
    g.box(0.28, 0.28, 0.28, bone, 0, 1.05, 0);
    g.ball(0.05, 0x76ff03, 0.07, 1.07, 0.14);
    g.ball(0.05, 0x76ff03, -0.07, 1.07, 0.14);
    g.setPart(Part.Team).box(0.3, 0.06, 0.3, 0xffffff, 0, 0.47, 0);
  },
  // 7 Tourelle de Matéo (modèle complet : corps qui tombe, portraits ; en jeu, socle et tête sont séparés)
  (g) => {
    turretBase(g);
    turretHead(g);
  },
];

/** hauteur du pivot de la tête de la tourelle (au-dessus du socle) */
const TURRET_HEAD_Y = 0.46;

/** Socle de la tourelle de forge : trépied de bois cerclé de fer sur une dalle de pierre. */
function turretBase(g: GB) {
  g.cyl(0.48, 0.55, 0.14, 8, 0x6b6359, 0, 0.07, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    g.box(0.09, 0.42, 0.09, 0x6d4c41, Math.cos(a) * 0.26, 0.3, Math.sin(a) * 0.26, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
  }
  g.cyl(0.2, 0.24, 0.3, 8, 0x4e342e, 0, 0.3, 0);
  g.setPart(Part.Team).cyl(0.26, 0.26, 0.06, 8, 0xffffff, 0, 0.43, 0);
  g.setPart(Part.Body);
}

/** Tête orientable : chaudière de cuivre, foyer rougeoyant à l'arrière, canon vers l'avant (+z). */
function turretHead(g: GB, y = TURRET_HEAD_Y) {
  g.cyl(0.22, 0.24, 0.12, 8, 0x37474f, 0, y + 0.06, 0);
  g.box(0.42, 0.3, 0.46, 0xb87333, 0, y + 0.27, -0.02);
  g.box(0.46, 0.06, 0.5, 0x5d4037, 0, y + 0.44, -0.02);
  g.box(0.3, 0.16, 0.06, 0xff7043, 0, y + 0.25, -0.26);
  g.box(0.36, 0.04, 0.07, 0x3e2723, 0, y + 0.35, -0.26);
  g.cyl(0.07, 0.08, 0.28, 6, 0x455a64, 0.12, y + 0.56, -0.12);
  g.cyl(0.09, 0.11, 0.62, 8, 0x455a64, 0, y + 0.28, 0.48, Math.PI / 2);
  g.torus(0.11, 0xffc107, 0, y + 0.28, 0.76, 0);
  for (const sx of [-1, 1]) g.ball(0.05, 0xffc107, sx * 0.22, y + 0.27, 0.12);
}

/**
 * Tourelle en deux pièces : socle fixe et tête qui pivote autour de l'axe vertical (origine).
 * Modèle importé : la cuisson l'avait découpé comme un personnage (jambes, bras), d'où une tourelle qui
 * « marchait ». On le sépare ici : triangles des « jambes » → socle, le reste → tête, sans partie animée.
 */
export function turretGeometry(glb?: THREE.BufferGeometry): { base: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  if (glb?.index) {
    const anim = glb.getAttribute('aAnim');
    const idx = glb.index.array;
    const base: number[] = [], head: number[] = [];
    for (let t = 0; t < idx.length; t += 3) {
      const part = Math.round(anim.getX(idx[t]));
      (part === 1 || part === 2 ? base : head).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    const n = glb.attributes.position.count;
    const still = new Float32BufferAttribute(new Float32Array(n * 4), 4);
    const one = new Float32BufferAttribute(new Float32Array(n).fill(1), 1);
    const make = (list: number[]) => {
      const g = new BufferGeometry();
      for (const [k, a] of Object.entries(glb.attributes)) g.setAttribute(k, a);
      g.setAttribute('aAnim', still);
      g.setAttribute('aWeight', one);
      g.setIndex(list);
      g.computeBoundingSphere();
      return g;
    };
    if (base.length && head.length) return { base: make(base), head: make(head) };
  }
  let g = cache.get('turret');
  if (!g) {
    const b = new GB(71);
    turretBase(b);
    g = b.build();
    cache.set('turret', g);
  }
  let h = cache.get('turretHead');
  if (!h) {
    const b = new GB(73);
    turretHead(b);
    h = b.build();
    cache.set('turretHead', h);
  }
  return { base: g, head: h };
}

const cache = new Map<string, THREE.BufferGeometry>();

/** Personnages composés (modèles importés) : art en code de leur personnage d'origine, au cas où le modèle manque. */
const FALLBACK: Record<string, string> = { ombre: 'lyra', paladin: 'samuel', druide: 'lyra', ours: 'brom', brasier: 'nox' };

export function heroGeometry(id: string): THREE.BufferGeometry {
  const key = 'h' + id;
  let g = cache.get(key);
  if (!g) {
    const b = new GB(id.length * 31 + 7);
    (HERO_MODELS[id] ?? HERO_MODELS[FALLBACK[id]] ?? HERO_MODELS.samuel)(b);
    g = b.build();
    cache.set(key, g);
  }
  return g;
}

export function soldierGeometry(kind: number): THREE.BufferGeometry {
  const key = 's' + kind;
  let g = cache.get(key);
  if (!g) {
    const b = new GB(kind * 13 + 3);
    (SOLDIER_MODELS[kind] ?? SOLDIER_MODELS[0])(b);
    g = b.build();
    cache.set(key, g);
  }
  return g;
}
