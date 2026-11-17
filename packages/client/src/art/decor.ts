import type * as THREE from 'three';
import type { Biome } from '@dfend/shared';
import { GB, Part, shade } from './builder';

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

/**
 * Entrée de galerie creusée dans la colline : arche de rochers, étais de bois, intérieur dans l'ombre.
 * Repère local : l'ouverture regarde vers +z (vers la carte), la galerie s'enfonce vers -z sous la colline
 * (le terrain se relève derrière, voir World). Les ennemis sortent de l'obscurité.
 */
export function spawnGeometry(biome: Biome): THREE.BufferGeometry {
  const g = new GB(55);
  g.ao = false;
  g.jitter = 0.05;
  // trois teintes de roche (strates basses plus sombres), mousse du biome sur le dessus
  const rk = biome === 'cendre' ? [0x2e2523, 0x3a2f2c, 0x4a3d38] : biome === 'marais' ? [0x4a4f44, 0x5a6052, 0x6a7062] : [0x6f6a60, 0x857f73, 0x9a9488];
  const moss = THEMES[biome].hill;
  const wood = biome === 'cendre' ? 0x3e2a22 : 0x6d4c33;
  const dark = 0x0c0907, dim = 0x1b1510;
  // petit hasard déterministe : la même entrée sur toutes les cartes
  let sd = 7;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);

  // l'intérieur : fond noir, parois et voûte sombres (cachées sous la roche), sol de terre battue
  // (le sombre ne tapisse que l'intérieur ; dehors, la galerie est enveloppée de roche)
  g.box(3.2, 3.0, 0.12, dark, 0, 1.2, -2.66);
  for (const s of [1, -1]) g.box(0.1, 3.0, 2.9, dim, s * 1.6, 1.2, -1.25);
  g.box(3.3, 0.1, 2.9, dim, 0, 2.4, -1.25);
  g.box(3.1, 0.05, 3.0, 0x2a2018, 0, 0.03, -1.2);
  // enveloppe : murs, voûte et fond en roche
  for (const s of [1, -1]) g.box(1.4, 3.25, 2.9, rk[0], s * 2.35, 1.3, -1.3);
  g.box(6.1, 0.7, 2.9, rk[0], 0, 2.8, -1.3);
  g.box(6.1, 3.4, 1.0, rk[0], 0, 1.5, -3.2);
  for (const s of [1, -1]) {
    g.rock(0.9, rk[1], s * 3.05, 1.5, -1.7, 0.8, 1.5, 1.7, s);
    g.rock(0.85, rk[0], s * 2.95, 1.1, -3.1, 0.9, 1.3, 1.3, s * 2);
  }
  // étais de mine : un cadre à l'entrée, un second dans la pénombre
  for (const [z, col] of [[-0.15, wood], [-1.7, 0x2e2118]] as const) {
    for (const s of [1, -1]) g.box(0.2, 2.2, 0.2, col, s * 1.38, 1.1, z, 0, 0, s * 0.03);
    g.box(3.0, 0.22, 0.24, col, 0, 2.25, z);
  }

  // façade : strates de roche aplaties, de plus en plus étroites vers le haut, de part et d'autre de l'ouverture
  const rows: [number, number, number, number][] = [
    // hauteur, premier x, nombre de blocs, épaisseur
    [0.42, 1.95, 3, 0.62],
    [1.25, 1.9, 3, 0.55],
    [2.05, 1.85, 2, 0.5],
  ];
  rows.forEach(([y, x0, n, th], r) => {
    for (const s of [1, -1]) for (let k = 0; k < n; k++) {
      const x = s * (x0 + k * 0.95 + rnd() * 0.12);
      const w = 0.62 + rnd() * 0.12;
      g.rock(w, rk[Math.min(2, r + (k % 2))], x, y + rnd() * 0.06, 0.05 - k * 0.35 - r * 0.12, 1.15, th / w, 0.95, rnd() * 3);
    }
  });
  // linteau : une grande dalle posée sur les deux piliers, puis la roche qui recule dans la colline
  g.rock(1, rk[1], 0, 2.78, 0.05, 2.75, 0.42, 1.05, 0.2);
  g.rock(1, rk[2], 0.2, 3.2, -0.8, 2.6, 0.45, 1.2, -0.3);
  g.rock(1, rk[1], -0.3, 3.25, -2.3, 2.5, 0.5, 1.5, 0.5);
  g.rock(1, rk[2], 0.4, 3.1, -3.8, 2.3, 0.45, 1.3, 1.2);
  for (const s of [1, -1]) {
    g.rock(0.85, rk[2], s * 2.75, 2.75, -0.6, 1.3, 0.55, 1.2, s);
    g.rock(0.9, rk[1], s * 2.55, 3.0, -2.3, 1.2, 0.6, 1.4, s * 2);
    g.rock(0.8, rk[0], s * 2.4, 2.8, -3.9, 1.2, 0.55, 1.3, s * 3);
  }
  // mousse et herbe en touffes sur le dessus, pour que la roche se fonde dans la colline
  // (pas de mousse dans les cendres)
  if (biome !== 'cendre') {
    for (let k = 0; k < 10; k++) {
      const x = -2.4 + (k % 5) * 1.2 + rnd() * 0.4, z = (k < 5 ? -1.8 : -3.5) + rnd() * 0.7;
      g.ball(0.22 + rnd() * 0.16, shade(moss, 0.72 + rnd() * 0.2), x, 3.5 + rnd() * 0.1, z, 1.3, 0.35, 1.1);
    }
    // touffes qui pendent du linteau
    for (const x of [-1.1, 0.35, 1.3]) g.cone(0.12, 0.35, 4, shade(moss, 0.8), x, 2.48, 0.5, Math.PI, 0, 0);
  }

  // éboulis au pied de la falaise : gros blocs contre la paroi, cailloux de plus en plus petits vers l'avant
  for (const s of [1, -1]) {
    g.rock(0.55, rk[0], s * 3.7, 0.25, 0.75, 1.2, 0.7, 1, s);
    g.rock(0.42, rk[1], s * 2.75, 0.2, 0.95, 1.1, 0.65, 1, s * 3);
    for (let k = 0; k < 14; k++) {
      const t = rnd();
      const z = 0.6 + t * 2.6;
      const x = s * (1.85 + t * 0.5 + rnd() * (2.4 - t * 0.8));
      const r = (0.26 - t * 0.14) * (0.7 + rnd() * 0.6);
      g.rock(r, rk[(k + (s > 0 ? 1 : 0)) % 3], x, r * 0.4, z, 1, 0.6, 1, rnd() * 6);
    }
  }
  // quelques galets plats sur les bords du chemin, devant l'ouverture
  for (let k = 0; k < 6; k++) {
    const s = k % 2 ? 1 : -1;
    g.rock(0.1 + rnd() * 0.06, rk[2], s * (1.25 + rnd() * 0.3), 0.04, 0.6 + k * 0.45, 1.2, 0.4, 1, rnd() * 6);
  }

  // torches de part et d'autre, plantées dans l'éboulis
  for (const s of [1, -1]) {
    g.box(0.1, 0.9, 0.1, 0x4e342e, s * 2.15, 0.55, 0.85, 0, 0, s * 0.15);
    g.ball(0.17, 0xff7043, s * 2.22, 1.05, 0.85);
    g.ball(0.09, 0xffe082, s * 2.22, 1.17, 0.85);
  }
  return g.build();
}
