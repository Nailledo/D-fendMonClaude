/**
 * Phase de marche cumulée image par image (radians), transmise au shader à la place d'une vitesse.
 * Le shader calculait sin(temps × cadence) : chaque changement de cadence (ralenti, arrêt, reprise)
 * faisait sauter les jambes d'une pose à l'autre. Ici la phase avance au rythme du pas,
 * démarre jambes jointes et, à l'arrêt, termine le pas en cours avant de revenir au repos.
 * 0 = immobile ; sinon la phase est toujours ≥ π.
 */
const TAU = Math.PI * 2;

export function stride(phase: number, rate: number, dt: number): number {
  let p = phase;
  if (rate > 0.05) {
    if (p === 0) p = Math.PI;
    p += rate * dt;
  } else if (p !== 0) {
    // fin du pas : jusqu'au prochain multiple de π (jambes jointes), puis repos
    const next = Math.ceil(p / Math.PI - 1e-4) * Math.PI;
    p += 9 * dt;
    if (p >= next) return 0;
  }
  if (p > 2000) p -= Math.floor((p - Math.PI) / TAU) * TAU;
  return p;
}

/** Vitesse au sol mesurée d'une entité (lissée), à partir de sa position d'une image à l'autre. */
export class GroundSpeed {
  private px: Float32Array;
  private pz: Float32Array;
  private v: Float32Array;
  private seen: Uint32Array;
  constructor(n: number) {
    this.px = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.v = new Float32Array(n);
    this.seen = new Uint32Array(n);
  }
  /** frame : numéro d'image ; une entité absente à l'image précédente repart de zéro */
  measure(id: number, x: number, z: number, dt: number, frame: number, max: number): number {
    const fresh = this.seen[id] !== frame - 1;
    this.seen[id] = frame;
    const dx = x - this.px[id], dz = z - this.pz[id];
    this.px[id] = x;
    this.pz[id] = z;
    if (fresh || dt <= 0) return (this.v[id] = 0);
    const inst = Math.min(max, Math.sqrt(dx * dx + dz * dz) / dt);
    this.v[id] += (inst - this.v[id]) * Math.min(1, dt * 8);
    return this.v[id];
  }
}
