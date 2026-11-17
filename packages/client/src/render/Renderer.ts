import * as THREE from 'three';
import { settings } from '../settings';
import type { BiomeTheme } from '../art/decor';
import { uniforms } from './materials';

/** Inclinaison de la caméra : plus plongeante dézoomée, plus rasante zoomée. */
const PITCH_FAR = 1.02; // ~58°
const PITCH_NEAR = 0.8; // ~46°

/**
 * Caméra de jeu : cible au sol (x, z), distance, cap (yaw).
 * En portrait, la caméra tourne de 90° pour que la longueur de la carte suive la hauteur de l'écran.
 * Les déplacements « sous le doigt » et le zoom vers un point gardent le point visé exactement sous le pointeur.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly cam = {
    x: 0, z: 0, dist: 44, tx: 0, tz: 0, tdist: 44, min: 12, max: 52, hw: 24, hh: 16, shake: 0,
    yaw: 0, tyaw: 0, vx: 0, vz: 0, fit: 44,
  };
  /** sortie des ennemis : en portrait, elle est placée en bas de l'écran */
  private exit = { x: 1, z: 0 };
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private v = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  /** point du monde à garder sous un point de l'écran pendant un zoom lissé */
  private anchor: { sx: number; sy: number; wx: number; wz: number } | null = null;
  /** vrai pendant un glisser : pas de lissage, pas d'inertie */
  dragging = false;
  private fogBase = { near: 55, far: 120 };
  width = 1;
  height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = settings.shadows;
    this.gl.shadowMap.type = settings.quality === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.gl.info.autoReset = false;
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 260);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.position.set(-18, 34, 16);
    this.sun.castShadow = settings.shadows;
    const sz = settings.quality === 'ultra' ? 4096 : settings.quality === 'haut' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 90;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.resize();
    addEventListener('resize', () => this.resize());
    // la barre d'adresse mobile change la hauteur sans toujours émettre « resize »
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  get portrait() {
    return this.height > this.width * 1.05;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (w === this.width && h === this.height && this.width > 1) return;
    const wasPortrait = this.portrait;
    this.width = w;
    this.height = h;
    const pr = Math.min(devicePixelRatio || 1, 2) * settings.resScale;
    this.gl.setPixelRatio(Math.max(0.5, Math.min(pr, 2.5)));
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cam.tyaw = this.targetYaw();
    if (wasPortrait !== this.portrait) this.cam.yaw = this.cam.tyaw;
    this.fitMap();
  }

  private targetYaw() {
    if (!this.portrait) return 0;
    // la sortie en bas de l'écran : en portrait, l'axe x de la carte devient vertical
    return this.exit.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  applyTheme(t: BiomeTheme) {
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    this.fogBase = { near: t.fogNear, far: t.fogFar };
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunIntensity;
  }

  setBounds(hw: number, hh: number, exit?: { x: number; z: number }) {
    this.cam.hw = hw;
    this.cam.hh = hh;
    if (exit) this.exit = exit;
    this.cam.yaw = this.cam.tyaw = this.targetYaw();
    this.fitMap();
    this.cam.dist = this.cam.tdist = this.cam.fit;
    this.cam.x = this.cam.tx = 0;
    this.cam.z = this.cam.tz = 0;
    this.cam.vx = this.cam.vz = 0;
    this.anchor = null;
  }

  /** Étendue de la carte le long des axes de l'écran (droite, bas). */
  private extents() {
    const c = Math.abs(Math.cos(this.cam.tyaw)), s = Math.abs(Math.sin(this.cam.tyaw));
    return { u: this.cam.hw * c + this.cam.hh * s, v: this.cam.hw * s + this.cam.hh * c };
  }

  pitchAt(dist: number) {
    const c = this.cam;
    const f = Math.max(0, Math.min(1, (dist - c.min) / Math.max(1, c.fit - c.min)));
    return PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * f;
  }

  /** Distance qui affiche toute la carte. */
  fitMap() {
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const e = this.extents();
    const needW = (e.u * 2 + 2) / (2 * Math.tan(hfov / 2));
    const needH = ((e.v * 2 + 2) * Math.sin(PITCH_FAR)) / (2 * Math.tan(vfov / 2));
    const d = Math.max(needW, needH);
    const wasFit = this.cam.tdist >= this.cam.fit * 0.98;
    this.cam.fit = d;
    this.cam.max = d * 1.12;
    this.cam.min = Math.min(14, d * 0.45);
    if (wasFit) this.cam.tdist = d;
    this.cam.tdist = Math.max(this.cam.min, Math.min(this.cam.max, this.cam.tdist));
  }

  /** Axes de l'écran projetés au sol (pour le clavier et les bords). */
  private axes() {
    const a = this.cam.yaw;
    return { rx: Math.cos(a), rz: -Math.sin(a), dx: Math.sin(a), dz: Math.cos(a) };
  }

  /** Déplacement en coordonnées d'écran (clavier, bords). */
  pan(dx: number, dy: number) {
    const k = this.cam.dist / 40;
    const ax = this.axes();
    this.cam.tx += (dx * ax.rx + dy * ax.dx) * k;
    this.cam.tz += (dx * ax.rz + dy * ax.dz) * k;
    this.cam.vx = this.cam.vz = 0;
  }

  /** Zoom par pas (molette), vers un point de l'écran s'il est donné. */
  zoom(delta: number, sx?: number, sy?: number) {
    const c = this.cam;
    c.tdist = Math.max(c.min, Math.min(c.max, c.tdist * (1 + delta)));
    this.setAnchor(sx, sy);
  }

  /** Zoom vers une distance cible, en gardant le point (sx, sy) en place. */
  zoomTo(dist: number, sx?: number, sy?: number) {
    const c = this.cam;
    c.tdist = Math.max(c.min, Math.min(c.max, dist));
    this.setAnchor(sx, sy);
  }

  private setAnchor(sx?: number, sy?: number) {
    if (sx === undefined || sy === undefined) { this.anchor = null; return; }
    const p = this.pick(sx, sy);
    this.anchor = p ? { sx, sy, wx: p.x, wz: p.z } : null;
  }

  focus(x: number, z: number) {
    this.cam.tx = x;
    this.cam.tz = z;
    this.cam.vx = this.cam.vz = 0;
    this.anchor = null;
  }

  shake(amount: number) {
    if (settings.reduceShake) return;
    this.cam.shake = Math.min(1, this.cam.shake + amount);
  }

  /** Démarre un glisser : arrête l'inertie et le lissage. */
  beginDrag() {
    const c = this.cam;
    this.dragging = true;
    this.anchor = null;
    c.vx = c.vz = 0;
    c.tx = c.x;
    c.tz = c.z;
    c.tdist = c.dist;
  }

  /**
   * Place la caméra pour que le point du monde (wx, wz) soit sous (sx, sy), avec la distance donnée.
   * Retourne le déplacement appliqué (pour estimer la vitesse du glisser).
   */
  dragTo(sx: number, sy: number, wx: number, wz: number, dist = this.cam.dist): { dx: number; dz: number } {
    const c = this.cam;
    c.dist = c.tdist = Math.max(c.min * 0.9, Math.min(c.max * 1.05, dist));
    this.applyCamera(0, 0);
    let dx = 0, dz = 0;
    // deux passes : l'inclinaison dépend de la distance mais pas de la position, une passe suffit en pratique
    for (let k = 0; k < 2; k++) {
      const p = this.pick(sx, sy);
      if (!p) break;
      const ex = wx - p.x, ez = wz - p.z;
      c.x += ex; c.z += ez; dx += ex; dz += ez;
      this.clamp(true);
      this.applyCamera(0, 0);
    }
    c.tx = c.x;
    c.tz = c.z;
    return { dx, dz };
  }

  /** Fin du glisser : la caméra glisse encore avec la vitesse donnée (unités/s). */
  endDrag(vx: number, vz: number) {
    this.dragging = false;
    const sp = Math.hypot(vx, vz), max = this.cam.dist * 2.2;
    const k = sp > max ? max / sp : 1;
    this.cam.vx = sp > 1.5 ? vx * k : 0;
    this.cam.vz = sp > 1.5 ? vz * k : 0;
  }

  /** Garde la cible dans la carte (en coordonnées d'écran, la carte doit rester visible). */
  private clamp(cur = false) {
    const c = this.cam;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const d = cur ? c.dist : c.tdist;
    const visU = d * Math.tan(hfov / 2);
    const visV = (d * Math.tan(vfov / 2)) / Math.sin(this.pitchAt(d));
    const e = this.extents();
    const limU = Math.max(1.5, e.u - visU * 0.7 + 2);
    const limV = Math.max(1.5, e.v - visV * 0.7 + 2);
    const ax = this.axes();
    const px = cur ? c.x : c.tx, pz = cur ? c.z : c.tz;
    let u = px * ax.rx + pz * ax.rz, v = px * ax.dx + pz * ax.dz;
    const cu = Math.max(-limU, Math.min(limU, u)), cv = Math.max(-limV, Math.min(limV, v));
    if (cu !== u) c.vx = c.vz = 0;
    if (cv !== v) c.vx = c.vz = 0;
    u = cu; v = cv;
    const nx = u * ax.rx + v * ax.dx, nz = u * ax.rz + v * ax.dz;
    if (cur) { c.x = nx; c.z = nz; } else { c.tx = nx; c.tz = nz; }
  }

  private applyCamera(sx: number, sz: number) {
    const c = this.cam;
    const pitch = this.pitchAt(c.dist);
    const h = Math.sin(pitch) * c.dist, back = Math.cos(pitch) * c.dist;
    // léger décalage vers le bas pour centrer la carte (perspective)
    const off = 1.2;
    const ax = this.axes();
    const lx = c.x + ax.dx * off + sx, lz = c.z + ax.dz * off + sz;
    this.camera.position.set(lx + ax.dx * back, h, lz + ax.dz * back);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(lx, 0, lz);
    this.camera.updateMatrixWorld();
  }

  update(dt: number, time: number) {
    const c = this.cam;
    const k = 1 - Math.exp(-dt * 10);
    // inertie
    if (!this.dragging && (c.vx || c.vz)) {
      c.tx += c.vx * dt;
      c.tz += c.vz * dt;
      const f = Math.exp(-dt * 4.5);
      c.vx *= f;
      c.vz *= f;
      if (Math.hypot(c.vx, c.vz) < 0.2) c.vx = c.vz = 0;
      c.x = c.tx; c.z = c.tz;
    }
    c.yaw += (c.tyaw - c.yaw) * k;
    if (!this.dragging) {
      this.clamp();
      c.x += (c.tx - c.x) * k;
      c.z += (c.tz - c.z) * k;
      c.dist += (c.tdist - c.dist) * k;
    }
    let sx = 0, sz = 0;
    if (c.shake > 0) {
      sx = Math.sin(time * 61) * c.shake * 0.35;
      sz = Math.cos(time * 53) * c.shake * 0.35;
      c.shake = Math.max(0, c.shake - dt * 2.5);
    }
    this.applyCamera(0, 0);
    // zoom vers un point : le point visé reste sous le curseur pendant le lissage
    const a = this.anchor;
    if (a && !this.dragging) {
      const p = this.pick(a.sx, a.sy);
      if (p) {
        const ex = a.wx - p.x, ez = a.wz - p.z;
        c.x += ex; c.z += ez; c.tx += ex; c.tz += ez;
        this.clamp(true);
        this.clamp();
      }
      if (Math.abs(c.tdist - c.dist) < 0.02) this.anchor = null;
    }
    this.applyCamera(sx, sz);
    // le brouillard suit la distance : une caméra éloignée (portrait) ne noie pas la carte
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      const extra = Math.max(0, c.dist - 44);
      fog.near = this.fogBase.near + extra;
      fog.far = this.fogBase.far + extra;
    }
    uniforms.uTime.value = time;
  }

  render() {
    this.gl.info.reset();
    this.gl.render(this.scene, this.camera);
  }

  /** Point au sol sous le curseur. */
  pick(sx: number, sy: number): { x: number; z: number } | null {
    this.ndc.set((sx / this.width) * 2 - 1, -(sy / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.v);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  /** Position écran d'un point 3D. */
  project(x: number, y: number, z: number, out: { x: number; y: number; visible: boolean }) {
    this.v.set(x, y, z).project(this.camera);
    out.x = (this.v.x * 0.5 + 0.5) * this.width;
    out.y = (-this.v.y * 0.5 + 0.5) * this.height;
    out.visible = this.v.z < 1;
    return out;
  }
}
