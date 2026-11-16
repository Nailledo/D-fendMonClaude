/** Chemin échantillonné uniformément (pas fixe) pour des recherches O(1). */
export const PATH_STEP = 0.25;

export class SampledPath {
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  /** normales (gauche) */
  readonly nx: Float64Array;
  readonly nz: Float64Array;
  readonly length: number;
  readonly count: number;

  constructor(ctrl: [number, number][]) {
    // 1) Catmull-Rom dense
    const dense: number[] = [];
    const n = ctrl.length;
    const get = (i: number) => ctrl[Math.max(0, Math.min(n - 1, i))];
    const SUB = 16;
    for (let i = 0; i < n - 1; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let s = 0; s < SUB; s++) {
        const t = s / SUB, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const z = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        dense.push(x, z);
      }
    }
    dense.push(ctrl[n - 1][0], ctrl[n - 1][1]);
    // 2) longueurs cumulées
    const m = dense.length / 2;
    const cum = new Float64Array(m);
    for (let i = 1; i < m; i++) {
      const dx = dense[i * 2] - dense[i * 2 - 2], dz = dense[i * 2 + 1] - dense[i * 2 - 1];
      cum[i] = cum[i - 1] + Math.sqrt(dx * dx + dz * dz);
    }
    this.length = cum[m - 1];
    // 3) rééchantillonnage uniforme
    this.count = Math.floor(this.length / PATH_STEP) + 2;
    this.xs = new Float64Array(this.count);
    this.zs = new Float64Array(this.count);
    let j = 0;
    for (let k = 0; k < this.count; k++) {
      const d = Math.min(k * PATH_STEP, this.length);
      while (j < m - 2 && cum[j + 1] < d) j++;
      const seg = cum[j + 1] - cum[j] || 1;
      const t = (d - cum[j]) / seg;
      this.xs[k] = dense[j * 2] + (dense[j * 2 + 2] - dense[j * 2]) * t;
      this.zs[k] = dense[j * 2 + 1] + (dense[j * 2 + 3] - dense[j * 2 + 1]) * t;
    }
    this.nx = new Float64Array(this.count);
    this.nz = new Float64Array(this.count);
    for (let k = 0; k < this.count; k++) {
      const a = Math.max(0, k - 2), b = Math.min(this.count - 1, k + 2);
      let tx = this.xs[b] - this.xs[a], tz = this.zs[b] - this.zs[a];
      const l = Math.sqrt(tx * tx + tz * tz) || 1;
      tx /= l; tz /= l;
      this.nx[k] = -tz;
      this.nz[k] = tx;
    }
  }

  /** Position à la distance d avec décalage latéral. Écrit dans out[0], out[1]. */
  at(d: number, lateral: number, out: { x: number; z: number }) {
    if (d <= 0) d = 0;
    const f = d / PATH_STEP;
    let i = Math.floor(f);
    if (i >= this.count - 1) i = this.count - 2;
    const t = Math.min(1, f - i);
    const x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t;
    const z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t;
    out.x = x + this.nx[i] * lateral;
    out.z = z + this.nz[i] * lateral;
    return out;
  }

  /** Direction (tangente) à la distance d. */
  dir(d: number, out: { x: number; z: number }) {
    let i = Math.floor(Math.max(0, d) / PATH_STEP);
    if (i >= this.count - 1) i = this.count - 2;
    out.x = this.nz[i];
    out.z = -this.nx[i];
    return out;
  }

  /** Distance minimale au carré d'un point au chemin (échantillonnage grossier). */
  minDist2(x: number, z: number, stride = 4): number {
    let best = Infinity;
    for (let k = 0; k < this.count; k += stride) {
      const dx = this.xs[k] - x, dz = this.zs[k] - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return best;
  }

  /** Distance le long du chemin du point échantillonné le plus proche. */
  project(x: number, z: number): { d: number; dist2: number } {
    let best = Infinity, bi = 0;
    for (let k = 0; k < this.count; k++) {
      const dx = this.xs[k] - x, dz = this.zs[k] - z;
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = k; }
    }
    return { d: bi * PATH_STEP, dist2: best };
  }
}
