import type * as THREE from 'three';
import { GB, Part } from './builder';

type Build = (g: GB) => void;

function legs(g: GB, c: number, hip: number, spread: number, w = 0.16, len = hip) {
  g.setPart(Part.LegL, spread, hip, 0).box(w, len, w * 1.1, c, spread, hip - len / 2, 0);
  g.setPart(Part.LegR, -spread, hip, 0).box(w, len, w * 1.1, c, -spread, hip - len / 2, 0);
  g.setPart(Part.Body);
}

function arms(g: GB, c: number, sh: number, spread: number, len = 0.42, w = 0.13) {
  g.setPart(Part.ArmL, spread, sh, 0).box(w, len, w, c, spread, sh - len / 2, 0);
  g.setPart(Part.ArmR, -spread, sh, 0).box(w, len, w, c, -spread, sh - len / 2, 0);
  g.setPart(Part.Body);
}

/** Arme tenue dans la main droite (bouge avec le bras). */
function rightHand(g: GB, sh: number, spread: number, len: number, fn: (g: GB, x: number, y: number) => void) {
  g.setPart(Part.ArmR, -spread, sh, 0);
  fn(g, -spread, sh - len);
  g.setPart(Part.Body);
}

function eyes(g: GB, y: number, z: number, sep: number, c = 0xfff3b0, r = 0.05) {
  g.ball(r, c, sep, y, z);
  g.ball(r, c, -sep, y, z);
}

function quadLegs(g: GB, c: number, hip: number, fx: number, bz: number, w = 0.13) {
  g.setPart(Part.LegL, fx, hip, bz).box(w, hip, w, c, fx, hip / 2, bz);
  g.setPart(Part.LegR, -fx, hip, bz).box(w, hip, w, c, -fx, hip / 2, bz);
  g.setPart(Part.LegR, fx, hip, -bz).box(w, hip, w, c, fx, hip / 2, -bz);
  g.setPart(Part.LegL, -fx, hip, -bz).box(w, hip, w, c, -fx, hip / 2, -bz);
  g.setPart(Part.Body);
}

function wings(g: GB, c: number, y: number, span: number, z = 0, membrane = false) {
  const pts: [number, number][] = membrane
    ? [[0, 0], [span, 0.35], [span * 0.85, -0.05], [span * 0.6, 0.05], [span * 0.4, -0.12], [0, -0.15]]
    : [[0, 0], [span, 0.2], [span * 0.8, -0.1], [span * 0.4, -0.2], [0, -0.15]];
  g.setPart(Part.WingL, 0.1, y, z).shape(pts, 0.04, c, 0.1, y, z, Math.PI / 2, 0, 0);
  g.setPart(Part.WingR, -0.1, y, z).shape(pts.map(([x, yy]) => [-x, yy] as [number, number]), 0.04, c, -0.1, y, z, Math.PI / 2, 0, 0);
  g.setPart(Part.Body);
}

const MODELS: Record<string, Build> = {
  gobelin(g) {
    const skin = 0x7cb342, cloth = 0x8d6e40;
    legs(g, 0x5d4a2e, 0.42, 0.12);
    g.box(0.42, 0.4, 0.3, cloth, 0, 0.6, 0);
    g.box(0.44, 0.08, 0.32, 0x4e3b22, 0, 0.44, 0);
    arms(g, skin, 0.76, 0.27, 0.36);
    rightHand(g, 0.76, 0.27, 0.36, (g, x, y) => g.box(0.05, 0.05, 0.36, 0xc7c7c7, x, y, 0.15));
    g.box(0.44, 0.36, 0.38, skin, 0, 0.98, 0.02);
    g.cone(0.08, 0.32, 4, skin, 0.3, 1.04, 0, 0, 0, -1.3);
    g.cone(0.08, 0.32, 4, skin, -0.3, 1.04, 0, 0, 0, 1.3);
    g.box(0.12, 0.12, 0.14, 0x689f38, 0, 0.92, 0.24);
    eyes(g, 1.02, 0.21, 0.11, 0xfff176);
  },
  loup(g) {
    const fur = 0x7a7d86, dark = 0x4a4d55;
    quadLegs(g, dark, 0.38, 0.17, 0.32);
    g.box(0.42, 0.36, 0.95, fur, 0, 0.55, 0);
    g.box(0.36, 0.3, 0.32, fur, 0, 0.72, 0.55);
    g.box(0.2, 0.16, 0.26, dark, 0, 0.64, 0.8);
    g.cone(0.07, 0.18, 4, dark, 0.11, 0.93, 0.5);
    g.cone(0.07, 0.18, 4, dark, -0.11, 0.93, 0.5);
    g.box(0.1, 0.1, 0.42, fur, 0, 0.66, -0.62, 0.6);
    eyes(g, 0.78, 0.71, 0.1, 0xffca28, 0.04);
  },
  brute(g) {
    const skin = 0x6d8f3c, armor = 0x8a9097, dark = 0x3e4247;
    legs(g, dark, 0.55, 0.2, 0.24);
    g.box(0.75, 0.65, 0.5, armor, 0, 0.88, 0);
    g.box(0.8, 0.12, 0.54, 0x5a3d22, 0, 0.6, 0);
    g.box(0.3, 0.2, 0.3, armor, 0.45, 1.18, 0);
    g.box(0.3, 0.2, 0.3, armor, -0.45, 1.18, 0);
    arms(g, skin, 1.12, 0.48, 0.55, 0.2);
    rightHand(g, 1.12, 0.48, 0.55, (g, x, y) => {
      g.box(0.06, 0.06, 0.7, 0x5d4037, x, y, 0.25);
      g.shape([[0, 0], [0.32, 0.12], [0.32, -0.28], [0, -0.16]], 0.05, 0xb0bec5, x, y + 0.05, 0.5, 0, Math.PI / 2, 0);
    });
    g.box(0.42, 0.38, 0.4, skin, 0, 1.38, 0.05);
    g.box(0.46, 0.18, 0.44, dark, 0, 1.56, 0.03);
    g.cone(0.05, 0.12, 4, 0xfff8e1, 0.12, 1.22, 0.26, Math.PI);
    g.cone(0.05, 0.12, 4, 0xfff8e1, -0.12, 1.22, 0.26, Math.PI);
    eyes(g, 1.42, 0.25, 0.1, 0xff7043);
  },
  chaman(g) {
    const skin = 0x8bc34a, robe = 0x6a4c93;
    g.cone(0.36, 0.8, 6, robe, 0, 0.4, 0);
    legs(g, 0x4a3060, 0.2, 0.1, 0.12, 0.2);
    arms(g, skin, 0.78, 0.22, 0.34);
    rightHand(g, 0.78, 0.22, 0.34, (g, x, y) => {
      g.cyl(0.03, 0.03, 1.1, 5, 0x6d4c41, x, y + 0.2, 0.08);
      g.ball(0.1, 0xfafafa, x, y + 0.8, 0.08);
      g.ball(0.05, 0x4fc3f7, x, y + 0.8, 0.16);
    });
    g.box(0.38, 0.34, 0.34, skin, 0, 0.98, 0.02);
    g.cone(0.07, 0.28, 4, skin, 0.27, 1.02, 0, 0, 0, -1.3);
    g.cone(0.07, 0.28, 4, skin, -0.27, 1.02, 0, 0, 0, 1.3);
    g.box(0.08, 0.3, 0.04, 0xe53935, 0.08, 1.28, -0.1, 0.3);
    g.box(0.08, 0.26, 0.04, 0xfdd835, -0.06, 1.26, -0.12, -0.2);
    eyes(g, 1.02, 0.19, 0.09, 0x80deea);
  },
  corbeau(g) {
    g.ball(0.32, 0x26262e, 0, 0, 0, 0.9, 0.8, 1.3);
    g.ball(0.2, 0x26262e, 0, 0.12, 0.36);
    g.cone(0.07, 0.26, 4, 0xffb300, 0, 0.1, 0.62, Math.PI / 2);
    g.box(0.3, 0.04, 0.3, 0x1b1b22, 0, 0, -0.45, 0.2);
    wings(g, 0x34343e, 0.05, 0.95);
    eyes(g, 0.18, 0.5, 0.09, 0xff1744, 0.035);
  },
  bouclier(g) {
    const skin = 0x7cb342, armor = 0x9e8c6c;
    legs(g, 0x4e3b22, 0.48, 0.15, 0.18);
    g.box(0.55, 0.5, 0.38, armor, 0, 0.74, 0);
    arms(g, skin, 0.96, 0.33, 0.42, 0.15);
    g.setPart(Part.ArmL, 0.33, 0.96, 0);
    g.box(0.75, 0.95, 0.08, 0x8d6e63, 0.1, 0.72, 0.36);
    g.box(0.8, 0.08, 0.1, 0x9e9e9e, 0.1, 1.15, 0.37);
    g.box(0.8, 0.08, 0.1, 0x9e9e9e, 0.1, 0.3, 0.37);
    g.ball(0.11, 0xbdbdbd, 0.1, 0.72, 0.42);
    g.setPart(Part.Body);
    g.box(0.38, 0.34, 0.34, skin, 0, 1.15, 0);
    g.box(0.42, 0.14, 0.38, 0x757575, 0, 1.3, 0);
    eyes(g, 1.17, 0.18, 0.09, 0xfff176);
  },
  noye(g) {
    const skin = 0x6f9a8a, rag = 0x3e5a4c;
    legs(g, rag, 0.48, 0.13, 0.15);
    g.box(0.46, 0.5, 0.3, rag, 0, 0.74, 0, 0.12);
    arms(g, skin, 0.96, 0.3, 0.5);
    g.box(0.36, 0.36, 0.34, skin, 0, 1.18, 0.06, 0.2);
    g.box(0.06, 0.4, 0.04, 0x2e7d32, 0.15, 1.0, 0.2, 0.1);
    g.box(0.05, 0.3, 0.04, 0x2e7d32, -0.18, 0.85, -0.17, -0.1);
    eyes(g, 1.22, 0.24, 0.09, 0xb2ff59, 0.045);
  },
  sorciere(g) {
    const robe = 0x4a3a5c, skin = 0x9ccc65;
    g.cone(0.42, 1.0, 7, robe, 0, 0.5, 0);
    legs(g, 0x2e2238, 0.15, 0.1, 0.1, 0.15);
    arms(g, robe, 0.92, 0.24, 0.42);
    rightHand(g, 0.92, 0.24, 0.42, (g, x, y) => {
      g.cyl(0.03, 0.03, 1.2, 5, 0x4e342e, x, y + 0.25, 0.1);
      g.ball(0.1, 0x76ff03, x, y + 0.9, 0.1);
    });
    g.box(0.32, 0.32, 0.3, skin, 0, 1.12, 0.03);
    g.cone(0.07, 0.22, 4, 0x7cb342, 0, 1.08, 0.24, Math.PI / 2);
    g.cyl(0.38, 0.38, 0.04, 9, 0x2e2238, 0, 1.3, 0);
    g.cone(0.22, 0.6, 7, 0x2e2238, 0, 1.6, -0.05, -0.2);
    eyes(g, 1.15, 0.18, 0.08, 0xffeb3b, 0.035);
  },
  crapaud(g) {
    const skin = 0x8d9a3a;
    g.setPart(Part.LegL, 0.3, 0.2, -0.1).box(0.18, 0.2, 0.36, 0x6b7a2a, 0.32, 0.1, -0.1);
    g.setPart(Part.LegR, -0.3, 0.2, -0.1).box(0.18, 0.2, 0.36, 0x6b7a2a, -0.32, 0.1, -0.1);
    g.setPart(Part.Body);
    g.ball(0.42, skin, 0, 0.36, 0, 1.1, 0.8, 1.05);
    g.ball(0.12, 0xfff9c4, 0.18, 0.62, 0.28);
    g.ball(0.12, 0xfff9c4, -0.18, 0.62, 0.28);
    g.ball(0.06, 0x212121, 0.2, 0.64, 0.38);
    g.ball(0.06, 0x212121, -0.2, 0.64, 0.38);
    g.ball(0.24, 0x263238, 0, 0.72, -0.18);
    g.cyl(0.02, 0.02, 0.25, 4, 0x8d6e63, 0, 1.0, -0.2, 0.4);
    g.ball(0.05, 0xff6f00, 0, 1.12, -0.26);
  },
  limon(g) {
    g.ball(0.55, 0x7cb342, 0, 0.45, 0, 1, 0.82, 1, 1);
    g.ball(0.3, 0x9ccc65, 0.15, 0.75, 0.1, 1, 0.8, 1, 1);
    g.ball(0.09, 0xffffff, 0.16, 0.62, 0.45);
    g.ball(0.09, 0xffffff, -0.16, 0.62, 0.45);
    g.ball(0.045, 0x1b1b1b, 0.16, 0.62, 0.53);
    g.ball(0.045, 0x1b1b1b, -0.16, 0.62, 0.53);
  },
  petitlimon(g) {
    MODELS.limon(g);
  },
  ver(g) {
    const c = 0x8d6e63;
    for (let i = 0; i < 5; i++) g.ball(0.3 - i * 0.03, i % 2 ? c : 0x795548, 0, 0.3 + (i === 0 ? 0.2 : 0), 0.3 - i * 0.32, 1, 1, 1);
    g.ball(0.34, 0xa1887f, 0, 0.55, 0.45);
    g.cyl(0.2, 0.2, 0.08, 8, 0x3e2723, 0, 0.55, 0.76, Math.PI / 2);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.cone(0.04, 0.12, 3, 0xfff8e1, Math.cos(a) * 0.16, 0.55 + Math.sin(a) * 0.16, 0.8, Math.PI / 2);
    }
  },
  chauvesouris(g) {
    g.ball(0.35, 0x4a3b55, 0, 0, 0, 1, 1, 1.1);
    g.cone(0.08, 0.2, 4, 0x4a3b55, 0.14, 0.38, 0.05);
    g.cone(0.08, 0.2, 4, 0x4a3b55, -0.14, 0.38, 0.05);
    wings(g, 0x2d2236, 0.05, 1.25, 0, true);
    eyes(g, 0.1, 0.3, 0.12, 0xff5252, 0.05);
    g.ball(0.18, 0x6f9a8a, 0, -0.42, 0, 1, 1.3, 1);
  },
  diablotin(g) {
    const skin = 0xd84315;
    legs(g, 0x8d2a0e, 0.36, 0.11, 0.13);
    g.box(0.36, 0.36, 0.28, skin, 0, 0.54, 0);
    arms(g, skin, 0.68, 0.23, 0.32);
    rightHand(g, 0.68, 0.23, 0.32, (g, x, y) => {
      g.cyl(0.025, 0.025, 0.9, 4, 0x3e2723, x, y + 0.15, 0.12);
      g.cone(0.04, 0.16, 3, 0xbdbdbd, x, y + 0.66, 0.12);
    });
    g.box(0.38, 0.34, 0.34, skin, 0, 0.88, 0.02);
    g.cone(0.06, 0.24, 4, 0x212121, 0.13, 1.12, 0, 0, 0, -0.3);
    g.cone(0.06, 0.24, 4, 0x212121, -0.13, 1.12, 0, 0, 0, 0.3);
    g.box(0.05, 0.05, 0.5, skin, 0, 0.45, -0.35, 0.6);
    g.cone(0.07, 0.12, 3, skin, 0, 0.28, -0.56, -1.0);
    eyes(g, 0.92, 0.19, 0.09, 0xffff00, 0.045);
  },
  cornu(g) {
    const skin = 0x8e2a1e, fur = 0x4e2a1e;
    legs(g, fur, 0.6, 0.22, 0.26);
    g.box(0.8, 0.7, 0.55, skin, 0, 0.98, 0);
    g.box(0.85, 0.2, 0.6, fur, 0, 0.66, 0);
    arms(g, skin, 1.25, 0.52, 0.6, 0.22);
    g.box(0.5, 0.42, 0.46, skin, 0, 1.5, 0.12);
    g.cone(0.1, 0.55, 5, 0xefebe9, 0.32, 1.78, 0.05, 0.4, 0, -0.9);
    g.cone(0.1, 0.55, 5, 0xefebe9, -0.32, 1.78, 0.05, 0.4, 0, 0.9);
    eyes(g, 1.55, 0.36, 0.12, 0xffeb3b, 0.06);
  },
  golem(g) {
    const rock = 0x3e3a3a, lava = 0xff8f00;
    legs(g, rock, 0.6, 0.3, 0.36);
    g.rock(0.62, rock, 0, 1.1, 0, 1.15, 1, 0.9);
    g.box(0.5, 0.06, 0.06, lava, 0.1, 1.15, 0.5, 0, 0, 0.6);
    g.box(0.4, 0.06, 0.06, lava, -0.15, 0.95, 0.52, 0, 0, -0.4);
    g.ball(0.14, lava, 0, 1.25, 0.5);
    arms(g, rock, 1.4, 0.75, 0.75, 0.3);
    g.setPart(Part.ArmR, -0.75, 1.4, 0).rock(0.3, rock, -0.75, 0.55, 0);
    g.setPart(Part.ArmL, 0.75, 1.4, 0).rock(0.3, rock, 0.75, 0.55, 0);
    g.setPart(Part.Body);
    g.rock(0.3, rock, 0, 1.82, 0.12);
    eyes(g, 1.85, 0.38, 0.12, 0xffd54f, 0.06);
  },
  invocateur(g) {
    const robe = 0x311b3f;
    g.cone(0.45, 1.1, 7, robe, 0, 0.55, 0);
    legs(g, 0x1a0f22, 0.15, 0.1, 0.1, 0.15);
    arms(g, robe, 1.0, 0.27, 0.45);
    g.ball(0.17, 0xd500f9, 0, 0.78, 0.45);
    g.cone(0.26, 0.5, 6, 0x4a148c, 0, 1.3, 0);
    g.ball(0.18, 0x1a0f22, 0, 1.22, 0.06);
    eyes(g, 1.22, 0.2, 0.07, 0xff4081, 0.04);
    g.cone(0.05, 0.3, 4, 0x212121, 0.15, 1.55, 0, 0, 0, -0.4);
    g.cone(0.05, 0.3, 4, 0x212121, -0.15, 1.55, 0, 0, 0, 0.4);
  },
  gargouille(g) {
    const stone = 0x7d7f84;
    g.ball(0.38, stone, 0, 0, 0, 0.9, 0.95, 1.2);
    g.box(0.34, 0.32, 0.32, stone, 0, 0.32, 0.36);
    g.cone(0.06, 0.26, 4, 0x55575c, 0.12, 0.55, 0.32, -0.3);
    g.cone(0.06, 0.26, 4, 0x55575c, -0.12, 0.55, 0.32, -0.3);
    wings(g, 0x5f6166, 0.1, 1.15, -0.05, true);
    g.setPart(Part.LegL, 0.15, -0.2, 0).box(0.1, 0.35, 0.1, 0x55575c, 0.15, -0.38, 0.05);
    g.setPart(Part.LegR, -0.15, -0.2, 0).box(0.1, 0.35, 0.1, 0x55575c, -0.15, -0.38, 0.05);
    g.setPart(Part.Body);
    eyes(g, 0.36, 0.53, 0.09, 0xff6e40, 0.04);
  },
  chevalierinf(g) {
    const armor = 0x2b2b33, glow = 0xff3d00;
    legs(g, armor, 0.6, 0.18, 0.22);
    g.box(0.65, 0.65, 0.42, armor, 0, 0.95, 0);
    g.box(0.14, 0.3, 0.05, glow, 0, 1.0, 0.22);
    g.box(0.3, 0.18, 0.3, 0x3f3f4a, 0.4, 1.25, 0);
    g.box(0.3, 0.18, 0.3, 0x3f3f4a, -0.4, 1.25, 0);
    arms(g, armor, 1.22, 0.42, 0.55, 0.17);
    rightHand(g, 1.22, 0.42, 0.55, (g, x, y) => {
      g.box(0.1, 0.05, 0.25, 0x424242, x, y, 0.05);
      g.shape([[-0.06, 0], [0.06, 0], [0.04, 1.0], [0, 1.15], [-0.04, 1.0]], 0.04, 0xb71c1c, x, y, 0.1, Math.PI / 2, 0, 0);
    });
    g.box(0.38, 0.42, 0.38, armor, 0, 1.52, 0);
    g.box(0.3, 0.05, 0.05, glow, 0, 1.55, 0.2);
    g.cone(0.07, 0.35, 4, 0x1a1a1f, 0.18, 1.8, 0, 0, 0, -0.5);
    g.cone(0.07, 0.35, 4, 0x1a1a1f, -0.18, 1.8, 0, 0, 0, 0.5);
  },
  grolbak(g) {
    const skin = 0x689f38, cloth = 0x6d4c41;
    legs(g, 0x4e342e, 0.5, 0.24, 0.26);
    g.ball(0.6, skin, 0, 0.95, 0, 1, 0.9, 0.85);
    g.box(0.9, 0.2, 0.7, cloth, 0, 0.6, 0);
    arms(g, skin, 1.25, 0.6, 0.6, 0.22);
    rightHand(g, 1.25, 0.6, 0.6, (g, x, y) => {
      g.cyl(0.1, 0.05, 0.9, 6, 0x5d4037, x, y + 0.2, 0.25, 0.8);
      g.ball(0.22, 0x6d4c41, x, y + 0.45, 0.55);
    });
    g.box(0.55, 0.45, 0.5, skin, 0, 1.6, 0.05);
    g.cone(0.12, 0.45, 4, skin, 0.4, 1.66, 0, 0, 0, -1.3);
    g.cone(0.12, 0.45, 4, skin, -0.4, 1.66, 0, 0, 0, 1.3);
    g.cyl(0.3, 0.3, 0.14, 6, 0xffca28, 0, 1.9, 0.03);
    for (let k = 0; k < 5; k++) g.cone(0.06, 0.14, 4, 0xffca28, Math.cos(k * 1.25) * 0.26, 2.02, 0.03 + Math.sin(k * 1.25) * 0.26);
    g.box(0.36, 0.08, 0.06, 0xfff8e1, 0, 1.45, 0.3);
    eyes(g, 1.68, 0.3, 0.13, 0xff5722, 0.06);
  },
  vasiere(g) {
    g.ball(0.75, 0x4e6b3f, 0, 0.6, 0, 1.1, 0.8, 1);
    g.ball(0.5, 0x5e7d4a, 0, 1.25, 0.1, 1, 0.9, 1);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      g.cyl(0.03, 0.03, 0.5, 4, 0x8d6e40, Math.cos(a) * 0.35, 1.7, Math.sin(a) * 0.35);
      g.ball(0.06, 0x5d4037, Math.cos(a) * 0.35, 1.97, Math.sin(a) * 0.35, 1, 1.8, 1);
    }
    arms(g, 0x4e6b3f, 1.3, 0.75, 0.8, 0.24);
    g.ball(0.12, 0xffeb3b, 0.18, 1.35, 0.52);
    g.ball(0.12, 0xffeb3b, -0.18, 1.35, 0.52);
    g.box(0.4, 0.06, 0.06, 0x1b1b1b, 0, 1.12, 0.55);
    g.box(0.07, 0.6, 0.05, 0x2e7d32, 0.4, 1.0, 0.55, 0.2);
    g.box(0.07, 0.5, 0.05, 0x2e7d32, -0.35, 0.9, 0.58, -0.2);
  },
  kessin1(g) {
    const skin = 0xb71c1c, armor = 0x212121, gold = 0xffc107;
    legs(g, armor, 0.75, 0.22, 0.26);
    g.box(0.85, 0.85, 0.5, armor, 0, 1.2, 0);
    g.box(0.5, 0.3, 0.52, skin, 0, 1.25, 0.02);
    g.box(0.35, 0.22, 0.35, gold, 0.5, 1.6, 0);
    g.box(0.35, 0.22, 0.35, gold, -0.5, 1.6, 0);
    g.setPart(Part.Team, 0, 0, 0).box(0.9, 1.3, 0.06, 0x4a0000, 0, 1.0, -0.3, -0.12);
    g.setPart(Part.Body);
    arms(g, skin, 1.55, 0.58, 0.7, 0.22);
    rightHand(g, 1.55, 0.58, 0.7, (g, x, y) => {
      g.shape([[-0.08, 0], [0.08, 0], [0.12, 1.2], [0, 1.45], [-0.12, 1.2]], 0.05, 0x263238, x, y, 0.1, Math.PI / 2, 0, 0);
      g.box(0.35, 0.06, 0.08, gold, x, y, 0.1);
    });
    g.box(0.45, 0.48, 0.42, skin, 0, 1.9, 0.04);
    g.cone(0.1, 0.6, 5, 0x1a1a1a, 0.3, 2.3, 0, 0.3, 0, -0.6);
    g.cone(0.1, 0.6, 5, 0x1a1a1a, -0.3, 2.3, 0, 0.3, 0, 0.6);
    eyes(g, 1.95, 0.26, 0.11, 0xffeb3b, 0.06);
  },
  kessin2(g) {
    MODELS.kessin1(g);
    wings(g, 0x4a0000, 1.6, 1.8, -0.25, true);
  },
  kessin3(g) {
    const skin = 0x7f0000, lava = 0xff6f00;
    legs(g, 0x3e0000, 0.8, 0.3, 0.34);
    g.ball(0.75, skin, 0, 1.45, 0, 1, 1, 0.85);
    g.box(0.5, 0.08, 0.08, lava, 0, 1.5, 0.62, 0, 0, 0.4);
    g.box(0.4, 0.08, 0.08, lava, 0.1, 1.25, 0.62, 0, 0, -0.5);
    arms(g, skin, 1.85, 0.8, 0.95, 0.3);
    g.setPart(Part.ArmR, -0.8, 1.85, 0).ball(0.26, skin, -0.8, 0.85, 0.05);
    g.setPart(Part.ArmL, 0.8, 1.85, 0).ball(0.26, skin, 0.8, 0.85, 0.05);
    g.setPart(Part.Body);
    g.box(0.6, 0.55, 0.55, skin, 0, 2.25, 0.15);
    for (const s of [1, -1]) {
      g.cone(0.14, 0.8, 5, 0x111111, s * 0.4, 2.75, 0.1, 0.2, 0, -s * 0.7);
      g.cone(0.1, 0.5, 5, 0x111111, s * 0.25, 2.65, -0.15, -0.5, 0, -s * 0.3);
    }
    g.ball(0.11, lava, 0.17, 2.3, 0.44);
    g.ball(0.11, lava, -0.17, 2.3, 0.44);
    wings(g, 0x3e0000, 2.0, 1.9, -0.35, true);
  },
};

const cache = new Map<string, THREE.BufferGeometry>();

/** Sac d'or porté sur le dos du chapardeur en fuite (repère de l'ennemi, face +z). */
export function lootSackGeometry(): THREE.BufferGeometry {
  let g = cache.get('#sack');
  if (!g) {
    const b = new GB(7);
    b.ball(0.42, 0x8d6e47, 0, 0.82, -0.42);
    b.ball(0.3, 0x7a5c3a, 0, 1.16, -0.44);
    b.cyl(0.13, 0.13, 0.1, 8, 0x5d4037, 0, 1.38, -0.44);
    for (const [x, y, z] of [[0.1, 1.46, -0.38], [-0.09, 1.48, -0.5], [0, 1.54, -0.42]] as const) b.cyl(0.1, 0.1, 0.035, 10, 0xffc928, x, y, z, 0.4, 0, 0.3);
    g = b.build();
    cache.set('#sack', g);
  }
  return g;
}

export function enemyGeometry(id: string): THREE.BufferGeometry {
  let g = cache.get(id);
  if (!g) {
    const b = new GB(id.length * 97 + 13);
    (MODELS[id] ?? MODELS.gobelin)(b);
    g = b.build();
    cache.set(id, g);
  }
  return g;
}

/** Hauteur de vol des ennemis volants. */
export const FLY_HEIGHT = 2.4;
