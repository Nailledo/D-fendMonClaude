import * as THREE from 'three';
import { GB, Part } from './builder';

/**
 * Armes des héros importés (les modèles GLB n'en ont pas) : épée, arc, marteau, bâton.
 * Chaque arme est une géométrie séparée, dessinée avec la même instance que le héros :
 * ses sommets portent la partie 10 (main droite) ou 11 (main gauche), le pivot = la main
 * et `aWeight` = la longueur du bras (l'épaule est juste au-dessus). Le vertex shader
 * applique d'abord le poignet (orientation de l'arme) puis le mouvement du bras : l'arme reste en main.
 */
export const WEAPON_R = 10;
export const WEAPON_L = 11;

/**
 * Armes tenues selon la classe du héros (ClassDef.weapon) :
 * 1 épée longue (épéiste), 2 arc (archer), 3 marteau et bouclier (gardien), 4 bâton à orbe (mage),
 * 5 bâton à crâne (nécromancien), 6 lance-fioles (artificier), 7 épée courte (aventurier).
 */
export const WEAPON_KINDS = 7;
/** style d'animation de chaque arme (voir le vertex shader) : 1 épée, 2 arc, 3 marteau, 4 bâton */
export const WEAPON_STYLE = [0, 1, 2, 3, 4, 5, 6, 1];
/** arme par défaut (Aventurier) */
export const DEFAULT_WEAPON = 7;

interface Arm {
  /** épaule (pivot du bras) */
  sh: [number, number, number];
  /** main : bas du bras */
  hand: [number, number, number];
}

/** Épaule et main d'un bras (partie 3 ou 4) lus dans les attributs du modèle. */
function armOf(geo: THREE.BufferGeometry, part: number): Arm | null {
  const pos = geo.getAttribute('position');
  const anim = geo.getAttribute('aAnim');
  if (!pos || !anim) return null;
  let minY = Infinity, n = 0;
  const sh: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    if (Math.round(anim.getX(i)) !== part) continue;
    if (!n) { sh[0] = anim.getY(i); sh[1] = anim.getZ(i); sh[2] = anim.getW(i); }
    n++;
    minY = Math.min(minY, pos.getY(i));
  }
  if (!n) return null;
  // la main : moyenne des sommets les plus bas du bras
  let hx = 0, hz = 0, m = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.round(anim.getX(i)) !== part || pos.getY(i) > minY + 0.06) continue;
    hx += pos.getX(i); hz += pos.getZ(i); m++;
  }
  return { sh, hand: [hx / m, minY + 0.05, hz / m] };
}

/** Arc de cercle approché par des segments (dans le plan YZ), de (y0, z0) à (y1, z1). */
function limb(g: GB, pts: [number, number][], x: number, oy: number, oz: number, w: number, c: number) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [y0, z0] = pts[k], [y1, z1] = pts[k + 1];
    const dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    g.box(w, len + w * 0.6, w, c, x, oy + (y0 + y1) / 2, oz + (z0 + z1) / 2, Math.atan2(dz, dy));
  }
}

/** Arme `kind` ajustée à la main du modèle `geo` (apparence `id`) ; null si le modèle n'a pas de bras. */
export function heroWeapon(id: string, geo: THREE.BufferGeometry, kind = DEFAULT_WEAPON): THREE.BufferGeometry | null {
  const style = WEAPON_STYLE[kind];
  if (!style) return null;
  const left = style === 2;
  const arm = armOf(geo, left ? Part.ArmL : Part.ArmR);
  if (!arm) return null;
  const [hx, hy, hz] = arm.hand;
  const g = new GB(id.length * 17 + 5 + kind * 101);
  g.ao = false;
  g.jitter = 0.04;
  // pivot du poignet sous l'épaule (même axe de rotation que le bras), arme placée à la vraie main
  g.setPart(left ? WEAPON_L : WEAPON_R, arm.sh[0], hy, arm.sh[2]);
  if (kind === 1) {
    // épée longue : lame large à gouttière, garde dorée recourbée, gemme bleue, pommeau
    g.box(0.045, 0.22, 0.045, 0x3e2723, hx, hy - 0.02, hz);
    g.ball(0.04, 0xc9a227, hx, hy - 0.15, hz);
    g.box(0.07, 0.04, 0.28, 0xc9a227, hx, hy + 0.1, hz);
    g.cone(0.03, 0.08, 4, 0xc9a227, hx, hy + 0.13, hz + 0.15, 0.6, 0, 0);
    g.cone(0.03, 0.08, 4, 0xc9a227, hx, hy + 0.13, hz - 0.15, -0.6, 0, 0);
    g.ball(0.03, 0x3b82f6, hx + 0.035, hy + 0.1, hz, 1, 1, 1, 1);
    g.box(0.026, 0.72, 0.09, 0xe3eaee, hx, hy + 0.48, hz);
    g.box(0.03, 0.62, 0.02, 0x9fb3bf, hx, hy + 0.45, hz);
    g.cone(0.064, 0.13, 4, 0xe3eaee, hx, hy + 0.9, hz, 0, Math.PI / 4, 0);
  } else if (kind === 2) {
    // arc : branches courbées vers l'avant, corde tendue entre les pointes, poignée en cuir
    const pts: [number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const v = -1 + (k / 8) * 2;
      pts.push([v * 0.46, 0.08 - 0.15 * v * v]);
    }
    limb(g, pts, hx, hy, hz, 0.04, 0x8d5a2b);
    g.box(0.05, 0.12, 0.055, 0x4e342e, hx, hy, hz + 0.08);
    g.ball(0.025, 0xd7b46a, hx, hy + 0.46, hz - 0.07);
    g.ball(0.025, 0xd7b46a, hx, hy - 0.46, hz - 0.07);
    g.box(0.008, 0.92, 0.008, 0xf5f0dc, hx, hy, hz - 0.07);
  } else if (kind === 3) {
    // gardien : marteau de guerre à deux têtes...
    g.cyl(0.032, 0.036, 0.62, 6, 0x5d4037, hx, hy + 0.18, hz);
    g.box(0.07, 0.05, 0.07, 0x3e2723, hx, hy - 0.12, hz);
    g.box(0.19, 0.19, 0.36, 0x78909c, hx, hy + 0.54, hz);
    g.box(0.21, 0.05, 0.38, 0x37474f, hx, hy + 0.54, hz);
    g.box(0.16, 0.16, 0.05, 0xb0bec5, hx, hy + 0.54, hz + 0.19);
    g.box(0.16, 0.16, 0.05, 0xb0bec5, hx, hy + 0.54, hz - 0.19);
    g.cone(0.05, 0.12, 4, 0xb0bec5, hx, hy + 0.7, hz);
    // ... et grand bouclier au bras gauche
    const al = armOf(geo, Part.ArmL);
    if (al) {
      const [lx, ly, lz] = al.hand;
      g.setPart(WEAPON_L, al.sh[0], ly, al.sh[2]);
      const ox = lx + Math.sign(lx || -1) * 0.07;
      g.box(0.05, 0.56, 0.4, 0x546e7a, ox, ly + 0.12, lz + 0.04);
      g.box(0.06, 0.6, 0.06, 0xc9a227, ox, ly + 0.12, lz + 0.04);
      g.box(0.06, 0.06, 0.44, 0xc9a227, ox, ly + 0.2, lz + 0.04);
      g.box(0.055, 0.5, 0.03, 0x37474f, ox, ly + 0.12, lz + 0.24);
      g.box(0.055, 0.5, 0.03, 0x37474f, ox, ly + 0.12, lz - 0.16);
      g.ball(0.05, 0xdfe6ea, ox + Math.sign(lx || -1) * 0.03, ly + 0.2, lz + 0.04);
    }
  } else if (kind === 4) {
    // mage : bâton noueux, croissant d'argent et orbe de cristal violet
    g.cyl(0.022, 0.03, 1.0, 5, 0x6d4c41, hx, hy + 0.2, hz);
    g.box(0.06, 0.05, 0.06, 0xc9a227, hx, hy + 0.66, hz);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI * (0.15 + (k / 6) * 1.7);
      pts.push([0.8 + Math.sin(a) * -0.11, Math.cos(a) * 0.11]);
    }
    limb(g, pts, hx, hy, hz, 0.025, 0xcfd8dc);
    g.ball(0.085, 0xb46cff, hx, hy + 0.8, hz, 1, 1, 1, 1);
    g.ball(0.04, 0xf3e5ff, hx + 0.02, hy + 0.83, hz + 0.03);
    g.cone(0.02, 0.07, 4, 0xb46cff, hx, hy + 0.96, hz);
  } else if (kind === 5) {
    // nécromancien : bâton sombre, griffes d'os, petit crâne et orbe vert
    g.cyl(0.022, 0.028, 0.95, 5, 0x3e2723, hx, hy + 0.18, hz);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      g.cone(0.025, 0.14, 4, 0xd7ccc8, hx + Math.cos(a) * 0.05, hy + 0.7, hz + Math.sin(a) * 0.05, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    g.ball(0.075, 0x9cff57, hx, hy + 0.73, hz, 1, 1, 1, 1);
    g.ball(0.04, 0xe8ffd0, hx, hy + 0.74, hz + 0.03);
    g.ball(0.06, 0xece3d0, hx, hy + 0.56, hz + 0.02);
    g.box(0.05, 0.03, 0.05, 0xece3d0, hx, hy + 0.5, hz + 0.03);
    g.box(0.02, 0.02, 0.02, 0x1b1b1b, hx - 0.02, hy + 0.57, hz + 0.075);
    g.box(0.02, 0.02, 0.02, 0x1b1b1b, hx + 0.02, hy + 0.57, hz + 0.075);
    g.box(0.06, 0.04, 0.06, 0x7c3aed, hx, hy + 0.44, hz);
  } else if (kind === 6) {
    // artificier : lance-fioles en laiton, rouages et ballon de verre bouillonnant
    g.cyl(0.03, 0.034, 0.62, 6, 0xb08d57, hx, hy + 0.14, hz);
    g.box(0.06, 0.08, 0.06, 0x4e342e, hx, hy - 0.08, hz);
    g.cyl(0.07, 0.07, 0.03, 8, 0x8d6e63, hx, hy + 0.32, hz, Math.PI / 2, 0, 0);
    g.cyl(0.055, 0.055, 0.035, 8, 0xc9a227, hx, hy + 0.32, hz + 0.02, Math.PI / 2, 0, 0);
    g.cyl(0.05, 0.06, 0.08, 6, 0xb08d57, hx, hy + 0.48, hz);
    g.ball(0.1, 0x2dd4bf, hx, hy + 0.6, hz, 1, 1, 1, 1);
    g.ball(0.035, 0xccfbf1, hx + 0.03, hy + 0.64, hz + 0.05);
    g.cyl(0.025, 0.03, 0.08, 6, 0xe0f2f1, hx, hy + 0.72, hz);
    g.box(0.05, 0.03, 0.05, 0x8d6e63, hx, hy + 0.77, hz);
  } else {
    // aventurier : épée courte toute simple, garde en bois
    g.box(0.04, 0.14, 0.04, 0x6d4c41, hx, hy - 0.01, hz);
    g.ball(0.03, 0x8d6e63, hx, hy - 0.09, hz);
    g.box(0.05, 0.035, 0.16, 0x795548, hx, hy + 0.07, hz);
    g.box(0.02, 0.38, 0.065, 0xcfd8dc, hx, hy + 0.28, hz);
    g.cone(0.046, 0.08, 4, 0xcfd8dc, hx, hy + 0.51, hz, 0, Math.PI / 4, 0);
  }
  const out = g.build();
  // aWeight des parties armes = longueur du bras (main → épaule)
  out.setAttribute('aWeight', new THREE.Float32BufferAttribute(new Float32Array(g.vertexCount).fill(arm.sh[1] - hy), 1));
  return out;
}
