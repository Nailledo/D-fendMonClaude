import * as THREE from 'three';

/**
 * Machines de guerre importées (tours d'artillerie, tourelle de l'artificier), découpées par
 * `pnpm models:machines` : parties 12 tête orientable, 13/14 canons droit/gauche, 15 bras de catapulte.
 * On en tire deux géométries (socle fixe, tête qui pivote vers la cible) et les repères des tirs.
 */
export const PART_HEAD = 12, PART_BARREL_R = 13, PART_BARREL_L = 14, PART_ARM = 15;

export interface Muzzle { x: number; y: number; z: number }

/** Bras de catapulte (repère du modèle) : pivot, siège du rocher dans le godet. */
export interface CatapultArm {
  pivotY: number;
  pivotZ: number;
  seatY: number;
  seatZ: number;
  /** rayon du rocher posé dans le godet */
  rockR: number;
}

export interface Machine {
  base: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  /** bouches des canons (partie 13 puis 14), repère du modèle ; une seule pour une glissière ou une catapulte */
  muzzles: Muzzle[];
  arm: CatapultArm | null;
}

const cache = new WeakMap<THREE.BufferGeometry, Machine | null>();

/** Sépare un modèle cuit en socle + tête, ou null s'il n'a pas de tête orientable. */
export function machineOf(geo: THREE.BufferGeometry): Machine | null {
  if (cache.has(geo)) return cache.get(geo)!;
  let m: Machine | null = null;
  const anim = geo.getAttribute('aAnim');
  if (anim && geo.index) {
    const idx = geo.index.array;
    const base: number[] = [], head: number[] = [];
    for (let t = 0; t < idx.length; t += 3) (Math.round(anim.getX(idx[t])) >= PART_HEAD ? head : base).push(idx[t], idx[t + 1], idx[t + 2]);
    if (head.length && base.length) {
      const make = (list: number[]) => {
        const g = new THREE.BufferGeometry();
        for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a);
        g.setIndex(list);
        g.computeBoundingSphere();
        return g;
      };
      m = { base: make(base), head: make(head), muzzles: muzzles(geo), arm: armOf(geo) };
    }
  }
  cache.set(geo, m);
  return m;
}

/** Bouche de chaque canon : centre de sa section, au bout avant (z max). */
function muzzles(geo: THREE.BufferGeometry): Muzzle[] {
  const anim = geo.getAttribute('aAnim'), pos = geo.attributes.position;
  const out: Muzzle[] = [];
  for (const part of [PART_BARREL_R, PART_BARREL_L]) {
    const b = new THREE.Box3();
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.round(anim.getX(i)) !== part) continue;
      b.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      n++;
    }
    if (n) out.push({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: b.max.z });
  }
  return out;
}

/** Bras de catapulte : le godet est la pièce la plus large du bras (la poutre et le moyeu sont étroits). */
function armOf(geo: THREE.BufferGeometry): CatapultArm | null {
  const anim = geo.getAttribute('aAnim'), pos = geo.attributes.position;
  let pivotY = 0, pivotZ = 0, n = 0, wide = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.round(anim.getX(i)) !== PART_ARM) continue;
    pivotY = anim.getZ(i); pivotZ = anim.getW(i); n++;
    wide = Math.max(wide, Math.abs(pos.getX(i)));
  }
  if (!n) return null;
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) {
    if (Math.round(anim.getX(i)) !== PART_ARM || Math.abs(pos.getX(i)) < wide * 0.6) continue;
    b.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  }
  const rockR = (b.max.x - b.min.x) * 0.27;
  return { pivotY, pivotZ, seatY: b.max.y - rockR * 0.35, seatZ: (b.min.z + b.max.z) / 2, rockR };
}

// ---------------------------------------------------------------- lancer de la catapulte

/** angle du bras au lâcher (rad, vers l'avant), durée du lancer avant le lâcher (s) */
export const ARM_RELEASE = 1.75;
export const ARM_THROW = 0.16;
const ARM_SETTLE = 0.3, ARM_HOLD = 0.45, ARM_RESET = 1.15, ARM_RELOAD = 1.25;

/**
 * Angle du bras `ft` secondes après le début du lancer, parti de l'angle `from` :
 * bascule accélérée jusqu'au lâcher, rebond contre la butée, pause, puis treuil qui le ramène en arrière.
 */
export function armAngle(ft: number, from: number): number {
  if (ft < 0) return from;
  if (ft < ARM_THROW) { const u = ft / ARM_THROW; return from + (ARM_RELEASE - from) * u * u; }
  if (ft < ARM_SETTLE) return ARM_RELEASE + 0.14 * Math.sin(((ft - ARM_THROW) / (ARM_SETTLE - ARM_THROW)) * Math.PI);
  if (ft < ARM_HOLD) return ARM_RELEASE;
  if (ft < ARM_RESET) { const u = (ft - ARM_HOLD) / (ARM_RESET - ARM_HOLD); return ARM_RELEASE * (1 - u * u * (3 - 2 * u)); }
  return 0;
}

/** Taille du rocher dans le godet (0 = vide) : présent pendant le lancer, rechargé après le retour du bras. */
export function rockLoaded(ft: number): number {
  if (ft < ARM_THROW) return 1;
  if (ft < ARM_RELOAD) return 0;
  const u = Math.min(1, (ft - ARM_RELOAD) / 0.2);
  return 1 - (1 - u) * (1 - u);
}

/** Position du siège du godet (repère du modèle) pour un angle de bras donné. */
export function seatAt(arm: CatapultArm, angle: number, out: Muzzle): Muzzle {
  // même rotation que le shader : rotX autour du pivot (y, z) → (c·y − s·z, s·y + c·z)
  const y = arm.seatY - arm.pivotY, z = arm.seatZ - arm.pivotZ;
  const c = Math.cos(angle), s = Math.sin(angle);
  out.x = 0;
  out.y = arm.pivotY + c * y - s * z;
  out.z = arm.pivotZ + s * y + c * z;
  return out;
}
