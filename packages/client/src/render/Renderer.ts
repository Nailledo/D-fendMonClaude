import * as THREE from 'three';
import { settings, tuning } from '../settings';
import type { BiomeTheme } from '../art/decor';
import { uniforms } from './materials';
import { FirstPersonSky } from './Sky';

/** Inclinaison de la caméra : plus plongeante dézoomée, plus rasante zoomée. */
const PITCH_FAR = 1.02; // ~58°
const PITCH_NEAR = 0.8; // ~46°
/** Champ vertical de la vue d'ensemble (les calculs de cadrage s'y rapportent, même pendant la vue du héros). */
const BASE_FOV = 38;

/**
 * Vue du héros : champ plus large, plans proche et lointain resserrés, brouillard qui fond les collines au loin.
 * Regard un peu baissé et yeux en retrait de la tête : on voit ses mains, son arme et les petits ennemis à ses pieds.
 */
const FP = { fov: 74, near: 0.08, far: 170, fogNear: 22, fogFar: 85, pitch: -0.27, back: 0.32, blendTime: 0.7, turn: 3.5 };

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

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
  private lifted = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private v = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  /** point du monde à garder sous un point de l'écran pendant un zoom lissé */
  private anchor: { sx: number; sy: number; wx: number; wz: number } | null = null;
  /** vrai pendant un glisser : pas de lissage, pas d'inertie */
  dragging = false;
  private fogBase = { near: 55, far: 120 };
  width = 1;
  height = 1;
  /** échelle de résolution dynamique (1 = pleine résolution réglée) */
  dynScale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = settings.shadows;
    this.gl.shadowMap.type = settings.quality === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.gl.info.autoReset = false;
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 1, 260);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.position.set(-18, 34, 16);
    this.sun.castShadow = settings.shadows;
    const sz = tuning().shadowMap;
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
    this.applyPixelRatio();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cam.tyaw = this.targetYaw();
    if (wasPortrait !== this.portrait) this.cam.yaw = this.cam.tyaw;
    this.fitMap();
  }

  /** Densité de pixels : écran (plafonnée selon la qualité) × échelle réglée × échelle dynamique. */
  applyPixelRatio() {
    const pr = Math.min(devicePixelRatio || 1, tuning().prCap) * settings.resScale * this.dynScale;
    const v = Math.max(0.5, Math.min(pr, 2.5));
    if (Math.abs(v - this.gl.getPixelRatio()) > 0.001) this.gl.setPixelRatio(v);
    this.gl.setSize(this.width, this.height, false);
  }

  /** Pixels (réels) par unité de monde au centre de la vue : sert au choix des niveaux de détail. */
  pixelsPerUnit() {
    // vue du héros : tout se joue de près, les modèles gardent leur meilleur niveau de détail
    if (this.fp.blend > 0.5) return (this.height * this.gl.getPixelRatio()) / (2 * 6 * Math.tan((FP.fov * Math.PI) / 360));
    this.ndc.set(0, 0);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.v);
    const d = hit ? Math.max(4, Math.min(200, hit.distanceTo(this.camera.position))) : 60;
    const vfov = (BASE_FOV * Math.PI) / 180;
    return (this.height * this.gl.getPixelRatio()) / (2 * d * Math.tan(vfov / 2));
  }

  private targetYaw() {
    if (!this.portrait) return 0;
    // la sortie en bas de l'écran : en portrait, l'axe x de la carte devient vertical
    return this.exit.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  /** météo : pluie et nuit visées (0..1) et état affiché, qui y glisse en douceur */
  private wxTarget = { rain: 0, night: 0 };
  readonly wx = { rain: 0, night: 0 };
  private theme: BiomeTheme | null = null;
  private wxCol = new THREE.Color();

  setWeather(rain: boolean, night: boolean) {
    this.wxTarget.rain = rain ? 1 : 0;
    this.wxTarget.night = night ? 1 : 0;
  }

  /** Lumières, ciel et brouillard selon la météo (nuit bleutée, pluie grise). */
  private applyWeather() {
    const t = this.theme;
    if (!t) return;
    const { rain, night } = this.wx;
    this.sun.intensity = t.sunIntensity * (1 - 0.45 * rain) * (1 - 0.66 * night);
    this.sun.color.set(t.sun).lerp(this.wxCol.set(0x9db4ff), night * 0.8);
    this.hemi.intensity = 1.4 * (1 - 0.22 * rain) * (1 - 0.42 * night);
    this.hemi.color.set(t.hemiSky).lerp(this.wxCol.set(0xa3adb8), rain * 0.6).lerp(this.wxCol.set(0x4d64a8), night * 0.75);
    this.hemi.groundColor.set(t.hemiGround).lerp(this.wxCol.set(0x1c2238), night * 0.7);
    const sky = (this.scene.background as THREE.Color | null) ?? new THREE.Color();
    sky.set(t.sky).lerp(this.wxCol.set(0x77818c), rain * 0.6).lerp(this.wxCol.set(0x141a33), night * 0.85);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog | null)?.color.set(t.fog).lerp(this.wxCol.set(0x7d8791), rain * 0.6).lerp(this.wxCol.set(0x151b33), night * 0.85);
  }

  applyTheme(t: BiomeTheme) {
    this.theme = t;
    this.wx.rain = this.wx.night = this.wxTarget.rain = this.wxTarget.night = 0;
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
    const vfov = (BASE_FOV * Math.PI) / 180;
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

  /** Décale doucement la cible de la caméra (le lissage et les bords de carte s'appliquent). */
  nudge(dx: number, dz: number) {
    this.cam.tx += dx;
    this.cam.tz += dz;
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
    const vfov = (BASE_FOV * Math.PI) / 180;
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
    // météo : transition d'environ deux secondes
    const w = this.wx, wt = this.wxTarget;
    if (w.rain !== wt.rain || w.night !== wt.night) {
      const s = dt * 0.5;
      w.rain += Math.max(-s, Math.min(s, wt.rain - w.rain));
      w.night += Math.max(-s, Math.min(s, wt.night - w.night));
      this.applyWeather();
    }
  }

  /** Vue du héros : 0 = vue d'ensemble, 1 = dans les yeux du héros (transition lissée entre les deux). */
  readonly fp = { blend: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: FP.pitch, free: false };
  /** ciel, nuages et montagnes (vue du héros seulement : de haut, on ne voit jamais l'horizon) */
  private sky: FirstPersonSky | null = null;
  private skyTop = new THREE.Color();
  private skyLow = new THREE.Color();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private pa = new THREE.Vector3();
  private eyeV = new THREE.Vector3();
  private lookV = new THREE.Vector3();
  private m4 = new THREE.Matrix4();

  /**
   * Vue du héros, appelée après `update` (qui a posé la caméra de la vue d'ensemble) : `eye` = yeux et cap
   * du héros, ou null pour revenir à la vue d'ensemble. La caméra glisse de l'une à l'autre ; le cap suit
   * celui du héros avec retard, pour que ses volte-face en combat ne secouent pas l'image.
   */
  firstPerson(dt: number, eye: { x: number; y: number; z: number; yaw: number } | null) {
    const f = this.fp, cam = this.camera;
    if (!eye && f.blend === 0) return;
    if (eye) {
      // entrée : regard dans l'axe du héros ; ensuite il le suit, sauf pendant un regard libre
      if (f.blend === 0) { f.yaw = eye.yaw; f.pitch = FP.pitch; f.free = false; }
      else if (!f.free) f.yaw = lerpAngle(f.yaw, eye.yaw, 1 - Math.exp(-dt * FP.turn));
      f.x = eye.x; f.y = eye.y; f.z = eye.z;
    }
    f.blend = Math.max(0, Math.min(1, f.blend + (eye ? dt : -dt) / FP.blendTime));
    const e = f.blend * f.blend * (3 - 2 * f.blend);
    // pose de la vue d'ensemble (posée par update) → yeux du héros
    this.pa.copy(cam.position);
    this.qa.copy(cam.quaternion);
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    this.eyeV.set(f.x - fx * FP.back, f.y, f.z - fz * FP.back);
    const cp = Math.cos(f.pitch);
    this.lookV.set(this.eyeV.x + fx * cp, f.y + Math.sin(f.pitch), this.eyeV.z + fz * cp);
    this.m4.lookAt(this.eyeV, this.lookV, cam.up);
    this.qb.setFromRotationMatrix(this.m4);
    cam.position.lerpVectors(this.pa, this.eyeV, e);
    cam.quaternion.slerpQuaternions(this.qa, this.qb, e);
    cam.fov = BASE_FOV + (FP.fov - BASE_FOV) * e;
    cam.near = 1 + (FP.near - 1) * e;
    cam.far = 260 + (FP.far - 260) * e;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // brouillard plus proche : les collines du bord se fondent dans l'horizon du ciel
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near += (FP.fogNear - fog.near) * e;
      fog.far += (FP.fogFar - fog.far) * e;
    }
    if (fog) this.skyLow.copy(fog.color);
    if (this.scene.background instanceof THREE.Color) this.skyTop.copy(this.scene.background);
    this.skyView().update(e, cam.position, this.skyTop, this.skyLow, this.hemi.groundColor, this.sun, this.wx.night, this.wx.rain);
  }

  /**
   * Tourner la tête (glisser au clic gauche) de (dx, dy) pixels : le cap suit directement la souris (le jeu
   * fait pivoter le héros avec lui) et l'inclinaison reste propre à la caméra. Le cap n'est plus lissé
   * jusqu'à `fpFollow` (le héros se remet à marcher ou à se battre).
   */
  fpLook(dx: number, dy: number) {
    const f = this.fp, k = 0.0045;
    f.free = true;
    f.yaw -= dx * k;
    f.pitch = Math.max(-1.15, Math.min(0.55, f.pitch - dy * k));
  }

  /** Le regard suit de nouveau le cap du héros (l'inclinaison choisie est gardée). */
  fpFollow() {
    this.fp.free = false;
  }

  /** Fin de partie pendant la vue du héros : caméra rendue telle quelle à la vue d'ensemble. */
  resetFirstPerson() {
    this.fp.blend = 0;
    if (this.sky) this.sky.group.visible = false;
    const cam = this.camera;
    cam.fov = BASE_FOV;
    cam.near = 1;
    cam.far = 260;
    cam.updateProjectionMatrix();
  }

  private skyView() {
    this.sky ??= new FirstPersonSky();
    // créé à la première utilisation ; remis dans la scène au besoin
    if (this.sky.group.parent !== this.scene) this.scene.add(this.sky.group);
    return this.sky;
  }

  render() {
    this.gl.info.reset();
    this.gl.render(this.scene, this.camera);
  }

  /** Point au sol sous le curseur ; `y` : plan horizontal à cette hauteur (ennemis volants). */
  pick(sx: number, sy: number, y = 0): { x: number; z: number } | null {
    this.ndc.set((sx / this.width) * 2 - 1, -(sy / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const plane = y ? this.lifted.set(this.ground.normal, this.ground.constant - y) : this.ground;
    const hit = this.raycaster.ray.intersectPlane(plane, this.v);
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
