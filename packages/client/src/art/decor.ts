import type * as THREE from 'three';
import type { Biome } from '@dfend/shared';
import { GB, Part } from './builder';

export interface BiomeTheme {
  grass: number[];
  dirt: number;
  dirtEdge: number;
  hill: number;
  fog: number;
  sky: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  sunIntensity: number;
  liquid: 'eau' | 'lave' | 'vase';
  fogNear: number;
  fogFar: number;
}

export const THEMES: Record<Biome, BiomeTheme> = {
  vallee: {
    grass: [0x7db955, 0x8cc65e, 0x6fa84a, 0x97cc66], dirt: 0xd2ad72, dirtEdge: 0xa9844f, hill: 0x5f9a45,
    fog: 0xbfe3ee, sky: 0x9fd3ea, hemiSky: 0xdff3ff, hemiGround: 0x6b8c4a, sun: 0xfff1d6, sunIntensity: 2.4, liquid: 'eau', fogNear: 55, fogFar: 120,
  },
  marais: {
    grass: [0x5b7247, 0x667d4e, 0x4f6640, 0x71865a], dirt: 0x8a7652, dirtEdge: 0x645438, hill: 0x435a38,
    fog: 0x8fa294, sky: 0x7d9488, hemiSky: 0xc8dccc, hemiGround: 0x3c4a32, sun: 0xe6f0d6, sunIntensity: 1.7, liquid: 'vase', fogNear: 40, fogFar: 100,
  },
  cendre: {
    grass: [0x4d423d, 0x574a43, 0x433935, 0x5e4f46], dirt: 0x8a6f5a, dirtEdge: 0x5e4a3c, hill: 0x2f2826,
    fog: 0x6a3f36, sky: 0x4a2a28, hemiSky: 0xffc4a0, hemiGround: 0x3a2020, sun: 0xffb27a, sunIntensity: 2.0, liquid: 'lave', fogNear: 45, fogFar: 110,
  },
};

type DecorBuilder = (g: GB, v: number) => void;

const VALLEE: Record<string, DecorBuilder> = {
  chene(g, v) {
    g.cyl(0.16, 0.24, 1.2, 6, 0x6d4c33, 0, 0.6, 0);
    g.setPart(Part.Sway);
    const c = [0x4f8f3a, 0x5c9c3f, 0x467f33][v % 3];
    g.ball(0.95, c, 0, 1.75, 0, 1, 0.85, 1);
    g.ball(0.65, c, 0.55, 1.5, 0.2, 1, 0.85, 1);
    g.ball(0.6, c, -0.45, 1.6, -0.25, 1, 0.85, 1);
  },
  sapin(g, v) {
    g.cyl(0.12, 0.16, 0.6, 5, 0x5d4033, 0, 0.3, 0);
    g.setPart(Part.Sway);
    const c = [0x2f6b3a, 0x2a5f35, 0x377a42][v % 3];
    g.cone(0.85, 1.2, 7, c, 0, 1.0, 0);
    g.cone(0.65, 1.0, 7, c, 0, 1.65, 0);
    g.cone(0.42, 0.8, 7, c, 0, 2.2, 0);
  },
  buisson(g, v) {
    g.setPart(Part.Sway);
    const c = [0x5c9c3f, 0x6aa84a][v % 2];
    g.ball(0.45, c, 0, 0.3, 0, 1.2, 0.8, 1);
    g.ball(0.32, c, 0.35, 0.25, 0.1, 1, 0.8, 1);
    if (v % 3 === 0) for (let k = 0; k < 4; k++) g.ball(0.06, 0xe53935, Math.cos(k * 1.6) * 0.35, 0.45, Math.sin(k * 1.6) * 0.3);
  },
  rocher(g, v) {
    g.rock(0.5, 0x9a958c, 0, 0.25, 0, 1.3, 0.7, 1, v);
    g.rock(0.3, 0x8a857c, 0.45, 0.15, 0.2, 1, 0.7, 1, v + 1);
  },
  fleurs(g, v) {
    g.setPart(Part.Sway);
    const c = [0xffeb3b, 0xf06292, 0xffffff, 0xba68c8][v % 4];
    for (let k = 0; k < 5; k++) {
      const x = Math.cos(k * 2.4) * 0.35, z = Math.sin(k * 2.4) * 0.35;
      g.box(0.03, 0.25, 0.03, 0x4caf50, x, 0.12, z);
      g.ball(0.07, c, x, 0.27, z);
    }
  },
  herbe(g) {
    g.setPart(Part.Sway);
    for (let k = 0; k < 5; k++) g.cone(0.05, 0.4, 3, 0x6fa84a, Math.cos(k * 1.3) * 0.15, 0.2, Math.sin(k * 1.3) * 0.15, Math.cos(k) * 0.2, 0, Math.sin(k) * 0.2);
  },
};

const MARAIS: Record<string, DecorBuilder> = {
  saule(g, v) {
    g.cyl(0.18, 0.3, 1.5, 6, 0x4e3d2c, 0, 0.75, 0, 0.1);
    g.setPart(Part.Sway);
    const c = [0x50693d, 0x5a7444][v % 2];
    g.ball(0.9, c, 0, 1.8, 0, 1.1, 0.6, 1.1);
    for (let k = 0; k < 6; k++) g.box(0.08, 1.0, 0.08, c, Math.cos(k) * 0.75, 1.2, Math.sin(k) * 0.75);
  },
  arbremort(g, v) {
    g.cyl(0.1, 0.22, 1.8, 5, 0x4a3b30, 0, 0.9, 0, 0.08 * (v % 3));
    g.cyl(0.05, 0.08, 0.8, 4, 0x4a3b30, 0.3, 1.5, 0, 0, 0, -0.9);
    g.cyl(0.04, 0.07, 0.6, 4, 0x4a3b30, -0.25, 1.3, 0.1, 0.3, 0, 0.8);
  },
  roseaux(g) {
    g.setPart(Part.Sway);
    for (let k = 0; k < 6; k++) {
      const x = Math.cos(k * 2.1) * 0.3, z = Math.sin(k * 2.1) * 0.3;
      g.box(0.04, 0.9, 0.04, 0x7a8a4a, x, 0.45, z);
      g.box(0.07, 0.2, 0.07, 0x6d4c33, x, 0.9, z);
    }
  },
  champignon(g, v) {
    const c = [0xd84315, 0xab47bc, 0xffb300][v % 3];
    g.cyl(0.08, 0.1, 0.35, 5, 0xefe6d0, 0, 0.17, 0);
    g.ball(0.25, c, 0, 0.38, 0, 1, 0.55, 1);
    g.cyl(0.05, 0.06, 0.22, 5, 0xefe6d0, 0.3, 0.11, 0.1);
    g.ball(0.15, c, 0.3, 0.24, 0.1, 1, 0.55, 1);
  },
  rocher(g, v) {
    g.rock(0.45, 0x6d7266, 0, 0.2, 0, 1.3, 0.6, 1, v);
    g.ball(0.2, 0x4e6b3f, 0.1, 0.42, 0, 1.4, 0.4, 1.2);
  },
  herbe(g) {
    g.setPart(Part.Sway);
    for (let k = 0; k < 5; k++) g.cone(0.05, 0.45, 3, 0x5b7247, Math.cos(k * 1.3) * 0.15, 0.22, Math.sin(k * 1.3) * 0.15, Math.cos(k) * 0.2, 0, Math.sin(k) * 0.2);
  },
};

const CENDRE: Record<string, DecorBuilder> = {
  basalte(g, v) {
    for (let k = 0; k < 3 + (v % 3); k++) {
      const h = 0.8 + ((k * 37 + v * 11) % 10) / 6;
      g.cyl(0.28, 0.3, h, 6, 0x2e2a2a, Math.cos(k * 2.2) * 0.4, h / 2, Math.sin(k * 2.2) * 0.4);
    }
  },
  arbrecalcine(g) {
    g.cyl(0.08, 0.2, 1.6, 5, 0x1c1a1a, 0, 0.8, 0);
    g.cyl(0.04, 0.07, 0.7, 4, 0x1c1a1a, 0.25, 1.3, 0, 0, 0, -0.8);
    g.cyl(0.04, 0.07, 0.6, 4, 0x1c1a1a, -0.2, 1.1, 0.1, 0.3, 0, 0.9);
    g.ball(0.06, 0xff6f00, 0.1, 0.4, 0.15);
  },
  cristal(g, v) {
    const c = [0xff3d00, 0xe040fb][v % 2];
    for (let k = 0; k < 4; k++) g.cone(0.14, 0.7 + k * 0.15, 5, c, Math.cos(k * 1.7) * 0.2, 0.35, Math.sin(k * 1.7) * 0.2, Math.cos(k) * 0.3, 0, Math.sin(k) * 0.3);
  },
  rocher(g, v) {
    g.rock(0.5, 0x3e3532, 0, 0.25, 0, 1.3, 0.7, 1, v);
    g.box(0.4, 0.05, 0.05, 0xff6f00, 0, 0.32, 0.4, 0, v, 0.3);
  },
  crane(g) {
    g.ball(0.18, 0xd7ccc8, 0, 0.16, 0, 1, 0.9, 1.1);
    g.ball(0.04, 0x1b1b1b, 0.06, 0.2, 0.16);
    g.ball(0.04, 0x1b1b1b, -0.06, 0.2, 0.16);
    g.cyl(0.02, 0.02, 0.5, 4, 0xd7ccc8, 0.25, 0.04, 0, 0, 0.5, Math.PI / 2);
  },
  pic(g, v) {
    g.cone(0.3, 1.4 + (v % 3) * 0.3, 5, 0x262020, 0, 0.7, 0);
  },
};

export const DECOR: Record<Biome, { set: Record<string, DecorBuilder>; inner: [string, number][]; outer: [string, number][] }> = {
  vallee: { set: VALLEE, inner: [['herbe', 6], ['fleurs', 3], ['buisson', 2], ['rocher', 1], ['chene', 0.6]], outer: [['chene', 4], ['sapin', 4], ['buisson', 1.5], ['rocher', 0.6]] },
  marais: { set: MARAIS, inner: [['herbe', 5], ['roseaux', 3], ['champignon', 2], ['rocher', 1], ['arbremort', 0.6]], outer: [['saule', 4], ['arbremort', 3], ['roseaux', 1.5], ['champignon', 1]] },
  cendre: { set: CENDRE, inner: [['rocher', 3], ['crane', 2], ['cristal', 1.4], ['pic', 1], ['arbrecalcine', 0.6]], outer: [['basalte', 4], ['pic', 3], ['arbrecalcine', 2], ['cristal', 1]] },
};

const cache = new Map<string, THREE.BufferGeometry>();
export function decorGeometry(biome: Biome, name: string, variant: number): THREE.BufferGeometry {
  const key = `${biome}.${name}.${variant}`;
  let g = cache.get(key);
  if (!g) {
    const b = new GB(name.length * 131 + variant * 17 + 5);
    DECOR[biome].set[name](b, variant);
    g = b.build();
    cache.set(key, g);
  }
  return g;
}

/** Porte fortifiée au point de sortie (ce qu'on défend). */
export function gateGeometry(biome: Biome): THREE.BufferGeometry {
  const g = new GB(77);
  const stone = biome === 'cendre' ? 0x4a403c : biome === 'marais' ? 0x7d8277 : 0xb3ab9c;
  const roof = biome === 'cendre' ? 0x7f0000 : biome === 'marais' ? 0x3c5a3a : 0x1e40af;
  for (const s of [1, -1]) {
    g.cyl(1.0, 1.1, 4.2, 8, stone, s * 2.6, 2.1, 0);
    g.cone(1.3, 1.8, 8, roof, s * 2.6, 5.1, 0);
    g.box(3.6, 3.2, 1.2, stone, s * 4.6, 1.6, 0.4);
  }
  g.box(4.2, 1.4, 1.4, stone, 0, 3.6, 0);
  for (let k = -2; k <= 2; k++) g.box(0.5, 0.5, 1.5, stone, k * 0.95, 4.5, 0);
  g.box(2.6, 2.6, 0.3, 0x5d4033, 0, 1.3, 0.2);
  for (let k = -1; k <= 1; k++) g.box(0.08, 2.6, 0.32, 0x3e2723, k * 0.8, 1.3, 0.22);
  g.setPart(Part.Team).box(1.2, 1.6, 0.06, 0xffffff, 0, 3.3, 0.72);
  return g.build();
}

/** Repère d'apparition des ennemis (portail / grotte). */
export function spawnGeometry(biome: Biome): THREE.BufferGeometry {
  const g = new GB(55);
  const c = biome === 'cendre' ? 0x2b2222 : biome === 'marais' ? 0x4a4f44 : 0x7d776d;
  for (const s of [1, -1]) {
    g.rock(0.9, c, s * 2.0, 0.9, 0, 0.8, 1.6, 0.8);
    g.rock(0.6, c, s * 2.4, 0.4, 0.8, 1, 0.8, 1);
  }
  g.box(0.12, 1.5, 0.12, 0x4e342e, 1.2, 0.75, 0.6);
  g.ball(0.18, 0xff7043, 1.2, 1.6, 0.6);
  g.box(0.12, 1.5, 0.12, 0x4e342e, -1.2, 0.75, 0.6);
  g.ball(0.18, 0xff7043, -1.2, 1.6, 0.6);
  return g.build();
}
