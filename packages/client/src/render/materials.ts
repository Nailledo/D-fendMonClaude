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
/** pose : x = geste ponctuel (0..1 : tir, sort), y = recul au coup (1 → 0), z = roulis (rad), w = vie (0 statique, 0..1 apparition, -1..0 mort) */
attribute vec4 iPose;
uniform float uTime;
float easeBack(float p) { float q = p - 1.0; return 1.0 + 2.70158 * q * q * q + 1.70158 * q * q; }
/** cycle d'attaque : élan lent, frappe rapide, retour (0 = repos, < 0 armé, > 0 frappe) */
float strikeCurve(float ph) {
  float wind = smoothstep(0.0, 0.55, ph);
  float hit = smoothstep(0.55, 0.66, ph);
  float back = smoothstep(0.66, 1.0, ph);
  return mix(mix(-wind, 1.0, hit), 0.0, back);
}
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
  float life = iPose.w;
  float alive = life != 0.0 ? 1.0 : 0.0;
  float walk = spd > 0.0 ? 1.0 : 0.0;
  if (mode > 0.5 && mode < 1.5) walk = 0.25;
  // phase d'attaque propre à chaque instance
  float atk = fract(uTime * 1.25 + iAnim.x * 0.37);
  float strike = strikeCurve(atk);
  float gesture = iPose.x > 0.0 && alive > 0.5 ? sin(3.14159 * clamp(iPose.x, 0.0, 1.0)) : 0.0;
  vec3 moved = transformed;
  if (part > 0.5 && part < 2.5) {
    float s = (part < 1.5 ? 1.0 : -1.0) * sin(t) * 0.6 * walk;
    // fente pendant la frappe : jambe avant en avant, jambe arrière en arrière
    if (mode > 0.5 && mode < 1.5) s += (part < 1.5 ? 0.35 : -0.25) * max(strike, 0.0);
    moved = rotX(transformed - pivot, s) + pivot;
  } else if (part > 2.5 && part < 4.5) {
    float s = (part < 3.5 ? -1.0 : 1.0) * sin(t) * 0.45 * walk;
    if (mode > 0.5 && mode < 1.5) {
      // bras droit : arme levée derrière la tête puis abattue ; bras gauche : garde
      s = part < 3.5 ? -0.55 - 0.25 * max(-strike, 0.0) : mix(-0.5, -2.7, max(-strike, 0.0)) + 2.2 * max(strike, 0.0);
    }
    // sort ou geste : les deux bras se lèvent
    s = mix(s, -2.6, gesture);
    moved = rotX(transformed - pivot, s) + pivot;
  } else if (part > 4.5 && part < 6.5) {
    float flap = sin(uTime * 9.0 + iAnim.x);
    // battement asymétrique : descente rapide, remontée lente
    flap = flap > 0.0 ? flap : flap * 0.6;
    float s = (part < 5.5 ? 1.0 : -1.0) * (0.25 + flap * 0.6);
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

  if (alive > 0.5) {
    // respiration au repos, écrasement-étirement à chaque pas
    if (spd == 0.0) transformed.y *= 1.0 + sin(uTime * 2.3 + iAnim.x) * 0.022;
    else if (walk > 0.5) { float st = cos(2.0 * t) * 0.035; transformed.y *= 1.0 + st; transformed.xz *= 1.0 - st * 0.5; }
    // tout le corps accompagne la frappe : recul à l'élan, plongée à l'impact
    if (mode > 0.5 && mode < 1.5) transformed = rotX(transformed, strike * 0.22);
    // recul quand on est touché : bascule en arrière et écrasement
    float hit = iPose.y;
    if (hit > 0.0) {
      transformed = rotX(transformed, -hit * 0.32);
      transformed.y *= 1.0 - hit * 0.12;
      transformed.xz *= 1.0 + hit * 0.08;
    }
    // sort : petit bond
    transformed.y += gesture * 0.18;
    // roulis dans les virages
    transformed = rotZ(transformed, iPose.z);
    if (life > 0.0 && life < 1.0) {
      // apparition : jaillit du sol avec un léger dépassement
      float e = easeBack(life);
      transformed *= max(e, 0.0);
      transformed.y -= (1.0 - life) * 0.6;
    } else if (life < 0.0) {
      // mort : bascule en arrière, rebond, puis s'enfonce dans le sol
      float p = -life;
      float fall = clamp(p / 0.45, 0.0, 1.0);
      float ang = fall * fall * 1.45 - sin(clamp((p - 0.45) / 0.2, 0.0, 1.0) * 3.14159) * 0.12;
      transformed = rotX(transformed, -ang);
      transformed.y -= smoothstep(0.55, 1.0, p) * 1.1;
      transformed *= 1.0 - smoothstep(0.7, 1.0, p) * 0.4;
    }
  } else if (iPose.x > 0.0) {
    // objets statiques (tours) : recul au tir, écrasement puis rebond
    float p = clamp(iPose.x, 0.0, 1.0);
    float k = sin(p * 3.14159) * (1.0 - p);
    transformed.y *= 1.0 - k * 0.16;
    transformed.xz *= 1.0 + k * 0.1;
  }
}
`;

const COLOR_PATCH = /* glsl */ `
#include <color_vertex>
if (aAnim.x > 6.5 && aAnim.x < 7.5) vColor.rgb = iTeam;
vColor.rgb = mix(vColor.rgb, iTint.rgb, iTint.a);
vColor.rgb = mix(vColor.rgb, vec3(1.6, 1.5, 1.4), iAnim.z);
// mort : la couleur s'assombrit ; sort : lueur
if (iPose.w < 0.0) vColor.rgb *= 1.0 - (-iPose.w) * 0.55;
if (iPose.x > 0.0 && iPose.w != 0.0) vColor.rgb += vec3(0.35, 0.3, 0.15) * sin(3.14159 * clamp(iPose.x, 0.0, 1.0));
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
  // feuillages et herbes importés : plans texturés découpés au seuil alpha, visibles des deux côtés
  const cutout = !!map?.userData.cutout;
  if (cutout) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
  m.customProgramCacheKey = () => (map ? (cutout ? 'anim-toon-map-cutout' : 'anim-toon-map') : 'anim-toon');
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
