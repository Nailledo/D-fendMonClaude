import * as THREE from 'three';

/** Rampe de lumière toon à 3 paliers. */
function gradientMap(): THREE.DataTexture {
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export const uniforms = {
  uTime: { value: 0 },
};

let grad: THREE.DataTexture | null = null;
export function toonGradient() {
  return (grad ??= gradientMap());
}

/** Matériau du décor statique. */
export function worldMaterial(): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
}

const ANIM_HEAD = /* glsl */ `
attribute vec4 aAnim;
attribute float aWeight;
attribute vec4 iAnim;
attribute vec4 iTint;
attribute vec3 iTeam;
uniform float uTime;
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
`;

const ANIM_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
{
  float part = aAnim.x;
  vec3 pivot = aAnim.yzw;
  float spd = iAnim.y;
  float t = uTime * spd + iAnim.x;
  float mode = iAnim.w;
  float walk = spd > 0.0 ? 1.0 : 0.0;
  if (mode > 0.5 && mode < 1.5) walk = 0.25;
  vec3 moved = transformed;
  if (part > 0.5 && part < 2.5) {
    float s = (part < 1.5 ? 1.0 : -1.0) * sin(t) * 0.6 * walk;
    moved = rotX(transformed - pivot, s) + pivot;
  } else if (part > 2.5 && part < 4.5) {
    float s = (part < 3.5 ? -1.0 : 1.0) * sin(t) * 0.45 * walk;
    if (mode > 0.5 && mode < 1.5) s = part < 3.5 ? -0.3 : -1.5 + 1.5 * abs(sin(uTime * 4.0 + iAnim.x));
    moved = rotX(transformed - pivot, s) + pivot;
  } else if (part > 4.5 && part < 6.5) {
    float s = (part < 5.5 ? 1.0 : -1.0) * (0.25 + sin(uTime * 9.0 + iAnim.x) * 0.55);
    moved = rotZ(transformed - pivot, s) + pivot;
  } else if (part > 7.5 && part < 8.5) {
    moved.x += sin(uTime * 1.7 + iAnim.x + position.x) * 0.07 * max(position.y, 0.0);
    moved.z += cos(uTime * 1.3 + iAnim.x) * 0.04 * max(position.y, 0.0);
  } else if (part > 8.5 && part < 9.5) {
    moved = rotY(transformed - pivot, uTime * 1.5 + iAnim.x) + pivot;
    moved.y += sin(uTime * 2.0 + iAnim.x) * 0.12;
  }
  // fondu aux articulations (modèles importés : aWeight < 1 près des jointures)
  transformed = mix(transformed, moved, aWeight);
  if (walk > 0.5 && part < 7.5) transformed.y += abs(sin(t)) * 0.07;
}
`;

const COLOR_PATCH = /* glsl */ `
#include <color_vertex>
if (aAnim.x > 6.5 && aAnim.x < 7.5) vColor.rgb = iTeam;
vColor.rgb = mix(vColor.rgb, iTint.rgb, iTint.a);
vColor.rgb = mix(vColor.rgb, vec3(1.6, 1.5, 1.4), iAnim.z);
`;

/**
 * Matériau des entités instanciées : animation procédurale dans le vertex shader.
 * Avec `map` (modèles importés), la texture est multipliée par les couleurs de sommets
 * (occlusion cuite, teinte, flash) ; sans, les couleurs de sommets font tout.
 */
export function animMaterial(map: THREE.Texture | null = null): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: map ?? undefined });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = ANIM_HEAD + shader.vertexShader.replace('#include <begin_vertex>', ANIM_BEGIN).replace('#include <color_vertex>', COLOR_PATCH);
  };
  m.customProgramCacheKey = () => (map ? 'anim-toon-map' : 'anim-toon');
  return m;
}

/** Matériau de profondeur (ombres) animé, pour que les ombres bougent avec les modèles. */
export function animDepthMaterial(): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = ANIM_HEAD + shader.vertexShader.replace('#include <begin_vertex>', ANIM_BEGIN);
  };
  m.customProgramCacheKey = () => 'anim-depth';
  return m;
}

/** Barres de vie : quads instanciés orientés vers la caméra. */
export function hpBarMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {},
    vertexShader: /* glsl */ `
      attribute vec2 iHp; // fraction, largeur
      varying vec2 vUv;
      varying float vHp;
      void main() {
        vUv = uv;
        vHp = iHp.x;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.xy += position.xy * vec2(iHp.y, 0.13);
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vHp;
      void main() {
        vec2 e = min(vUv, 1.0 - vUv);
        if (e.x < 0.03 || e.y < 0.18) { gl_FragColor = vec4(0.08, 0.06, 0.05, 0.95); return; }
        vec3 c = vUv.x <= vHp ? mix(vec3(0.85, 0.16, 0.1), vec3(0.35, 0.85, 0.2), smoothstep(0.25, 0.6, vHp)) : vec3(0.25, 0.08, 0.06);
        gl_FragColor = vec4(c, 0.95);
      }`,
  });
}

/** Eau / lave / vase animées. */
export function liquidMaterial(kind: 'eau' | 'lave' | 'vase'): THREE.ShaderMaterial {
  const colors = {
    eau: [new THREE.Color(0x3aa3c9), new THREE.Color(0x9fe3f0)],
    lave: [new THREE.Color(0xd9400b), new THREE.Color(0xffd23f)],
    vase: [new THREE.Color(0x3c5c3a), new THREE.Color(0x8fb36a)],
  }[kind];
  return new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, cA: { value: colors[0] }, cB: { value: colors[1] }, uLava: { value: kind === 'lave' ? 1 : 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP; varying float vEdge;
      attribute float edge;
      void main() { vP = (modelMatrix * vec4(position, 1.0)).xz; vEdge = edge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 cA; uniform vec3 cB; uniform float uLava;
      varying vec2 vP; varying float vEdge;
      void main() {
        float w = sin(vP.x * 1.7 + uTime * 0.9) * sin(vP.y * 1.3 - uTime * 0.7) + sin((vP.x + vP.y) * 2.9 + uTime * 1.6) * 0.5;
        float band = step(0.55, w);
        vec3 c = mix(cA, cB, band * (0.55 + 0.45 * uLava));
        c = mix(c, cB, smoothstep(0.75, 1.0, vEdge) * 0.8);
        if (uLava > 0.5) c *= 1.2 + 0.25 * sin(uTime * 2.0 + vP.x);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
