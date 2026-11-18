import * as THREE from 'three';
import { uniforms } from './materials';

/**
 * Ciel de la vue du héros. De haut on ne voit jamais l'horizon : il n'existe que dans cette vue.
 * - voûte : dégradé du ciel du biome (en haut) à la couleur du brouillard (à l'horizon), nuages qui dérivent,
 *   soleil bas et son halo (une lune bleutée la nuit), étoiles la nuit ; la pluie couvre le ciel ;
 * - deux chaînes de montagnes lointaines, noyées dans la brume, derrière les collines du bord de carte.
 * Tout suit les couleurs du biome et la météo (le Renderer les donne à chaque image).
 */
export class FirstPersonSky {
  readonly group = new THREE.Group();
  private dome: THREE.Mesh;
  private top = new THREE.Color();
  private low = new THREE.Color();
  private sunCol = new THREE.Color();
  private body = new THREE.Color();
  private sunDir = new THREE.Vector3(0, 0.3, 1);
  private night = { value: 0 };
  private rain = { value: 0 };

  constructor() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        uTop: { value: this.top }, uLow: { value: this.low }, uSunCol: { value: this.sunCol }, uSunDir: { value: this.sunDir },
        uNight: this.night, uRain: this.rain, uTime: uniforms.uTime,
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uLow;
        uniform vec3 uSunCol;
        uniform vec3 uSunDir;
        uniform float uNight;
        uniform float uRain;
        uniform float uTime;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
          return v;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uLow, uTop, smoothstep(-0.02, 0.42, h));
          // soleil (lune la nuit) : disque net et large halo, voilés par la pluie
          float s = max(dot(d, uSunDir), 0.0);
          float veil = 1.0 - uRain * 0.85;
          col += uSunCol * (pow(s, 14.0) * 0.32 + pow(s, 3.0) * 0.06) * veil;
          float disc = smoothstep(0.9991, 0.9995, s) * 2.5 + pow(s, 400.0) * 0.8;
          // étoiles : points ronds, plus nombreux haut dans le ciel
          if (uNight > 0.01 && h > 0.0) {
            vec2 g = d.xz / (h + 0.35) * 150.0;
            vec2 cell = floor(g);
            float r = hash(cell);
            float tw = 0.7 + 0.3 * sin(uTime * (2.0 + r * 4.0) + r * 40.0);
            float st = step(0.994, r) * smoothstep(0.32, 0.0, length(fract(g) - 0.5)) * tw;
            col += st * uNight * (1.0 - uRain) * smoothstep(0.02, 0.3, h) * vec3(0.9, 0.95, 1.0);
          }
          // nuages : couche plate au-dessus de la carte, qui dérive avec le vent
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(uTime * 0.012, uTime * 0.005);
            float n = fbm(uv);
            float cover = mix(0.56, 0.3, uRain);
            float c = smoothstep(cover, cover + 0.22, n) * smoothstep(0.0, 0.16, h);
            // ombre au cœur des nuages épais, bord éclairé du côté du soleil
            float core = smoothstep(cover + 0.15, cover + 0.45, n);
            vec3 cl = mix(vec3(1.0), uTop, 0.12);
            cl = mix(cl, cl * 0.78, core);
            cl += uSunCol * pow(s, 5.0) * 0.35 * (1.0 - uNight);
            cl = mix(cl, vec3(0.42, 0.45, 0.5), uRain * 0.75);
            cl = mix(cl, vec3(0.1, 0.12, 0.2), uNight * 0.85);
            col = mix(col, cl, c * 0.92);
            // le disque perce les nuages fins, s'efface derrière les épais
            disc *= 1.0 - 0.85 * smoothstep(0.0, 0.6, c + core);
          }
          col += uSunCol * vec3(1.0, 0.93, 0.78) * disc * veil;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.dome.scale.setScalar(120);
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // montagnes : la chaîne lointaine est plus haute et plus pâle (perspective atmosphérique)
    const mtMat = (haze: number) => new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uLow: { value: this.low }, uBody: { value: this.body }, uHaze: { value: haze }, uNight: this.night },
      vertexShader: /* glsl */ `
        attribute float aT;
        varying float vT;
        void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLow;
        uniform vec3 uBody;
        uniform float uHaze;
        varying float vT;
        void main() {
          // brume plus dense au pied des montagnes, crêtes un peu plus nettes
          float haze = clamp(uHaze + (1.0 - vT) * 0.45, 0.0, 0.95);
          gl_FragColor = vec4(mix(uBody, uLow, haze), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.group.add(range(100, 92, 16, 34, 11, mtMat(0.55)), range(84, 72, 10, 22, 37, mtMat(0.32)));
    this.group.visible = false;
  }

  /**
   * `amount` : part de la vue du héros dans la transition (0 : rien d'affiché).
   * `top`/`low` : ciel du biome et brouillard (déjà teintés par la météo) ; `ground` : sol de la lumière d'ambiance.
   */
  update(amount: number, camPos: THREE.Vector3, top: THREE.Color, low: THREE.Color, ground: THREE.Color,
    sun: THREE.DirectionalLight, night: number, rain: number) {
    this.group.visible = amount > 0.01;
    if (!this.group.visible) return;
    this.dome.position.copy(camPos);
    this.top.copy(top);
    this.low.copy(low);
    // corps des montagnes : entre le sol et le ciel, assombri (vu à contre-jour)
    this.body.copy(ground).lerp(top, 0.35).multiplyScalar(0.75);
    // soleil affiché bas sur l'horizon, dans la direction de la vraie lumière (les ombres restent cohérentes)
    const p = sun.position, hl = Math.hypot(p.x, p.z) || 1;
    this.sunDir.set(p.x / hl, 0.24, p.z / hl).normalize();
    this.sunCol.copy(sun.color).multiplyScalar(Math.min(1.2, sun.intensity / 2.4) * (1 - 0.4 * night) + 0.25 * night);
    this.night.value = night;
    this.rain.value = rain;
  }
}

/**
 * Chaîne de montagnes en anneau elliptique autour de la carte (centre du monde) : une bande verticale
 * dont le bord haut dessine des sommets (sinus de phases tirées d'une graine, crêtes accentuées).
 */
function range(rx: number, rz: number, hMin: number, hMax: number, seed: number, mat: THREE.Material) {
  const N = 220;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const waves = [2, 3, 5, 8, 13, 21].map((k) => ({ k, ph: rnd() * Math.PI * 2, a: 1 / Math.sqrt(k) }));
  const sum = waves.reduce((t, w) => t + w.a, 0);
  const pos = new Float32Array((N + 1) * 2 * 3);
  const t = new Float32Array((N + 1) * 2);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let v = 0;
    for (const w of waves) v += w.a * (1 - Math.abs(Math.sin(a * w.k + w.ph)));
    const n = v / sum;
    const h = hMin + (hMax - hMin) * n * n * 1.4;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
    pos.set([x, -10, z, x, h, z], i * 6);
    t[i * 2] = 0;
    t[i * 2 + 1] = 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  // vue de l'intérieur de l'anneau : les deux faces, sans ombre
  (mat as THREE.ShaderMaterial).side = THREE.DoubleSide;
  m.frustumCulled = false;
  return m;
}
