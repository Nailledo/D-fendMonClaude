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

/** style d'animation de chaque héros (voir le vertex shader) */
export const HERO_STYLE: Record<string, number> = { samuel: 1, lyra: 2, brom: 3, nox: 4 };

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

/** Arme du héros `id` ajustée à la main du modèle `geo` ; null si le héros n'a pas d'arme prévue. */
export function heroWeapon(id: string, geo: THREE.BufferGeometry, style = HERO_STYLE[id]): THREE.BufferGeometry | null {
  if (!style) return null;
  const left = style === 2;
  const arm = armOf(geo, left ? Part.ArmL : Part.ArmR);
  if (!arm) return null;
  const [hx, hy, hz] = arm.hand;
  const g = new GB(id.length * 17 + 5 + style * 101);
  g.ao = false;
  g.jitter = 0.04;
  // pivot du poignet sous l'épaule (même axe de rotation que le bras), arme placée à la vraie main
  g.setPart(left ? WEAPON_L : WEAPON_R, arm.sh[0], hy, arm.sh[2]);
  if (style === 1) {
    // épée : lame droite, garde dorée, pommeau
    g.box(0.045, 0.16, 0.045, 0x5d4037, hx, hy - 0.01, hz);
    g.ball(0.035, 0xc9a227, hx, hy - 0.1, hz);
    g.box(0.06, 0.035, 0.2, 0xc9a227, hx, hy + 0.08, hz);
    g.box(0.022, 0.5, 0.075, 0xdfe6ea, hx, hy + 0.35, hz);
    g.box(0.026, 0.42, 0.018, 0xb0bec5, hx, hy + 0.33, hz);
    g.cone(0.054, 0.1, 4, 0xdfe6ea, hx, hy + 0.65, hz, 0, Math.PI / 4, 0);
  } else if (style === 2) {
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
  } else if (style === 3) {
    // marteau de forgeron : long manche, tête massive cerclée
    g.cyl(0.03, 0.035, 0.66, 6, 0x6d4c41, hx, hy + 0.2, hz);
    g.box(0.07, 0.05, 0.07, 0x3e2723, hx, hy - 0.12, hz);
    g.box(0.17, 0.17, 0.32, 0x607d8b, hx, hy + 0.56, hz);
    g.box(0.19, 0.04, 0.34, 0x37474f, hx, hy + 0.56, hz);
    g.box(0.15, 0.15, 0.04, 0x90a4ae, hx, hy + 0.56, hz + 0.17);
    g.box(0.15, 0.15, 0.04, 0x90a4ae, hx, hy + 0.56, hz - 0.17);
    g.box(0.05, 0.08, 0.05, 0xff8f00, hx, hy + 0.66, hz);
  } else {
    // bâton de nécromancien : bois sombre, griffes et orbe vert
    g.cyl(0.022, 0.028, 0.95, 5, 0x3e2723, hx, hy + 0.18, hz);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      g.cone(0.025, 0.14, 4, 0xd7ccc8, hx + Math.cos(a) * 0.05, hy + 0.7, hz + Math.sin(a) * 0.05, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    g.ball(0.075, 0x9cff57, hx, hy + 0.73, hz, 1, 1, 1, 1);
    g.ball(0.04, 0xe8ffd0, hx, hy + 0.74, hz + 0.03);
    g.box(0.06, 0.05, 0.06, 0x7c3aed, hx, hy + 0.6, hz);
  }
  const out = g.build();
  // aWeight des parties armes = longueur du bras (main → épaule)
  out.setAttribute('aWeight', new THREE.Float32BufferAttribute(new Float32Array(g.vertexCount).fill(arm.sh[1] - hy), 1));
  return out;
}
