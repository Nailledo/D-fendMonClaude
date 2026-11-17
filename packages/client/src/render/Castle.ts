import type * as THREE from 'three';
import type { Biome } from '@dfend/shared';
import { PORTCULLIS_LIFT, castleGeometry } from '../art/castle';
import { settings } from '../settings';
import type { Fx } from './Fx';
import { InstPool } from './InstPool';

/**
 * Le château au bout du chemin, et ses réactions :
 * - la herse se lève quand des monstres arrivent à la porte, puis retombe derrière eux (avec un rebond) ;
 * - chaque monstre qui entre secoue l'édifice (vibration, teinte rouge, poussière qui tombe des créneaux) ;
 * - les drapeaux flottent ; une cheminée fume, et le château brûle quand les vies s'épuisent.
 */
export class Castle {
  private body: InstPool;
  private gate: InstPool;
  private flagPool: InstPool;
  private flags: [number, number, number, number][];
  private chimneys: [number, number, number][];
  private c: number;
  private s: number;
  private yaw: number;
  /** herse : hauteur, vitesse */
  private lift = 0;
  private liftV = 0;
  /** secousse et teinte rouge (décroissent) */
  private shake = 0;
  private hurt = 0;
  private smokeT = 0;
  private fireT = 0;

  /**
   * (x, z) : centre de la porte ; (dx, dz) : direction du chemin qui entre dans le château.
   * `low` : sortie vers la caméra, château bas (voir castleGeometry).
   */
  constructor(parent: THREE.Object3D, biome: Biome, readonly x: number, readonly z: number, readonly dx: number, readonly dz: number, low = false) {
    const g = castleGeometry(biome, low);
    this.body = new InstPool(g.body, 1, parent, settings.shadows);
    this.gate = new InstPool(g.portcullis, 1, parent, settings.shadows);
    this.flagPool = new InstPool(g.flag, g.flags.length, parent, false);
    this.flags = g.flags;
    this.chimneys = g.chimneys;
    // façade (+z local) tournée vers la carte, à l'opposé de la direction d'entrée
    this.yaw = Math.atan2(-dx, -dz);
    this.c = Math.cos(this.yaw);
    this.s = Math.sin(this.yaw);
    this.update(0, 0, false, 1, null);
  }

  /** repère local → monde */
  private wx(lx: number, lz: number) { return this.x + this.c * lx + this.s * lz; }
  private wz(lx: number, lz: number) { return this.z - this.s * lx + this.c * lz; }

  /** Un monstre vient d'entrer : l'édifice tremble et la herse retombe lourdement. */
  hit(fx: Fx | null) {
    this.shake = Math.min(1.4, this.shake + 0.9);
    this.hurt = 1;
    this.liftV -= 4;
    if (fx) {
      // poussière qui tombe du bloc de la porte, éclats à l'entrée
      fx.burst(this.wx(0, 0.4), 3.6, this.wz(0, 0.4), 10, 0xb8a98f, 2.2, 0.16, 0.9, false, -6);
      fx.smoke(this.wx(0, 0.8), 0.3, this.wz(0, 0.8), 4, 0x9e8f7a, 2.2);
      fx.ring(this.wx(0, 0.6), this.wz(0, 0.6), 3.2, 0xef4444, 0.6, 0.6);
    }
  }

  /**
   * `near` : des monstres sont devant la porte (elle s'ouvre) ; `lives` : fraction de vies restantes (0..1).
   */
  update(dt: number, time: number, near: boolean, lives: number, fx: Fx | null) {
    // herse : ressort amorti vers ouvert / fermé, retombée plus rapide que la levée
    const target = near ? PORTCULLIS_LIFT : 0;
    const k = near ? 26 : 60;
    this.liftV += ((target - this.lift) * k - this.liftV * (near ? 9 : 7)) * dt;
    this.lift += this.liftV * dt;
    if (this.lift < 0) { this.lift = 0; this.liftV = Math.abs(this.liftV) * 0.25; }
    if (this.lift > PORTCULLIS_LIFT + 0.05) { this.lift = PORTCULLIS_LIFT + 0.05; this.liftV = 0; }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.hurt = Math.max(0, this.hurt - dt * 2.5);
    const sh = this.shake * this.shake * 0.12;
    const ox = Math.sin(time * 61) * sh, oz = Math.cos(time * 47) * sh * 0.6;

    this.body.begin();
    const b = this.body.push(this.x + ox, 0, this.z + oz, this.yaw, 1);
    this.body.setTeam(b, 0x1e3a8a);
    if (this.hurt > 0) this.body.setTint(b, 1, 0.25, 0.15, this.hurt * 0.2);
    this.body.end();

    this.gate.begin();
    const gl = this.gate.push(this.wx(0, 0.2) + ox, this.lift, this.wz(0, 0.2) + oz, this.yaw, 1);
    if (this.hurt > 0) this.gate.setTint(gl, 1, 0.3, 0.2, this.hurt * 0.3);
    this.gate.end();

    // drapeaux : le mât pivote doucement au vent, et tressaille quand le château est touché
    this.flagPool.begin();
    this.flags.forEach(([lx, ly, lz, sc], i) => {
      const wind = Math.sin(time * 1.9 + i * 1.7) * 0.28 + Math.sin(time * 4.3 + i) * 0.08 + this.shake * Math.sin(time * 30 + i) * 0.3;
      const f = this.flagPool.push(this.wx(lx, lz) + ox, ly, this.wz(lx, lz) + oz, this.yaw + 0.9 + wind, sc);
      this.flagPool.setTeam(f, 0x1e3a8a);
    });
    this.flagPool.end();

    if (!fx || dt <= 0) return;
    // fumée : une cheminée en temps normal ; panaches noirs puis flammes quand les vies baissent
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      const damaged = lives < 0.65;
      this.smokeT = damaged ? 0.35 : 1.4;
      const [lx, ly, lz] = this.chimneys[damaged ? Math.floor(Math.random() * this.chimneys.length) : 0];
      fx.smoke(this.wx(lx, lz), ly, this.wz(lx, lz), damaged ? 3 : 1, damaged ? 0x2e2a28 : 0xd8d4cc, damaged ? 0.6 : 0.2);
    }
    if (lives < 0.35) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 0.12;
        const [lx, ly, lz] = this.chimneys[Math.floor(Math.random() * this.chimneys.length)];
        const x = this.wx(lx, lz) + (Math.random() - 0.5) * 0.8, z = this.wz(lx, lz) + (Math.random() - 0.5) * 0.8;
        fx.glow.spawn(x, ly - 0.6, z, (Math.random() - 0.5) * 0.4, 1.6 + Math.random(), (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.3, 0.28, Math.random() < 0.5 ? 0xff6f00 : 0xffb300, 0.5);
      }
    }
  }
}
