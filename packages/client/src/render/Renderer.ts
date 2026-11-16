import * as THREE from 'three';
import { settings } from '../settings';
import type { BiomeTheme } from '../art/decor';
import { uniforms } from './materials';

const PITCH = 0.95; // ~54°

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly cam = { x: 0, z: 0, dist: 44, tx: 0, tz: 0, tdist: 44, min: 14, max: 52, hw: 24, hh: 16, shake: 0 };
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private v = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  width = 1;
  height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = settings.shadows;
    this.gl.shadowMap.type = settings.quality === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.gl.info.autoReset = false;
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 220);
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
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.width = w;
    this.height = h;
    const pr = Math.min(devicePixelRatio || 1, 2) * settings.resScale;
    this.gl.setPixelRatio(Math.max(0.5, Math.min(pr, 2.5)));
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitMap();
  }

  applyTheme(t: BiomeTheme) {
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunIntensity;
  }

  setBounds(hw: number, hh: number) {
    this.cam.hw = hw;
    this.cam.hh = hh;
    this.fitMap();
    this.cam.dist = this.cam.tdist;
    this.cam.x = this.cam.tx = 0;
    this.cam.z = this.cam.tz = 0;
  }

  /** Distance qui affiche toute la carte. */
  fitMap() {
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const needW = (this.cam.hw * 2 + 2) / (2 * Math.tan(hfov / 2));
    const needH = ((this.cam.hh * 2 + 2) * Math.sin(PITCH)) / (2 * Math.tan(vfov / 2));
    const d = Math.max(needW, needH);
    this.cam.max = d * 1.08;
    this.cam.tdist = Math.min(this.cam.tdist, this.cam.max);
    if (this.cam.tdist > d * 0.98) this.cam.tdist = d;
  }

  pan(dx: number, dz: number) {
    const k = this.cam.dist / 40;
    this.cam.tx += dx * k;
    this.cam.tz += dz * k;
  }

  zoom(delta: number) {
    this.cam.tdist = Math.max(this.cam.min, Math.min(this.cam.max, this.cam.tdist * (1 + delta)));
  }

  focus(x: number, z: number) {
    this.cam.tx = x;
    this.cam.tz = z;
  }

  shake(amount: number) {
    if (settings.reduceShake) return;
    this.cam.shake = Math.min(1, this.cam.shake + amount);
  }

  update(dt: number, time: number) {
    const c = this.cam;
    const k = 1 - Math.exp(-dt * 10);
    // limites : plus on zoome, plus on peut se déplacer
    const zoomFrac = 1 - (c.tdist - c.min) / Math.max(1, c.max - c.min);
    const lx = c.hw * zoomFrac * 0.9, lz = c.hh * zoomFrac * 0.9;
    c.tx = Math.max(-lx, Math.min(lx, c.tx));
    c.tz = Math.max(-lz, Math.min(lz, c.tz));
    c.x += (c.tx - c.x) * k;
    c.z += (c.tz - c.z) * k;
    c.dist += (c.tdist - c.dist) * k;
    let sx = 0, sz = 0;
    if (c.shake > 0) {
      sx = Math.sin(time * 61) * c.shake * 0.35;
      sz = Math.cos(time * 53) * c.shake * 0.35;
      c.shake = Math.max(0, c.shake - dt * 2.5);
    }
    // léger décalage vers le bas pour centrer la carte (perspective)
    const tz = c.z + 1.2;
    this.camera.position.set(c.x + sx, Math.sin(PITCH) * c.dist, tz + Math.cos(PITCH) * c.dist + sz);
    this.camera.lookAt(c.x + sx, 0, tz + sz);
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
