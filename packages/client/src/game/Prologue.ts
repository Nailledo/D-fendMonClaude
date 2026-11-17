import * as THREE from 'three';
import { enemyGeometry } from '../art/enemies';
import { K, geoFor } from '../art/models';
import { heroGeometry } from '../art/units';
import { Decal, type Fx } from '../render/Fx';
import { InstPool } from '../render/InstPool';
import type { Renderer } from '../render/Renderer';
import { settings } from '../settings';
import { audio } from '../audio/Audio';

/**
 * Mise en scène 3D du prologue, devant la porte du château, synchronisée sur les répliques :
 *   0 le bal (confettis)  ·  1 les lumières s'éteignent  ·  2 Kessin surgit  ·  3 Ethan se débat
 *   4 Kessin l'enlève et disparaît  ·  5 le roi se désespère  ·  6 Samuel arrive  ·  7-8 le serment
 */
interface Actor {
  pool: InstPool;
  x: number; y: number; z: number; yaw: number; s: number;
  /** naissance (apparition animée), < 0 : déjà là */
  born: number;
  visible: boolean;
  speed: number;
  team: number;
}

export class Prologue {
  private group = new THREE.Group();
  private pools: InstPool[] = [];
  private king: Actor;
  private ethan: Actor;
  private kessin: Actor;
  private samuel: Actor;
  private line = -1;
  private lineT = 0;
  private hemi0: number;
  private sun0: number;
  private dim = 0;
  /** point central de la scène et axes (vers l'intérieur de la carte, perpendiculaire) */
  private cx: number;
  private cz: number;
  private ix: number;
  private iz: number;
  private px: number;
  private pz: number;

  constructor(private r: Renderer, private fx: Fx, exit: { x: number; z: number }) {
    r.scene.add(this.group);
    const l = Math.hypot(exit.x, exit.z) || 1;
    this.ix = -exit.x / l; this.iz = -exit.z / l;
    this.px = -this.iz; this.pz = this.ix;
    this.cx = exit.x + this.ix * 4.5;
    this.cz = exit.z + this.iz * 4.5;
    const pool = (key: string, fb: () => THREE.BufferGeometry) => {
      const g = geoFor(key, fb);
      const p = new InstPool(g.geo, 1, this.group, settings.shadows, g.map);
      this.pools.push(p);
      return p;
    };
    const face = r.cam.yaw; // face à la caméra
    const at = (u: number, v: number) => ({ x: this.cx + this.px * u + this.ix * v, z: this.cz + this.pz * u + this.iz * v });
    const a = (u: number, v: number, key: string, fb: () => THREE.BufferGeometry, s: number, yawOff: number, team = 0xffffff): Actor => {
      const p = at(u, v);
      return { pool: pool(key, fb), x: p.x, y: 0, z: p.z, yaw: face + yawOff, s, born: -1, visible: true, speed: 0, team };
    };
    this.king = a(1.3, 0, K.hero('roi'), () => heroGeometry('roi'), 1.55, -0.45, 0xb3262e);
    this.ethan = a(-1.1, 0.2, K.hero('ethan'), () => heroGeometry('ethan'), 1.4, 0.45);
    this.kessin = a(-1.6, -1.6, K.enemy('kessin1'), () => enemyGeometry('kessin1'), 1.75, 0.35);
    this.kessin.visible = false;
    this.samuel = a(-6, 2.5, K.hero('samuel'), () => heroGeometry('samuel'), 1.4, 0, 0x3b82f6);
    this.samuel.visible = false;
    this.hemi0 = r.hemi.intensity;
    this.sun0 = r.sun.intensity;
    // la caméra se rapproche ; la scène est décalée vers le haut de l'écran (le dialogue occupe le bas)
    const ax = { dx: Math.sin(r.cam.yaw), dz: Math.cos(r.cam.yaw) };
    r.zoomTo(r.portrait ? 16 : Math.max(10, Math.min(14, r.cam.fit * 0.3)));
    r.focus(this.cx + ax.dx * (r.portrait ? 0.6 : 1.6), this.cz + ax.dz * (r.portrait ? 0.6 : 1.6));
  }

  private onLine(i: number, time: number) {
    const fx = this.fx;
    const k = this.kessin, e = this.ethan;
    if (i === 0) {
      for (let n = 0; n < 40; n++) fx.glow.spawn(this.cx + (Math.random() - 0.5) * 6, 4 + Math.random() * 3, this.cz + (Math.random() - 0.5) * 6, (Math.random() - 0.5), -1.2, (Math.random() - 0.5), 3, 0.08, [0xff6fae, 0xffe066, 0x7cc6ff, 0xa6f27a][n % 4], 0.2);
    } else if (i === 1) {
      // les chandeliers s'éteignent, odeur de soufre
      this.dim = 1;
      fx.smoke(this.cx, 0.3, this.cz, 18, 0x4a3d2e, 5);
      fx.flashes.flash(this.cx, 2, this.cz, 0xff3d00, 6, 0.8, 12);
      audio.play('boss', 0.6);
    } else if (i === 2) {
      // Kessin surgit d'un cercle infernal
      k.visible = true;
      k.born = time;
      fx.runes.add(k.x, k.z, 2.6, Decal.Rune, 3, 0xff3d00, -1.5);
      fx.decals.add(k.x, k.z, 1.3, Decal.Scorch, 7, 0xff5a00);
      fx.pillar(k.x, k.z, 1.6, 8, 0xff5722, 1.2);
      fx.shockwave(k.x, k.z, 3, 0xff8a50, 0x4a3d2e, 0.6);
      fx.burst(k.x, 0.5, k.z, 40, 0xff6f00, 6, 0.3, 0.9, true, -2);
      fx.flashes.flash(k.x, 2, k.z, 0xff5a00, 14, 0.7, 14);
      this.r.shake(0.4);
      audio.play('explosion', 1);
    } else if (i === 4) {
      // l'enlèvement : Kessin et Ethan s'envolent, puis disparaissent dans la fumée
      fx.burst(e.x, 1, e.z, 20, 0xc77dff, 4, 0.15, 0.8, true, 1);
      audio.play('arcane', 1);
    } else if (i === 5) {
      this.dim = 0;
    } else if (i === 6) {
      this.samuel.visible = true;
      this.samuel.born = time;
    }
  }

  /** `line` : indice de la réplique affichée (au-delà du prologue : fin). */
  update(dt: number, time: number, line: number, speaker: string) {
    if (line !== this.line) {
      for (let i = this.line + 1; i <= line; i++) this.onLine(i, time);
      this.line = line;
      this.lineT = 0;
    }
    this.lineT += dt;
    const t = this.lineT;
    // lumière : baisse pendant l'apparition, revient ensuite
    const target = this.dim ? 0.35 : 1;
    const cur = this.r.hemi.intensity / this.hemi0;
    const v = cur + (target - cur) * Math.min(1, dt * 3);
    this.r.hemi.intensity = this.hemi0 * v;
    this.r.sun.intensity = this.sun0 * v;

    const k = this.kessin, e = this.ethan, s = this.samuel, kg = this.king;
    // Kessin flotte de façon menaçante, se penche vers la princesse
    if (k.visible) {
      k.y = 0.15 + Math.sin(time * 2) * 0.1;
      k.yaw = Math.atan2(e.x - k.x, e.z - k.z) * 0.6 + this.r.cam.yaw * 0.4;
    }
    // l'enlèvement
    if (line >= 4 && k.visible) {
      const up = Math.min(1, t / 1.6);
      const ease = up * up;
      k.y = 0.15 + ease * 6;
      e.y = ease * 6 + Math.min(1, t / 0.3) * 0.9;
      e.x += (k.x + this.px * 0.6 - e.x) * Math.min(1, dt * 3);
      e.z += (k.z + this.pz * 0.6 - e.z) * Math.min(1, dt * 3);
      if (t > 0.2) this.fx.smoke(k.x, k.y + 1, k.z, 1, 0x3a2f28, 1.5);
      if (up >= 1) {
        this.fx.smoke(k.x, k.y, k.z, 24, 0x2b2420, 3);
        this.fx.burst(k.x, k.y, k.z, 30, 0xff6f00, 5, 0.2, 0.7, true, 0);
        k.visible = false;
        e.visible = false;
        audio.play('explosion', 0.6);
      }
    }
    // Samuel arrive en marchant avec ses petits fours
    if (s.visible) {
      // il s'arrête là où se tenait la princesse, face au roi
      const dest = { x: this.cx - this.px * 0.6 + this.ix * 0.4, z: this.cz - this.pz * 0.6 + this.iz * 0.4 };
      const dx = dest.x - s.x, dz = dest.z - s.z, d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const st = Math.min(d, dt * 2.6);
        s.x += (dx / d) * st;
        s.z += (dz / d) * st;
        s.yaw = Math.atan2(dx, dz);
        s.speed = 9;
      } else {
        s.speed = 0;
        s.yaw += (Math.atan2(kg.x - s.x, kg.z - s.z) - s.yaw) * Math.min(1, dt * 4);
      }
      kg.yaw += (Math.atan2(s.x - kg.x, s.z - kg.z) - kg.yaw) * Math.min(1, dt * 3);
    }

    const draw = (a: Actor, who: string) => {
      a.pool.begin();
      if (a.visible) {
        const j = a.pool.push(a.x, a.y, a.z, a.yaw, a.s, a.x * 1.7, a.speed, 0, a === k ? 2 : 0);
        a.pool.setTeam(j, a.team);
        const talking = speaker === who;
        // geste quand le personnage parle ; le roi s'agite quand on enlève sa fille, Ethan se débat
        let gesture = talking ? 0.2 + 0.18 * Math.abs(Math.sin(time * 5)) : 0;
        let hit = 0;
        if (a === kg && line === 5) { gesture = 0.5 + 0.3 * Math.sin(time * 9); hit = 0.25 + 0.2 * Math.sin(time * 7); }
        if (a === e && (line === 3 || line === 4)) { hit = 0.5 + 0.5 * Math.sin(time * 14); gesture = 0.4 + 0.3 * Math.sin(time * 11); }
        // Kessin tient un trident : pas de geste des bras (il tournoierait), il se cambre à la place
        if (a === k) { hit = Math.max(hit, gesture * 0.9); gesture = 0; }
        const life = a.born >= 0 ? Math.min(1, Math.max(0.001, (time - a.born) / 0.6)) : 1;
        a.pool.setPose(j, Math.max(0, gesture), Math.max(0, hit), 0, life);
      }
      a.pool.end();
    };
    draw(kg, 'roi');
    draw(e, 'ethan');
    draw(k, 'kessin');
    draw(s, 'samuel');
  }

  dispose() {
    this.r.hemi.intensity = this.hemi0;
    this.r.sun.intensity = this.sun0;
    for (const p of this.pools) p.dispose();
    this.r.scene.remove(this.group);
    // retour à la vue d'ensemble
    this.r.zoomTo(this.r.cam.fit);
    this.r.focus(0, 0);
  }
}
