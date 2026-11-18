import { EF_FLYING, ENEMIES, HERO_UNIT, Snapshot, UF_DEAD, type RuntimeMap } from '@dfend/shared';
import { FLY_HEIGHT } from '../art/enemies';

const N = 65536;

/** Image interpolée prête pour le rendu (structure de tableaux réutilisée). */
export class Frame {
  eN = 0;
  eId = new Uint16Array(2048);
  eType = new Uint8Array(2048);
  eX = new Float32Array(2048);
  eY = new Float32Array(2048);
  eZ = new Float32Array(2048);
  eDx = new Float32Array(2048);
  eDz = new Float32Array(2048);
  eHp = new Float32Array(2048);
  eFlags = new Uint8Array(2048);
  uN = 0;
  uId = new Uint16Array(512);
  uKind = new Uint8Array(512);
  uOwner = new Uint8Array(512);
  uX = new Float32Array(512);
  uZ = new Float32Array(512);
  uDx = new Float32Array(512);
  uDz = new Float32Array(512);
  uHp = new Float32Array(512);
  uFlags = new Uint8Array(512);
  uTarget = new Uint16Array(512);
  /** id -> index dans la frame */
  eIndex = new Int32Array(N).fill(-1);
  uIndex = new Int32Array(N).fill(-1);
  private eStamp = new Uint32Array(N);
  private uStamp = new Uint32Array(N);
  stamp = 1;

  begin() {
    this.stamp++;
    this.eN = 0;
    this.uN = 0;
  }
  enemyIdx(id: number) {
    return this.eStamp[id] === this.stamp ? this.eIndex[id] : -1;
  }
  unitIdx(id: number) {
    return this.uStamp[id] === this.stamp ? this.uIndex[id] : -1;
  }
  markE(id: number, i: number) {
    this.eStamp[id] = this.stamp;
    this.eIndex[id] = i;
  }
  markU(id: number, i: number) {
    this.uStamp[id] = this.stamp;
    this.uIndex[id] = i;
  }
}

const POOL = 10;
const tmp = { x: 0, z: 0 };
const dir = { x: 0, z: 0 };

export class Interp {
  private pool: Snapshot[] = [];
  /** snapshots triés par tick croissant */
  buf: Snapshot[] = [];
  renderTick = 0;
  latest: Snapshot | null = null;
  frame = new Frame();
  private aMapE = new Int32Array(N);
  private aStampE = new Uint32Array(N);
  private aMapU = new Int32Array(N);
  private aStampU = new Uint32Array(N);
  private aStamp = 0;
  private lastA: Snapshot | null = null;
  pendingEvents: { tick: number; ev: number[] }[] = [];
  delayTicks: number;
  /** temps écoulé depuis l'arrivée du dernier snapshot (s) */
  private since = 0;

  constructor(private map: RuntimeMap, local: boolean) {
    for (let i = 0; i < POOL; i++) this.pool.push(new Snapshot());
    this.delayTicks = local ? 1.8 : 2.4;
  }

  push(data: ArrayBuffer) {
    let s: Snapshot;
    if (this.buf.length >= POOL - 1) s = this.buf.shift()!;
    else s = this.pool.pop() ?? this.buf.shift()!;
    s.decode(data);
    if (this.latest && s.tick <= this.latest.tick) {
      // snapshot en retard : ignoré
      this.pool.push(s);
      return;
    }
    this.buf.push(s);
    this.latest = s;
    this.since = 0;
    for (const ev of s.events) this.pendingEvents.push({ tick: s.tick, ev });
    if (this.buf.length === 1) this.renderTick = s.tick - this.delayTicks;
  }

  /** Avance l'horloge de rendu et construit la frame interpolée. */
  update(dt: number, paused: boolean): Frame | null {
    const L = this.latest;
    if (!L) return null;
    const speed = L.speed || 1;
    if (!paused) {
      this.renderTick += dt * 20 * speed;
      this.since += dt;
    }
    // tick serveur estimé : le dernier reçu + le temps écoulé depuis son arrivée. Se recaler sur le tick brut
    // (qui avance par sauts à chaque snapshot) faisait accélérer et ralentir le rendu en dents de scie.
    const est = L.tick + Math.min(this.since * 20 * speed, 2);
    const target = est - this.delayTicks * speed;
    const diff = target - this.renderTick;
    if (Math.abs(diff) > 8) this.renderTick = target;
    else if (!paused) this.renderTick += diff * Math.min(1, dt * 0.8);
    if (this.renderTick > L.tick) this.renderTick = L.tick;

    let A = this.buf[0], B: Snapshot | null = null;
    for (let i = 0; i < this.buf.length; i++) {
      if (this.buf[i].tick <= this.renderTick) A = this.buf[i];
      else { B = this.buf[i]; break; }
    }
    if (!B) B = A;
    const alpha = B === A ? 1 : Math.max(0, Math.min(1, (this.renderTick - A.tick) / (B.tick - A.tick)));
    this.build(A, B, alpha);
    return this.frame;
  }

  private build(A: Snapshot, B: Snapshot, t: number) {
    const f = this.frame;
    f.begin();
    if (A !== this.lastA) {
      this.lastA = A;
      this.aStamp++;
      for (let i = 0; i < A.eCount; i++) { this.aMapE[A.eId[i]] = i; this.aStampE[A.eId[i]] = this.aStamp; }
      for (let i = 0; i < A.uCount; i++) { this.aMapU[A.uId[i]] = i; this.aStampU[A.uId[i]] = this.aStamp; }
    }
    const paths = this.map.paths;
    for (let i = 0; i < B.eCount; i++) {
      const id = B.eId[i];
      let dist = B.eDist[i], lane = B.eLane[i];
      if (this.aStampE[id] === this.aStamp) {
        const j = this.aMapE[id];
        if (A.ePath[j] === B.ePath[i] && Math.abs(A.eDist[j] - dist) < 3) {
          dist = A.eDist[j] + (dist - A.eDist[j]) * t;
          lane = A.eLane[j] + (lane - A.eLane[j]) * t;
        }
      }
      const p = paths[B.ePath[i]] ?? paths[0];
      p.at(dist, lane, tmp);
      p.dir(dist, dir);
      const k = f.eN++;
      f.eId[k] = id;
      f.eType[k] = B.eType[i];
      f.eX[k] = tmp.x;
      f.eZ[k] = tmp.z;
      f.eY[k] = B.eFlags[i] & EF_FLYING ? FLY_HEIGHT + (ENEMIES[B.eType[i]]?.boss ? 1 : 0) : 0;
      f.eDx[k] = dir.x;
      f.eDz[k] = dir.z;
      f.eHp[k] = B.eHp[i];
      f.eFlags[k] = B.eFlags[i];
      f.markE(id, k);
      if (f.eN >= f.eId.length) break;
    }
    for (let i = 0; i < B.uCount; i++) {
      const id = B.uId[i];
      let x = B.uX[i], z = B.uZ[i];
      let dx = 0, dz = 0;
      if (this.aStampU[id] === this.aStamp) {
        const j = this.aMapU[id];
        dx = x - A.uX[j];
        dz = z - A.uZ[j];
        // un saut (réapparition) n'est pas interpolé ; la charge du héros (7 m d'un coup) l'est, pour qu'on la voie foncer
        const jump = B.uKind[i] === HERO_UNIT && !(A.uFlags[j] & UF_DEAD) && !(B.uFlags[i] & UF_DEAD) ? 64 : 16;
        if (dx * dx + dz * dz < jump) { x = A.uX[j] + dx * t; z = A.uZ[j] + dz * t; }
      }
      const k = f.uN++;
      f.uId[k] = id;
      f.uKind[k] = B.uKind[i];
      f.uOwner[k] = B.uOwner[i];
      f.uX[k] = x;
      f.uZ[k] = z;
      f.uDx[k] = dx;
      f.uDz[k] = dz;
      f.uHp[k] = B.uHp[i];
      f.uFlags[k] = B.uFlags[i];
      f.uTarget[k] = B.uTarget[i];
      f.markU(id, k);
      if (f.uN >= f.uId.length) break;
    }
  }

  /** Événements dont le tick est atteint par l'horloge de rendu. */
  dueEvents(out: { tick: number; ev: number[] }[]) {
    out.length = 0;
    let w = 0;
    for (const e of this.pendingEvents) {
      if (e.tick <= this.renderTick + 0.5) out.push(e);
      else this.pendingEvents[w++] = e;
    }
    this.pendingEvents.length = w;
    return out;
  }
}

export { HERO_UNIT };
