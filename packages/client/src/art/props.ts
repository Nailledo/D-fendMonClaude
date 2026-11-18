import type * as THREE from 'three';
import type { Biome } from '@dfend/shared';
import { GB } from './builder';

/** Carte interactive : pont, tonneau de poudre, camp de mercenaires, clins d'œil cachés (art en code). */

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, seed: number, f: (b: GB) => void) {
  let g = cache.get(key);
  if (!g) {
    const b = new GB(seed);
    f(b);
    g = b.build();
    cache.set(key, g);
  }
  return g;
}

const WOOD = { vallee: [0x9a6b3f, 0x87592f, 0x5d3d22], marais: [0x6f5a3e, 0x5e4a30, 0x3e3020], cendre: [0x5a463a, 0x4a3a30, 0x2c221d] } as const;
const STONE = { vallee: 0x9e9e94, marais: 0x7d8576, cendre: 0x55504c } as const;

/** Pont le long de +x (le chemin), tablier large de 2,9 en z. `broken` : effondré, seules les culées restent. */
export function bridgeGeometry(biome: Biome, broken: boolean): THREE.BufferGeometry {
  return cached(`pont|${biome}|${broken}`, broken ? 77 : 71, (b) => {
    const [w1, w2, dark] = WOOD[biome];
    const st = STONE[biome];
    // culées de pierre
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rock(0.36, st, sx * 2.05, 0.12, sz * 1.5, 1.2, 0.9, 1, sx * sz);
    for (const sx of [-1, 1]) b.box(0.5, 0.22, 3.0, st, sx * 2.05, 0.02, 0);
    let k = 0;
    for (let x = -1.75; x <= 1.76; x += 0.32, k++) {
      if (broken && Math.abs(x) < 1.25) continue;
      b.box(0.28, 0.07, 2.85 + (k % 3) * 0.06, k % 2 ? w1 : w2, x, 0.16, (k % 3 - 1) * 0.03, 0, (k % 5 - 2) * 0.02, 0);
    }
    if (!broken) {
      for (const z of [-1, 1]) b.box(3.8, 0.14, 0.16, dark, 0, 0.06, z * 1.0);
      for (const z of [-1.45, 1.45]) {
        for (const x of [-1.7, 0, 1.7]) b.box(0.12, 0.62, 0.12, dark, x, 0.45, z);
        b.box(3.6, 0.08, 0.09, w2, 0, 0.74, z);
        b.box(3.5, 0.05, 0.05, w1, 0, 0.47, z);
      }
    } else {
      // planches arrachées qui pendent dans le ruisseau, garde-corps cassés
      b.box(0.28, 0.07, 1.5, w1, -1.05, -0.05, 0.5, 0, 0.2, -0.65);
      b.box(0.28, 0.07, 1.3, w2, 1.0, -0.08, -0.6, 0, -0.3, 0.7);
      b.box(0.28, 0.07, 1.1, w1, 0.2, -0.12, 0.3, 0.3, 0.8, 0.1);
      for (const z of [-1.45, 1.45]) {
        for (const x of [-1.7, 1.7]) b.box(0.12, 0.62, 0.12, dark, x, 0.45, z);
        b.box(0.7, 0.08, 0.09, w2, -1.45, 0.74, z, 0, 0, -0.25);
        b.box(0.6, 0.08, 0.09, w2, 1.5, 0.74, z, 0, 0, 0.3);
      }
    }
  });
}

/** Tonneau de poudre (croix rouge, mèche) et sa petite réserve. */
export function barrelGeometry(): THREE.BufferGeometry {
  return cached('poudre', 31, (b) => {
    const barrel = (s: number, x: number, z: number, ry: number) => {
      b.cyl(0.3 * s, 0.27 * s, 0.64 * s, 10, 0x8d5a2b, x, 0.32 * s, z, 0, ry, 0);
      b.cyl(0.25 * s, 0.25 * s, 0.03, 10, 0x6d4520, x, 0.645 * s, z);
      for (const y of [0.1, 0.54]) b.cyl(0.312 * s, 0.305 * s, 0.05 * s, 10, 0x333333, x, y * s, z);
    };
    barrel(1, 0, 0, 0);
    // croix rouge peinte et mèche
    b.box(0.05, 0.32, 0.03, 0xd32f2f, 0, 0.33, 0.295, 0, 0, 0.62);
    b.box(0.05, 0.32, 0.03, 0xd32f2f, 0, 0.33, 0.295, 0, 0, -0.62);
    b.cyl(0.022, 0.022, 0.24, 4, 0x2a2a2a, 0.09, 0.74, 0, 0, 0, -0.45);
    b.ball(0.035, 0xffcc80, 0.15, 0.85, 0);
    barrel(0.62, 0.47, 0.18, 0.5);
    b.ball(0.13, 0x3a3a3a, -0.36, 0.06, 0.24, 1.3, 0.5, 1);
  });
}

/** Camp de mercenaires : tente, bannière, feu, râtelier, coffre d'or. */
export function campGeometry(): THREE.BufferGeometry {
  return cached('camp', 53, (b) => {
    b.cone(1.0, 1.45, 4, 0xd9c7a0, 0, 0.72, -0.15, 0, Math.PI / 4, 0);
    b.cone(0.5, 0.36, 4, 0xa83232, 0, 1.27, -0.15, 0, Math.PI / 4, 0);
    b.box(0.42, 0.62, 0.04, 0x4e3b2a, 0, 0.32, 0.47, -0.42, 0, 0);
    // bannière
    b.cyl(0.035, 0.04, 2.0, 5, 0x5d4037, 1.05, 1.0, -0.3);
    b.box(0.5, 0.34, 0.03, 0xa83232, 1.31, 1.74, -0.3);
    b.box(0.16, 0.16, 0.035, 0xffd54f, 1.31, 1.74, -0.3, 0, 0, Math.PI / 4);
    // feu de camp
    for (let k = 0; k < 6; k++) b.rock(0.08, 0x777777, -0.35 + Math.cos(k) * 0.28, 0.04, 1.0 + Math.sin(k) * 0.28);
    b.box(0.4, 0.07, 0.07, 0x4e342e, -0.35, 0.06, 1.0, 0, 0.5, 0);
    b.box(0.4, 0.07, 0.07, 0x4e342e, -0.35, 0.06, 1.0, 0, -0.6, 0);
    b.cone(0.13, 0.36, 5, 0xffa726, -0.35, 0.22, 1.0);
    b.cone(0.07, 0.24, 5, 0xffee58, -0.35, 0.2, 1.0);
    // râtelier de lances
    b.box(0.06, 0.06, 0.8, 0x5d4037, -1.05, 0.5, 0.0);
    for (const z of [-0.3, 0, 0.3]) {
      b.cyl(0.025, 0.025, 1.3, 4, 0x6d4c33, -1.05, 0.62, z, 0, 0, 0.12);
      b.cone(0.05, 0.16, 4, 0xb0bec5, -1.13, 1.33, z);
    }
    // coffre de solde
    b.box(0.46, 0.26, 0.3, 0x6d4c33, 0.75, 0.13, 0.75);
    b.box(0.48, 0.05, 0.32, 0x3e2723, 0.75, 0.27, 0.75);
    for (const [x, z] of [[0.68, 0.72], [0.82, 0.8], [0.75, 0.66]]) b.cyl(0.07, 0.07, 0.03, 8, 0xffc928, x, 0.31, z);
  });
}

/** Clins d'œil cachés, par identifiant de secret. */
export function secretGeometry(id: string): THREE.BufferGeometry {
  return cached('secret|' + id, id.length * 31 + 7, (b) => {
    switch (id) {
      case 'mouton':
        b.ball(0.3, 0xf5f5f0, 0, 0.45, 0, 1.35, 0.95, 1, 1);
        for (const [x, y, z] of [[-0.2, 0.62, 0.1], [0.12, 0.66, -0.08], [-0.05, 0.6, 0.18], [0.22, 0.55, 0.12]]) b.ball(0.16, 0xffffff, x, y, z);
        b.box(0.2, 0.22, 0.22, 0x2b2b2b, 0.44, 0.52, 0);
        for (const z of [-0.1, 0.1]) b.box(0.05, 0.13, 0.1, 0x2b2b2b, 0.42, 0.6, z * 1.6, 0.6 * Math.sign(z), 0, 0);
        for (const z of [-0.1, 0.1]) b.ball(0.03, 0xffffff, 0.55, 0.57, z * 0.7);
        for (const [x, z] of [[0.22, 0.13], [0.22, -0.13], [-0.22, 0.13], [-0.22, -0.13]]) b.cyl(0.045, 0.04, 0.26, 5, 0x2b2b2b, x, 0.13, z);
        break;
      case 'epee':
        b.rock(0.45, 0x8f8f86, 0, 0.18, 0, 1.25, 0.75, 1);
        b.box(0.08, 0.85, 0.025, 0xcfd8dc, 0, 0.72, 0);
        b.box(0.38, 0.06, 0.09, 0x8d6e63, 0, 1.14, 0);
        b.cyl(0.035, 0.035, 0.22, 6, 0x5d4037, 0, 1.28, 0);
        b.ball(0.065, 0xffc107, 0, 1.42, 0);
        break;
      case 'puits':
        b.cyl(0.5, 0.55, 0.55, 12, 0x9e9e94, 0, 0.27, 0);
        b.cyl(0.41, 0.41, 0.02, 12, 0x1c3550, 0, 0.5, 0);
        for (const x of [-0.46, 0.46]) b.box(0.08, 1.05, 0.08, 0x6d4c33, x, 0.75, 0);
        b.cyl(0.05, 0.05, 1.0, 6, 0x5d4037, 0, 1.15, 0, 0, 0, Math.PI / 2);
        b.roof(1.25, 0.42, 0.85, 0x8d4b2a, 0, 1.25, 0, Math.PI / 2);
        b.cyl(0.11, 0.09, 0.16, 8, 0x8d6e63, 0.14, 0.82, 0);
        break;
      case 'grenouille':
        b.cyl(0.45, 0.45, 0.03, 12, 0x558b2f, 0, 0.03, 0);
        b.ball(0.2, 0x7cb342, 0, 0.2, 0, 1.15, 0.8, 1.05, 1);
        for (const z of [-0.09, 0.09]) {
          b.ball(0.065, 0xf5f5f5, 0.1, 0.33, z);
          b.ball(0.032, 0x111111, 0.15, 0.34, z);
          b.ball(0.07, 0x689f38, 0.05, 0.08, z * 2.2, 1.4, 0.5, 1);
        }
        // une petite couronne : peut-être un prince ?
        b.cyl(0.065, 0.06, 0.05, 6, 0xffd54f, -0.02, 0.38, 0);
        for (let k = 0; k < 5; k++) b.cone(0.018, 0.05, 3, 0xffd54f, -0.02 + Math.cos(k * 1.26) * 0.055, 0.42, Math.sin(k * 1.26) * 0.055);
        break;
      case 'chaudron':
        for (const [x, z] of [[0.18, 0.1], [-0.18, 0.1], [0, -0.2]]) b.box(0.05, 0.2, 0.05, 0x263238, x, 0.08, z);
        b.ball(0.4, 0x2c3a40, 0, 0.42, 0, 1, 0.78, 1, 1);
        b.torus(0.34, 0x37474f, 0, 0.64, 0, Math.PI / 2);
        b.cyl(0.33, 0.33, 0.02, 12, 0x76ff03, 0, 0.62, 0);
        for (const [x, z, r] of [[0.1, 0.05, 0.06], [-0.12, -0.08, 0.045], [0.02, -0.14, 0.035]]) b.ball(r, 0xb2ff59, x, 0.66, z);
        b.box(0.5, 0.06, 0.06, 0x4e342e, 0, 0.03, 0, 0, 0.7, 0);
        b.cone(0.1, 0.22, 5, 0xff8f00, 0, 0.12, 0);
        break;
      case 'champignon':
        b.cyl(0.12, 0.17, 0.52, 8, 0xfff3e0, 0, 0.26, 0);
        b.ball(0.4, 0xe53935, 0, 0.58, 0, 1, 0.58, 1, 1);
        for (const [x, z] of [[0.18, 0.12], [-0.15, 0.2], [0.05, -0.25], [-0.22, -0.1], [0.27, -0.12]]) b.ball(0.055, 0xffffff, x, 0.76, z, 1, 0.5, 1);
        for (const z of [-0.06, 0.06]) b.ball(0.028, 0x222222, 0.13, 0.32, z);
        b.box(0.02, 0.035, 0.07, 0x5d1f1f, 0.15, 0.22, 0);
        b.ball(0.11, 0xffccbc, -0.3, 0.06, 0.25, 1, 0.6, 1);
        break;
      case 'oeuf':
        b.torus(0.32, 0x6d4c33, 0, 0.1, 0, Math.PI / 2);
        b.torus(0.26, 0x5d4037, 0, 0.14, 0, Math.PI / 2, 0.4);
        b.ball(0.26, 0x7e57c2, 0, 0.4, 0, 1, 1.35, 1, 1);
        for (const [x, y, z] of [[0.2, 0.45, 0.1], [-0.12, 0.55, 0.18], [0.05, 0.3, -0.24], [-0.2, 0.38, -0.08], [0.1, 0.62, -0.1]]) b.ball(0.06, 0xffa000, x, y, z, 1, 1, 0.5);
        break;
      case 'couronne':
        b.ball(0.27, 0xeeeee4, 0, 0.27, 0, 1, 0.9, 1.05, 1);
        for (const z of [-0.09, 0.09]) b.ball(0.07, 0x1a1a1a, 0.22, 0.3, z);
        b.box(0.12, 0.08, 0.2, 0xe0e0d6, 0.2, 0.09, 0);
        b.cyl(0.21, 0.21, 0.1, 8, 0xffc107, 0, 0.5, 0);
        for (let k = 0; k < 6; k++) b.cone(0.045, 0.12, 4, 0xffc107, Math.cos(k * 1.05) * 0.19, 0.6, Math.sin(k * 1.05) * 0.19);
        b.ball(0.04, 0xe53935, 0.2, 0.5, 0);
        for (const [x, z, r] of [[-0.45, 0.2, 0.5], [0.4, -0.35, -0.8]]) b.cyl(0.035, 0.035, 0.42, 5, 0xe0e0d6, x, 0.04, z, Math.PI / 2, r, 0);
        break;
      case 'enclume':
        b.cyl(0.33, 0.38, 0.4, 9, 0x6d4c33, 0, 0.2, 0);
        b.box(0.3, 0.12, 0.2, 0x37474f, 0, 0.46, 0);
        b.box(0.56, 0.14, 0.27, 0x455a64, 0, 0.58, 0);
        b.cone(0.09, 0.28, 6, 0x455a64, 0.4, 0.6, 0, 0, 0, -Math.PI / 2);
        b.cyl(0.03, 0.03, 0.5, 5, 0x6d4c33, -0.38, 0.28, 0.3, 0.3, 0, 0.4);
        b.box(0.1, 0.1, 0.2, 0x37474f, -0.47, 0.5, 0.38, 0.3, 0, 0.4);
        break;
    }
  });
}
