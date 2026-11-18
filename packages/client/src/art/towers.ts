import type * as THREE from 'three';
import { GB, Part } from './builder';

export interface TowerModel {
  base: THREE.BufferGeometry;
  turret: THREE.BufferGeometry | null;
  turretY: number;
  /** hauteur d'origine des projectiles */
  muzzleY: number;
}

const STONE = 0xa39d92;
const STONE_D = 0x7d776d;
const WOOD = 0x8a5a33;
const WOOD_D = 0x5e3d22;

function plinth(g: GB, r = 1.05) {
  g.cyl(r, r + 0.12, 0.28, 8, STONE_D, 0, 0.14, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    g.rock(0.18, 0x8b857a, Math.cos(a) * (r + 0.05), 0.12, Math.sin(a) * (r + 0.05), 1, 0.6, 1, a);
  }
}

function banner(g: GB, x: number, y: number, z: number, h = 0.5) {
  g.cyl(0.025, 0.025, h + 0.5, 4, WOOD_D, x, y + (h + 0.5) / 2, z);
  g.setPart(Part.Team).box(0.05, h * 0.7, 0.36, 0xffffff, x, y + h + 0.1, z + 0.2);
  g.setPart(Part.Body);
}

function crenels(g: GB, r: number, y: number, n: number, c = STONE) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    g.box(0.22, 0.22, 0.22, c, Math.cos(a) * r, y, Math.sin(a) * r, 0, -a, 0);
  }
}

function archerFig(g: GB, x: number, z: number, y: number, hood = 0x2e7d32) {
  g.box(0.22, 0.3, 0.18, hood, x, y + 0.15, z);
  g.box(0.18, 0.18, 0.18, 0xf2c9a0, x, y + 0.4, z);
  g.cone(0.14, 0.22, 5, hood, x, y + 0.56, z - 0.02);
  g.shape([[0, -0.3], [0.05, -0.3], [0.12, 0], [0.05, 0.3], [0, 0.3], [0.07, 0]], 0.03, WOOD_D, x + 0.12, y + 0.25, z + 0.18, 0, Math.PI / 2, 0);
}

function archer(level: number): TowerModel {
  const g = new GB(101 + level);
  plinth(g);
  let top = 0;
  if (level === 0) {
    for (const [x, z] of [[0.55, 0.55], [-0.55, 0.55], [0.55, -0.55], [-0.55, -0.55]]) g.box(0.16, 1.6, 0.16, WOOD, x, 1.0, z);
    g.box(1.2, 0.08, 0.08, WOOD_D, 0, 0.9, 0.55, 0, 0, 0.6);
    g.box(1.2, 0.08, 0.08, WOOD_D, 0, 0.9, -0.55, 0, 0, -0.6);
    g.box(1.5, 0.14, 1.5, WOOD, 0, 1.8, 0);
    g.box(1.5, 0.3, 0.08, WOOD_D, 0, 2.0, 0.72);
    g.box(1.5, 0.3, 0.08, WOOD_D, 0, 2.0, -0.72);
    g.box(0.08, 0.3, 1.5, WOOD_D, 0.72, 2.0, 0);
    g.box(0.08, 0.3, 1.5, WOOD_D, -0.72, 2.0, 0);
    top = 1.87;
    banner(g, 0.68, 1.9, -0.68, 0.4);
  } else if (level === 1) {
    g.cyl(0.75, 0.85, 1.6, 8, STONE, 0, 1.08, 0);
    g.box(1.7, 0.16, 1.7, WOOD, 0, 1.95, 0);
    for (const [x, z] of [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]]) g.box(0.12, 0.9, 0.12, WOOD_D, x, 2.4, z);
    g.cone(1.35, 0.8, 4, 0x2e7d32, 0, 3.2, 0, 0, Math.PI / 4);
    top = 2.03;
    banner(g, 0, 3.4, 0, 0.4);
  } else if (level === 2) {
    g.cyl(0.85, 0.95, 2.2, 8, STONE, 0, 1.38, 0);
    g.cyl(1.0, 0.9, 0.25, 8, STONE_D, 0, 2.55, 0);
    crenels(g, 0.92, 2.78, 8);
    g.box(0.2, 0.4, 0.06, 0x3e2723, 0, 1.6, 0.9);
    top = 2.68;
    banner(g, 0.75, 2.7, -0.4, 0.6);
    banner(g, -0.75, 2.7, -0.4, 0.6);
  } else if (level === 3) {
    g.cyl(0.6, 0.95, 3.2, 8, STONE, 0, 1.85, 0);
    g.cyl(0.95, 0.65, 0.3, 8, STONE_D, 0, 3.55, 0);
    crenels(g, 0.88, 3.8, 8);
    g.cone(0.4, 1.4, 6, 0x1b5e20, 0, 4.8, 0);
    for (const y of [1.2, 2.2]) g.box(0.12, 0.35, 0.05, 0x3e2723, 0, y, 0.75);
    top = 3.7;
    banner(g, 0, 5.4, 0, 0.5);
  } else {
    g.box(1.8, 1.2, 1.8, STONE, 0, 0.88, 0);
    g.box(2.0, 0.2, 2.0, STONE_D, 0, 1.55, 0);
    for (const [x, z] of [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]]) g.box(0.35, 0.5, 0.35, STONE, x, 1.85, z);
    top = 1.65;
    banner(g, 0.85, 2.1, -0.85, 0.5);
  }
  const t = new GB(201 + level);
  if (level === 4) {
    t.box(0.5, 0.3, 0.5, WOOD, 0, 0.15, 0);
    t.box(0.12, 0.12, 1.2, WOOD_D, 0, 0.35, 0.2);
    t.shape([[-0.7, 0], [0.7, 0], [0.6, 0.12], [-0.6, 0.12]], 0.08, WOOD, 0, 0.35, 0.65, Math.PI / 2, 0, 0);
    archerFig(t, 0.45, -0.2, 0, 0x6d4c41);
    archerFig(t, -0.45, -0.2, 0, 0x6d4c41);
  } else {
    const hood = level === 3 ? 0x1b5e20 : 0x388e3c;
    if (level === 3) archerFig(t, 0, 0, 0, hood);
    else {
      archerFig(t, 0.3, 0, 0, hood);
      archerFig(t, -0.3, 0, 0, hood);
    }
  }
  return { base: g.build(), turret: t.build(), turretY: top, muzzleY: top + 0.45 };
}

function barracks(level: number): TowerModel {
  const g = new GB(301 + level);
  plinth(g, 1.15);
  const wall = level === 0 ? WOOD : level === 3 ? 0xe8dcc0 : level === 4 ? 0x5d4a33 : STONE;
  const roof = level === 3 ? 0x1e40af : level === 4 ? 0x2e5d32 : level === 0 ? 0x8d5b2a : 0xb23a2a;
  g.box(1.8, 1.1, 1.4, wall, 0, 0.83, 0);
  g.roof(2.0, 0.8, 1.6, roof, 0, 1.38, 0);
  g.box(0.4, 0.65, 0.06, 0x3e2723, 0, 0.62, 0.71);
  g.box(0.25, 0.2, 0.06, 0x3e2723, 0.6, 0.95, 0.71);
  g.box(0.25, 0.2, 0.06, 0x3e2723, -0.6, 0.95, 0.71);
  if (level >= 1) {
    g.cyl(0.35, 0.38, 1.9, 7, level === 4 ? WOOD : STONE, 0.95, 1.2, -0.5);
    g.cone(0.48, 0.7, 7, roof, 0.95, 2.5, -0.5);
  }
  if (level >= 2) {
    g.cyl(0.35, 0.38, 1.9, 7, level === 4 ? WOOD : STONE, -0.95, 1.2, -0.5);
    g.cone(0.48, 0.7, 7, roof, -0.95, 2.5, -0.5);
  }
  if (level === 3) {
    g.ball(0.2, 0xffc107, 0, 2.3, 0);
    g.box(0.5, 0.5, 0.06, 0xffc107, 0, 1.6, 0.81);
  }
  if (level === 4) {
    g.box(0.06, 0.6, 0.06, WOOD_D, 0.4, 2.0, 0.2, 0.4);
    g.rock(0.25, 0x6d4c41, 0, 2.15, 0, 1.2, 0.5, 0.9);
  }
  banner(g, 0, 2.15, 0, 0.5);
  return { base: g.build(), turret: null, turretY: 0, muzzleY: 1.5 };
}

function mage(level: number): TowerModel {
  const g = new GB(401 + level);
  plinth(g);
  const roof = level === 4 ? 0x4fc3f7 : level === 3 ? 0x6a1b9a : 0x7b3fb0;
  const wall = level === 4 ? 0xcfe8f3 : level === 3 ? 0x5c4a73 : STONE;
  const h = 1.5 + level * 0.4;
  let crystal = 0xd500f9;
  if (level === 4) {
    crystal = 0x80deea;
    g.cyl(0.6, 0.85, h, 6, wall, 0, 0.28 + h / 2, 0);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.cone(0.18, 1.2, 5, 0xb3e5fc, Math.cos(a) * 0.75, 0.9, Math.sin(a) * 0.75, Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    }
    g.cone(0.5, 1.2, 6, roof, 0, h + 0.85, 0);
  } else {
    g.cyl(0.65 - level * 0.03, 0.85, h, 8, wall, 0, 0.28 + h / 2, 0);
    g.cyl(0.85, 0.75, 0.2, 8, STONE_D, 0, h + 0.35, 0);
    g.cone(0.85, 1.1 + level * 0.25, 8, roof, 0, h + 0.95 + level * 0.12, 0);
    g.box(0.18, 0.5, 0.06, 0x311b92, 0, h * 0.6, 0.7);
    if (level === 3) {
      g.setPart(Part.Spin, 0, h + 2.4, 0).torus(0.55, 0xffd54f, 0, h + 2.4, 0, Math.PI / 2);
      g.setPart(Part.Body);
    }
  }
  banner(g, 0.7, 0.6, 0.4, 0.4);
  g.setPart(Part.Spin, 0, h + 2.3, 0);
  g.ball(0.26 + level * 0.03, crystal, 0, h + 2.3, 0, 0.8, 1.4, 0.8);
  g.setPart(Part.Body);
  return { base: g.build(), turret: null, turretY: 0, muzzleY: h + 2.3 };
}

function artillery(level: number): TowerModel {
  const g = new GB(501 + level);
  plinth(g, 1.15);
  const metal = 0x546e7a;
  if (level === 4) {
    g.cyl(0.7, 0.95, 1.4, 8, 0x6d4c41, 0, 0.98, 0);
    g.cyl(0.25, 0.3, 1.8, 8, 0xb87333, 0, 2.5, 0);
    for (let k = 0; k < 4; k++) g.torus(0.38 - k * 0.04, 0xd4a017, 0, 1.9 + k * 0.38, 0, Math.PI / 2);
    g.setPart(Part.Spin, 0, 3.7, 0).ball(0.4, 0x80d8ff, 0, 3.7, 0);
    g.setPart(Part.Body);
    banner(g, 0.8, 1.2, -0.6, 0.4);
    return { base: g.build(), turret: null, turretY: 0, muzzleY: 3.7 };
  }
  const h = 0.9 + level * 0.15;
  g.cyl(1.0, 1.1, h, 8, level === 3 ? 0x4e342e : 0x8d6e63, 0, 0.28 + h / 2, 0);
  g.cyl(1.1, 1.0, 0.18, 8, STONE_D, 0, 0.3 + h, 0);
  for (let k = 0; k < 3; k++) g.ball(0.18, 0x37474f, 0.7 * Math.cos(k * 0.7 + 2), h + 0.5, 0.7 * Math.sin(k * 0.7 + 2));
  banner(g, -0.85, h + 0.3, -0.45, 0.4);
  const t = new GB(601 + level);
  t.box(0.9, 0.3, 0.7, WOOD, 0, 0.15, 0);
  t.cyl(0.12, 0.12, 0.8, 6, 0x5d4037, 0.42, 0.25, 0, 0, 0, Math.PI / 2);
  const r = 0.28 + level * 0.05;
  if (level === 3) {
    t.cyl(r + 0.08, r, 0.9, 8, 0x3e2723, 0, 0.6, 0.1, -0.5);
    t.torus(r + 0.06, 0xff6f00, 0, 0.98, 0.3, Math.PI / 2 - 0.5);
  } else {
    t.cyl(r, r + 0.06, 1.0 + level * 0.15, 8, metal, 0, 0.55, 0.1, -0.9);
    t.torus(r, 0xffc107, 0, 0.82, 0.48, Math.PI / 2 - 0.9);
  }
  // artilleur nain
  t.box(0.22, 0.3, 0.2, 0xb71c1c, -0.4, 0.45, -0.25);
  t.box(0.2, 0.18, 0.18, 0xf2c9a0, -0.4, 0.68, -0.25);
  t.cone(0.1, 0.18, 5, 0xe65100, -0.4, 0.55, -0.12, Math.PI);
  return { base: g.build(), turret: t.build(), turretY: 0.4 + h, muzzleY: 1.3 + h };
}

const GOLD = 0xf2b33d;
const CANVAS = 0xf1e3c4;

/** Lanterne posée sur un poteau. */
function lantern(g: GB, x: number, y: number, z: number) {
  g.cyl(0.03, 0.03, 0.7, 4, WOOD_D, x, y + 0.35, z);
  g.box(0.14, 0.16, 0.14, 0x3e2723, x, y + 0.78, z);
  g.setPart(Part.Flame, x, y + 0.72, z).ball(0.06, 0xffd54f, x, y + 0.78, z);
  g.setPart(Part.Body);
}

function mine(level: number): TowerModel {
  const g = new GB(701 + level);
  plinth(g, 1.15);
  if (level === 4) {
    // ferme royale : grange rouge, meule, champ de blé et petit moulin
    g.box(1.3, 0.9, 1.0, 0xa63d2a, -0.25, 0.73, -0.15);
    g.roof(1.45, 0.65, 1.15, 0x5d4037, -0.25, 1.18, -0.15);
    g.box(0.4, 0.55, 0.05, 0xf1e3c4, -0.25, 0.58, 0.36);
    g.box(0.05, 0.55, 0.05, 0x3e2723, -0.25, 0.58, 0.39);
    for (let k = 0; k < 6; k++) g.cone(0.08, 0.35, 4, 0xe6c35c, 0.55 + (k % 3) * 0.17, 0.45, 0.35 + Math.floor(k / 3) * 0.2);
    g.cyl(0.24, 0.3, 0.45, 7, 0xd9b24a, 0.65, 0.5, -0.45);
    g.cone(0.3, 0.3, 7, 0xc49a35, 0.65, 0.88, -0.45);
    g.cyl(0.12, 0.18, 1.4, 6, STONE, 0.8, 0.98, 0.55);
    // ailes du moulin : elles tournent
    g.setPart(Part.Wheel, 0.8, 1.75, 0.68);
    for (let k = 0; k < 4; k++) g.box(0.08, 0.85, 0.04, 0xf1e3c4, 0.8, 1.75, 0.68, 0, 0, (k * Math.PI) / 4 + 0.3);
    g.setPart(Part.Body);
    banner(g, -0.9, 0.5, 0.5, 0.45);
    return { base: g.build(), turret: null, turretY: 0, muzzleY: 1.5 };
  }
  // colline percée d'une galerie, boisage, wagonnet de minerai
  const hill = 0.75 + level * 0.12;
  g.rock(hill, level === 3 ? 0x8d7b62 : 0x7d776d, -0.15, 0.35, -0.3, 1.3, 0.95, 1.05);
  g.box(0.62, 0.62, 0.3, 0x2b2016, -0.15, 0.6, 0.38);
  g.box(0.1, 0.8, 0.1, WOOD, -0.48, 0.68, 0.52);
  g.box(0.1, 0.8, 0.1, WOOD, 0.18, 0.68, 0.52);
  g.box(0.82, 0.1, 0.12, WOOD_D, -0.15, 1.1, 0.52);
  // rails qui sortent de la galerie, wagonnet de minerai qui va et vient
  for (const x of [-0.26, -0.04]) g.box(0.04, 0.03, 1.1, 0x5b4636, x, 0.3, 0.75);
  g.setPart(Part.Cart, -0.15, 0.42, 0.3);
  g.box(0.36, 0.2, 0.3, 0x5d4037, -0.15, 0.44, 0.78);
  for (const x of [-0.31, 0.01]) for (const z of [0.68, 0.88]) g.cyl(0.055, 0.055, 0.04, 8, 0x333333, x, 0.36, z, 0, 0, Math.PI / 2);
  const ore = level === 0 ? 0xb87333 : level === 1 ? 0x8d99a6 : level === 2 ? 0xdfe6ea : GOLD;
  for (let k = 0; k < 4; k++) g.rock(0.085, ore, -0.23 + (k % 2) * 0.16, 0.58, 0.72 + Math.floor(k / 2) * 0.13, 1, 0.8, 1, k);
  g.setPart(Part.Body);
  if (level >= 1) {
    // chevalement : la grande roue du puits tourne
    g.box(0.08, 1.5, 0.08, WOOD_D, 0.55, 1.0, -0.55, 0, 0, 0.15);
    g.box(0.08, 1.5, 0.08, WOOD_D, 0.95, 1.0, -0.55, 0, 0, -0.15);
    g.setPart(Part.Wheel, 0.75, 1.75, -0.55);
    g.torus(0.28, 0x6d4c41, 0.75, 1.75, -0.55);
    for (let k = 0; k < 3; k++) g.box(0.5, 0.04, 0.04, WOOD_D, 0.75, 1.75, -0.55, 0, 0, (k * Math.PI) / 3);
    g.setPart(Part.Body);
    g.cyl(0.012, 0.012, 1.1, 3, 0x3e2723, 0.47, 1.2, -0.55);
  }
  if (level >= 2) lantern(g, -0.75, 0.25, 0.65);
  if (level === 3) {
    // tas d'or et coffre
    for (let k = 0; k < 5; k++) g.rock(0.13, GOLD, -0.8 + (k % 3) * 0.16, 0.38 + (k > 2 ? 0.12 : 0), -0.75 + (k % 2) * 0.12, 1, 0.8, 1, k);
    g.box(0.4, 0.28, 0.28, 0x6d4c41, 0.75, 0.42, 0.1);
    g.box(0.42, 0.06, 0.3, GOLD, 0.75, 0.58, 0.1);
  }
  banner(g, -0.95, 0.4, -0.2, 0.4);
  return { base: g.build(), turret: null, turretY: 0, muzzleY: 1.4 };
}

/** Tente à quatre pans (couleur de toile, bande de couleur). */
function tent(g: GB, x: number, z: number, s: number, c: number, stripe: number, ry = 0) {
  g.cone(0.7 * s, 0.95 * s, 4, c, x, 0.28 + 0.47 * s, z, 0, Math.PI / 4 + ry);
  g.cone(0.72 * s, 0.42 * s, 4, stripe, x, 0.28 + 0.75 * s, z, 0, Math.PI / 4 + ry);
  g.box(0.24 * s, 0.4 * s, 0.04, 0x3e2723, x + Math.sin(ry) * 0.48 * s, 0.28 + 0.2 * s, z + Math.cos(ry) * 0.48 * s, 0, ry, 0);
}

function campfire(g: GB, x: number, z: number) {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.rock(0.07, 0x6d6d6d, x + Math.cos(a) * 0.17, 0.3, z + Math.sin(a) * 0.17, 1, 0.7, 1, a);
  }
  g.box(0.32, 0.05, 0.05, WOOD_D, x, 0.33, z, 0, 0.5, 0);
  g.box(0.32, 0.05, 0.05, WOOD_D, x, 0.34, z, 0, -0.6, 0);
  g.setPart(Part.Flame, x, 0.34, z);
  g.cone(0.1, 0.24, 5, 0xff8f00, x, 0.45, z);
  g.cone(0.05, 0.16, 5, 0xffeb3b, x, 0.45, z);
  g.setPart(Part.Body);
}

function camp(level: number): TowerModel {
  const g = new GB(801 + level);
  plinth(g, 1.15);
  if (level === 3) {
    // tour de guet : pilotis, plateforme couverte, longue-vue
    for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) g.box(0.13, 2.8, 0.13, WOOD, x, 1.65, z, x * 0.08, 0, -z * 0.08);
    g.box(1.0, 0.07, 0.07, WOOD_D, 0, 1.2, 0.45, 0, 0, 0.7);
    g.box(1.0, 0.07, 0.07, WOOD_D, 0, 1.2, -0.45, 0, 0, -0.7);
    g.box(1.35, 0.12, 1.35, WOOD, 0, 3.0, 0);
    for (const [x, z, ry] of [[0, 0.64, 0], [0, -0.64, 0], [0.64, 0, Math.PI / 2], [-0.64, 0, Math.PI / 2]]) g.box(1.35, 0.32, 0.06, WOOD_D, x, 3.2, z, 0, ry, 0);
    g.cone(1.05, 0.7, 4, 0xa8432f, 0, 3.95, 0, 0, Math.PI / 4);
    g.cyl(0.05, 0.07, 0.6, 6, 0x8d6e63, 0.3, 3.45, 0.55, 1.2, 0, 0);
    g.ball(0.05, 0x80d8ff, 0.3, 3.6, 0.83);
    banner(g, 0, 4.2, 0, 0.45);
    campfire(g, -0.65, 0.65);
    return { base: g.build(), turret: null, turretY: 0, muzzleY: 3.2 };
  }
  if (level === 4) {
    // tente de commandement : grand pavillon, tambours, étendards
    g.cyl(0.95, 1.0, 0.75, 8, 0xe9d6ab, 0, 0.66, 0);
    g.cone(1.1, 1.0, 8, 0x8e2a1f, 0, 1.52, 0);
    g.cone(1.12, 0.35, 8, GOLD, 0, 1.18, 0);
    g.box(0.45, 0.6, 0.05, 0x3e2723, 0, 0.58, 0.97);
    for (const x of [-0.75, 0.75]) {
      g.cyl(0.17, 0.17, 0.26, 8, 0xa63d2a, x, 0.42, 0.85);
      g.cyl(0.18, 0.18, 0.03, 8, 0xf1e3c4, x, 0.56, 0.85);
    }
    banner(g, -0.95, 0.4, -0.5, 0.7);
    banner(g, 0.95, 0.4, -0.5, 0.7);
    banner(g, 0, 2.0, 0, 0.45);
    return { base: g.build(), turret: null, turretY: 0, muzzleY: 2 };
  }
  // campement : tentes et feu de camp, puis palissade et râtelier
  const c = level === 0 ? CANVAS : 0xe9d6ab;
  tent(g, -0.3, -0.25, 1.0 + level * 0.1, c, 0xa8432f, 0.4);
  if (level >= 1) tent(g, 0.5, -0.45, 0.75, c, 0x2f6fa8, -0.5);
  campfire(g, 0.35, 0.45);
  g.box(0.5, 0.12, 0.12, WOOD, -0.55, 0.35, 0.6, 0, 0.3, 0);
  if (level >= 1) for (let k = 0; k < 7; k++) {
    const a = 0.3 + (k / 6) * 2.4;
    g.box(0.1, 0.55, 0.1, WOOD, Math.cos(a) * 1.0, 0.5, -Math.sin(a) * 1.0, 0, 0, 0);
    g.cone(0.07, 0.15, 4, WOOD_D, Math.cos(a) * 1.0, 0.85, -Math.sin(a) * 1.0);
  }
  if (level === 2) {
    // râtelier d'armes
    g.box(0.6, 0.06, 0.06, WOOD_D, -0.75, 0.75, 0.3, 0, 1.2, 0);
    for (let k = 0; k < 3; k++) g.box(0.03, 0.7, 0.03, 0xb0bec5, -0.75 + Math.cos(1.2) * (k - 1) * 0.2, 0.62, 0.3 - Math.sin(1.2) * (k - 1) * 0.2);
  }
  banner(g, 0.1, 0.3 + 0.9 + level * 0.1, -0.25, 0.4 + level * 0.1);
  return { base: g.build(), turret: null, turretY: 0, muzzleY: 1.2 };
}

const cache = new Map<number, TowerModel>();
const builders = [archer, barracks, mage, artillery, mine, camp];

export function towerModel(fam: number, level: number): TowerModel {
  const key = fam * 10 + level;
  let m = cache.get(key);
  if (!m) {
    m = builders[fam](level);
    cache.set(key, m);
  }
  return m;
}

/** Emplacement de construction (pierres + cercle de terre). */
export function slotGeometry(locked: boolean): THREE.BufferGeometry {
  const g = new GB(locked ? 7 : 9);
  g.cyl(1.05, 1.15, 0.12, 10, locked ? 0x6b5f50 : 0x9c8a6a, 0, 0.06, 0);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    g.rock(0.2, locked ? 0x5d5d5d : 0xb5ae9f, Math.cos(a) * 1.08, 0.1, Math.sin(a) * 1.08, 1.1, 0.55, 0.9, a);
  }
  if (locked) {
    g.rock(0.35, 0x6d6d6d, 0.2, 0.25, 0.1, 1, 0.7, 1);
    g.rock(0.25, 0x5a5a5a, -0.35, 0.18, -0.2, 1, 0.6, 1, 1);
    g.box(0.8, 0.08, 0.12, WOOD_D, -0.1, 0.22, 0.35, 0, 0.6, 0.15);
  } else {
    g.box(0.4, 0.04, 0.05, 0xd8c8a0, 0, 0.13, 0);
    g.box(0.05, 0.04, 0.4, 0xd8c8a0, 0, 0.13, 0);
  }
  return g.build();
}
