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
/** bras d'un héros : tangage (avant/arrière), écartement (roulis) puis rotation horizontale autour de l'épaule */
vec3 armMove(vec3 p, vec3 sh, vec3 a) { return rotY(rotZ(rotX(p - sh, a.x), a.y), a.z) + sh; }
/** pose d'une arme : angle du bras a et angle voulu de l'arme th (depuis la verticale, + vers l'avant) → poignet */
vec2 grip(float a, float th) { return vec2(a, th - a); }
`;

const ANIM_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
{
  float part = aAnim.x;
  vec3 pivot = aAnim.yzw;
  // phase de marche cumulée côté CPU (stride.ts) : 0 = immobile
  float spd = iAnim.y;
  float t = spd;
  float mode = iAnim.w;
  float life = iPose.w;
  float alive = life != 0.0 ? 1.0 : 0.0;
  float walk = spd > 0.0 ? 1.0 : 0.0;
  // phase d'attaque propre à chaque instance
  float atk = fract(uTime * 1.25 + iAnim.x * 0.37);
  float strike = strikeCurve(atk);
  // style d'animation (0 générique, 1 épée, 2 arc, 3 marteau, 4 bâton) codé avec le mode : w = combat + 2 × style
  float style = floor(iAnim.w * 0.5 + 0.01);
  mode -= style * 2.0;
  if (mode > 0.5 && mode < 1.5) walk = 0.25;
  // geste : 0..1 = tir, 1..2 = sort (héros)
  float fireP = iPose.x > 0.0 && iPose.x <= 1.0 && alive > 0.5 ? iPose.x : 0.0;
  float castP = iPose.x > 1.0 && alive > 0.5 ? iPose.x - 1.0 : 0.0;
  float gesture = style > 0.5 ? sin(3.14159 * castP) : (iPose.x > 0.0 && alive > 0.5 ? sin(3.14159 * clamp(iPose.x, 0.0, 1.0)) : 0.0);
  // ---- poses des héros armés : bras (tangage, écartement, rotation), poignets, torsion et inclinaison du corps
  vec3 armR = vec3(0.0), armL = vec3(0.0);
  float wristR = 0.0, wristL = 0.0, twist = 0.0, lean = 0.0;
  if (style > 0.5 && alive > 0.5) {
    float fight = mode > 0.5 && mode < 1.5 ? 1.0 : 0.0;
    float rate = style < 1.5 ? 1.0 : style < 2.5 ? 1.3 : style < 3.5 ? 0.85 : 0.9;
    float ph = fract(uTime * rate + iAnim.x * 0.37);
    float sc = strikeCurve(ph);
    float wind = max(-sc, 0.0) * fight, hit = max(sc, 0.0) * fight;
    float sw = sin(t) * 0.4 * walk * (1.0 - fight);
    float spell = sin(3.14159 * castP);
    vec2 r, l;
    if (style < 1.5) {
      // épée : garde haute, armé au-dessus de la tête, taille en diagonale
      r = grip(-0.3 - sw, 0.6);
      vec2 guard = grip(-1.0, 0.3), up = grip(-2.5, -1.2), down = grip(-0.6, 2.0);
      r = mix(r, guard, fight);
      r += (up - guard) * wind + (down - guard) * hit;
      armR.y = -0.5 * wind + 0.35 * hit;
      twist = -0.35 * wind + 0.35 * hit;
      lean = -0.1 * wind + 0.22 * hit;
      l = vec2(mix(sw, -0.6, fight) - 0.3 * wind, 0.0);
      armL.y = 0.2 * fight;
      // sort : l'épée levée vers le ciel
      r = mix(r, grip(-2.9, -0.1), spell);
      l = mix(l, vec2(-0.5, 0.0), spell);
    } else if (style < 2.5) {
      // arc (main gauche) : visée de côté, corde tirée jusqu'à la joue, relâchée au tir
      l = grip(-0.25 + sw, 0.9);
      r = vec2(-0.2 - sw, 0.0);
      // coup d'arc au corps à corps
      l = mix(l, grip(-0.8, 0.4), fight);
      l += (grip(-1.9, -0.6) - grip(-0.8, 0.4)) * wind + (grip(-0.5, 1.6) - grip(-0.8, 0.4)) * hit;
      r.x = mix(r.x, -0.4, fight);
      float aim = fireP > 0.0 ? 1.0 - smoothstep(0.75, 1.0, fireP) : 0.0;
      float draw = smoothstep(0.12, 0.55, fireP);
      float snap = fireP > 0.0 ? 1.0 - smoothstep(0.0, 0.12, fireP) : 0.0;
      l = mix(l, grip(-1.5, 0.12), aim);
      armL.z = -0.45 * aim;
      // main droite : sur la corde contre l'arc, puis ramenée vers la poitrine (corde tirée le long de la flèche)
      r = mix(r, vec2(mix(-1.55, -1.67, draw), 0.0), aim);
      armR.z = mix(0.0, mix(0.95, 1.33, draw), aim);
      armR.y = -0.45 * snap * aim;
      twist = -0.5 * aim;
      lean = -0.05 * aim;
      // sort : tir vers le ciel
      l = mix(l, grip(-2.3, -0.8), spell);
      r = mix(r, vec2(-2.0, 0.0), spell);
      armR.z = mix(armR.z, 0.6, spell);
      armL.z = mix(armL.z, 0.3, spell);
      twist = mix(twist, -0.4, spell);
    } else if (style < 3.5) {
      // marteau : tenu droit à côté du corps, tête en haut (lisible sous tous les angles de caméra),
      // frappe à deux mains au-dessus de la tête jusqu'au sol
      r = grip(-0.35 - sw * 0.3, 0.12);
      vec2 guard = grip(-1.0, 0.2), up = grip(-2.7, -1.9), down = grip(-1.0, 1.85);
      float slam = strikeCurve(clamp(castP, 0.0, 1.0)) * step(0.001, castP);
      float wind2 = max(wind, max(-slam, 0.0)), hit2 = max(hit, max(slam, 0.0));
      float act = max(fight, step(0.001, castP));
      r = mix(r, guard, act);
      r += (up - guard) * wind2 + (down - guard) * hit2;
      // main gauche sur le manche
      l = mix(vec2(sw, 0.0), vec2(r.x + 0.15, 0.0), act);
      armL.y = 0.3 * act;
      armL.z = 0.4 * act;
      armR.z = 0.25 * act;
      lean = -0.15 * wind2 + 0.3 * hit2;
      twist = 0.0;
    } else {
      // bâton : appui à la marche, pointé vers la cible au tir, levé au ciel pour les sorts
      r = grip(-0.25 - sw * 0.5, 0.15);
      vec2 guard = grip(-0.8, 0.6), back = grip(-0.3, -0.6), jab = grip(-1.4, 1.6);
      r = mix(r, guard, fight);
      r += (back - guard) * wind + (jab - guard) * hit;
      l = vec2(sw, 0.0);
      float thrust = fireP > 0.0 ? sin(3.14159 * min(fireP * 1.4, 1.0)) : 0.0;
      r = mix(r, grip(-1.35, 1.25), thrust);
      l = mix(l, vec2(-1.2, 0.0), thrust);
      armL.z = -0.25 * thrust;
      lean = 0.12 * thrust + 0.15 * hit;
      r = mix(r, grip(-2.6, -0.1), spell);
      l = mix(l, vec2(-2.4, 0.0), spell);
      armL.y = 0.3 * spell;
    }
    armR.x = r.x; wristR = r.y;
    armL.x = l.x; wristL = l.y;
  }
  vec3 moved = transformed;
  // parties 10 et 11 : armes tenues ; 12 et plus : mécanismes des bâtiments
  bool weapon = part > 9.5 && part < 11.5;
  if (style > 0.5 && (part > 2.5 && part < 4.5 || weapon)) {
    // bras et armes des héros (parties 10 et 11 : arme en main droite / gauche, pivot = la main, épaule au-dessus)
    bool right = part > 3.5 && part < 4.5 || weapon && part < 10.5;
    vec3 a = right ? armR : armL;
    a.y *= right ? 1.0 : -1.0;
    a.z *= right ? 1.0 : -1.0;
    vec3 p = transformed, sh = pivot;
    if (weapon) {
      sh = pivot + vec3(0.0, aWeight, 0.0);
      p = rotX(p - pivot, right ? wristR : wristL) + pivot;
    }
    moved = armMove(p, sh, a);
  } else if (weapon) {
    // arme hors style (repli) : suit simplement le corps
    moved = transformed;
  } else if (part > 11.5 && part < 12.5) {
    // roue, ailes de moulin : tournent autour de l'axe z du modèle
    moved = rotZ(transformed - pivot, -uTime * 1.6 - iAnim.x) + pivot;
  } else if (part > 12.5 && part < 13.5) {
    // wagonnet : sort de la galerie, attend chargé, y rentre (cycle de 7 s, décalé par bâtiment)
    float c = fract(uTime / 7.0 + iAnim.x * 0.13) * 7.0;
    float ex = smoothstep(0.0, 1.4, c) * (1.0 - smoothstep(4.2, 5.6, c));
    moved.z += (ex - 1.0) * 0.75;
    moved.y += abs(sin(c * 9.0)) * 0.015 * step(0.05, ex) * step(ex, 0.95);
    // caché au fond de la galerie : réduit à rien
    moved = mix(pivot, moved, smoothstep(0.0, 0.25, ex));
  } else if (part > 13.5 && part < 14.5) {
    // flamme : vacille autour de sa base
    float f = 1.0 + 0.22 * sin(uTime * 13.0 + iAnim.x * 5.0) + 0.12 * sin(uTime * 23.0 + iAnim.x);
    vec3 d = transformed - pivot;
    moved = pivot + vec3(d.x * (1.0 + 0.1 * sin(uTime * 17.0)), d.y * f, d.z * (1.0 + 0.1 * cos(uTime * 15.0)));
  } else if (part > 0.5 && part < 2.5) {
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
    // grands battements (≈ 55° de part et d'autre), descente puissante et remontée plus lente,
    // avec de courtes phases de vol plané (ailes tenues relevées)
    float flap = sin(uTime * 6.5 + iAnim.x * 3.1);
    flap = flap > 0.0 ? sqrt(flap) : flap * 0.8;
    float glide = smoothstep(0.6, 0.9, sin(uTime * 0.6 + iAnim.x * 1.7));
    float side = part < 5.5 ? 1.0 : -1.0;
    float s = side * (0.1 + flap * mix(0.95, 0.15, glide));
    // le bout de l'aile suit avec un temps de retard : l'aile se plie au lieu de rester une planche
    float reach = clamp(abs(transformed.x - pivot.x) * 1.2, 0.0, 1.5);
    s += side * reach * 0.35 * cos(uTime * 6.5 + iAnim.x * 3.1) * (1.0 - glide);
    moved = rotZ(transformed - pivot, s) + pivot;
  } else if (part > 7.5 && part < 8.5) {
    moved.x += sin(uTime * 1.7 + iAnim.x + position.x) * 0.07 * max(position.y, 0.0);
    moved.z += cos(uTime * 1.3 + iAnim.x) * 0.04 * max(position.y, 0.0);
  } else if (part > 8.5 && part < 9.5) {
    moved = rotY(transformed - pivot, uTime * 1.5 + iAnim.x) + pivot;
    moved.y += sin(uTime * 2.0 + iAnim.x) * 0.12;
  }
  // fondu aux articulations (modèles importés : aWeight < 1 près des jointures)
  transformed = mix(transformed, moved, part > 9.5 ? 1.0 : aWeight);
  if (walk > 0.5 && (part < 7.5 || weapon)) transformed.y += abs(sin(t)) * 0.07;

  if (alive > 0.5) {
    // respiration au repos, écrasement-étirement à chaque pas
    if (spd == 0.0) transformed.y *= 1.0 + sin(uTime * 2.3 + iAnim.x) * 0.022;
    else if (walk > 0.5) { float st = cos(2.0 * t) * 0.035; transformed.y *= 1.0 + st; transformed.xz *= 1.0 - st * 0.5; }
    // tout le corps accompagne la frappe : recul à l'élan, plongée à l'impact
    if (style > 0.5) transformed = rotX(rotY(transformed, twist), lean);
    else if (mode > 0.5 && mode < 1.5) transformed = rotX(transformed, strike * 0.22);
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
vColor.rgb = mix(vColor.rgb, iTint.rgb, abs(iTint.a));
// teinte d'opacité négative : modèle tramé (à moitié transparent : ennemi camouflé)
vDither = iTint.a < 0.0 ? 1.0 : 0.0;
vColor.rgb = mix(vColor.rgb, vec3(1.6, 1.5, 1.4), iAnim.z);
// mort : la couleur s'assombrit ; sort : lueur
if (iPose.w < 0.0) vColor.rgb *= 1.0 - (-iPose.w) * 0.55;
if (iPose.x > 0.0 && iPose.w != 0.0) vColor.rgb += vec3(0.35, 0.3, 0.15) * sin(3.14159 * clamp(iPose.x > 1.0 ? iPose.x - 1.0 : iPose.x, 0.0, 1.0)) * (iAnim.w > 1.5 && iPose.x <= 1.0 ? 0.0 : 1.0);
`;

/**
 * Matériau des entités instanciées : animation procédurale dans le vertex shader.
 * Avec `map` (modèles importés), la texture est multipliée par les couleurs de sommets
 * (occlusion cuite, teinte, flash) ; sans, les couleurs de sommets font tout.
 */
export function animMaterial(map: THREE.Texture | null = null): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), ...(map ? { map } : {}) });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = 'varying float vDither;\n' + ANIM_HEAD + shader.vertexShader.replace('#include <begin_vertex>', ANIM_BEGIN).replace('#include <color_vertex>', COLOR_PATCH);
    shader.fragmentShader = 'varying float vDither;\n' + shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif (vDither > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;',
    );
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

const NOISE = /* glsl */ `
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
/** version bon marché de tDots : un disque au plus par cellule, entièrement contenu dans sa cellule (r < 0.25) */
float tSpot(vec2 p, float density, float r) {
  vec2 c = floor(p), f = fract(p);
  if (tHash(c) > density) return 0.0;
  vec2 o = vec2(tHash(c + 3.7), tHash(c + 9.1)) * 0.5 + 0.25 - f;
  return 1.0 - smoothstep(r * 0.6, r, length(o));
}
/** petits disques semés au hasard (un par cellule, avec une probabilité) : cailloux, lentilles d'eau, bulles */
float tDots(vec2 p, float density, float rMin, float rMax) {
  vec2 c = floor(p), f = fract(p);
  float best = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cc = c + vec2(float(i), float(j));
    float h = tHash(cc);
    if (h > density) continue;
    vec2 o = vec2(tHash(cc + 3.7), tHash(cc + 9.1)) * 0.7 + 0.15 - f + vec2(float(i), float(j));
    float r = mix(rMin, rMax, tHash(cc + 5.3));
    best = max(best, 1.0 - smoothstep(r * 0.75, r, length(o * vec2(1.0, 1.25))));
  }
  return best;
}
float tFbm(vec2 p) { return tNoise(p) * 0.55 + tNoise(p * 2.03 + 17.0) * 0.28 + tNoise(p * 4.1 + 31.0) * 0.17; }
`;

export interface TerrainColors {
  grass: number[];
  dirt: number;
  dirtEdge: number;
  hill: number;
  fog: number;
}

/**
 * Sol : couleur calculée par pixel (aucune facette en damier).
 * Herbe en grandes taches + détail fin, roche sur les pentes, collines, et le chemin peint dans le sol
 * à partir d'une carte de distances (R : distance au chemin, G : distance aux mares), bords irréguliers et cailloux.
 */
export function terrainMaterial(t: TerrainColors, mask: THREE.Texture, bounds: [number, number, number, number], pathHalf: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const c = (h: number) => new THREE.Color(h);
  const g = t.grass;
  const rock = c(t.hill).lerp(c(t.dirtEdge), 0.55).multiplyScalar(0.9);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uMask: { value: mask }, uBounds: { value: new THREE.Vector4(...bounds) }, uPathW: { value: pathHalf },
      uG0: { value: c(g[0]) }, uG1: { value: c(g[1 % g.length]) }, uG2: { value: c(g[2 % g.length]) }, uG3: { value: c(g[3 % g.length]) },
      uDirt: { value: c(t.dirt) }, uDirtEdge: { value: c(t.dirtEdge) }, uHill: { value: c(t.hill) }, uRock: { value: rock }, uEdge: { value: c(t.fog).multiplyScalar(0.9) },
    });
    shader.vertexShader = 'varying vec3 vWorldP;\nvarying vec3 vWorldN;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = `varying vec3 vWorldP;
varying vec3 vWorldN;
uniform sampler2D uMask; uniform vec4 uBounds; uniform float uPathW;
uniform vec3 uG0, uG1, uG2, uG3, uDirt, uDirtEdge, uHill, uRock, uEdge;
${NOISE}
` + shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
  vec2 wp = vWorldP.xz;
  vec4 mk = texture2D(uMask, (wp - uBounds.xy) / uBounds.zw);
  float dPath = mk.r * 6.0;
  float dPool = mk.g * 6.0 - 1.5;
  // ---- herbe : grandes nappes de teintes, touffes plus sombres, brins clairs, coins plus secs, fleurettes
  float n1 = tFbm(wp * 0.07);
  vec3 col = mix(uG2, uG0, smoothstep(0.3, 0.6, n1));
  col = mix(col, uG1, smoothstep(0.5, 0.75, tFbm(wp * 0.13 + 9.0)) * 0.7);
  col = mix(col, uG3, smoothstep(0.62, 0.85, tNoise(wp * 0.45 + 3.0)) * 0.4);
  // herbe sèche par endroits (teinte paille, discrète)
  float dry = smoothstep(0.62, 0.8, tFbm(wp * 0.05 + 41.0));
  col = mix(col, mix(col, uDirt, 0.38), dry * 0.55);
  // touffes : petites zones plus denses et plus sombres ; brins : grain fin étiré
  float tuft = tNoise(wp * 1.7 + 5.0) * 0.6 + tNoise(wp * 3.9 + 2.0) * 0.4;
  col *= 0.86 + 0.2 * smoothstep(0.25, 0.75, tuft);
  float blade = tNoise(vec2(wp.x * 7.0 + wp.y * 2.0, wp.y * 15.0)) * 0.6 + tNoise(wp * 11.0) * 0.4;
  col *= 0.94 + 0.12 * blade;
  // fleurettes blanches et jaunes, rares
  float fl = tSpot(wp * 1.6, 0.05, 0.12);
  col = mix(col, tHash(floor(wp * 1.6) + 1.3) > 0.5 ? vec3(0.98, 0.96, 0.86) : vec3(1.0, 0.86, 0.3), fl * 0.85);
  // ---- relief : collines et roche sur les pentes (normale lissée : pas de facettes en damier)
  vec3 nrm = normalize(vWorldN);
  float slope = 1.0 - nrm.y;
  col = mix(col, uHill, smoothstep(0.5, 3.5, vWorldP.y) * 0.85);
  float strata = tNoise(vec2(wp.x + wp.y, vWorldP.y * 6.0)) * 0.5 + tNoise(wp * 2.0) * 0.5;
  vec3 rockC = uRock * (0.82 + 0.3 * strata);
  col = mix(col, rockC, smoothstep(0.22, 0.45, slope + (tNoise(wp * 1.7) - 0.5) * 0.18));
  // ---- chemin : bord net et irrégulier, herbe foulée autour, terre marbrée, ornières, cailloux ombrés
  float pw = uPathW + (tNoise(wp * 1.4) - 0.5) * 0.35 + (tNoise(wp * 4.5) - 0.5) * 0.14;
  float inPath = 1.0 - smoothstep(pw - 0.06, pw + 0.04, dPath);
  float rim = (1.0 - smoothstep(pw, pw + 0.32 + tNoise(wp * 2.2) * 0.25, dPath)) * (1.0 - inPath);
  vec3 dirt = mix(uDirtEdge, uDirt, smoothstep(pw * 0.98, pw * 0.5, dPath));
  dirt = mix(dirt, dirt * vec3(0.9, 0.86, 0.82), smoothstep(0.45, 0.75, tFbm(wp * 0.6 + 13.0)) * 0.7);
  dirt *= 0.92 + 0.1 * tNoise(wp * 2.6) + 0.07 * tNoise(wp * 9.0) + 0.04 * tNoise(wp * 23.0);
  if (dPath < pw) {
    // cailloux : clairs sur le dessus, ombre portée en bas
    float peb = tDots(wp * 3.0, 0.2, 0.08, 0.15);
    float sh = tDots(wp * 3.0 + vec2(-0.09, -0.12), 0.2, 0.08, 0.15);
    float inner = smoothstep(pw, pw * 0.6, dPath);
    dirt *= 1.0 - max(sh - peb, 0.0) * 0.35 * inner;
    dirt = mix(dirt, uDirt * 1.18 + 0.04, peb * 0.7 * inner);
  }
  // deux ornières plus sombres et tassées
  float rut = smoothstep(0.16, 0.0, abs(dPath - pw * 0.42)) * (0.6 + 0.4 * tNoise(wp * 1.1));
  dirt *= 1.0 - rut * 0.1;
  // bord : liseré de terre plus sombre sous l'herbe, puis herbe foulée (pas de halo orangé)
  float lip = smoothstep(pw - 0.22, pw - 0.02, dPath) * inPath;
  dirt *= 1.0 - lip * 0.18;
  col = mix(col, col * vec3(0.92, 0.9, 0.8), rim * 0.8);
  col = mix(col, dirt, inPath);
  // berges des mares
  float shore = 1.0 - smoothstep(-0.2, 0.9 + tNoise(wp * 2.0) * 0.4, dPool);
  col = mix(col, uDirtEdge * 0.75, shore * 0.8);
  // les bords de la carte se fondent dans la brume
  vec2 e2 = abs(wp) / vec2(56.0, 42.0);
  col = mix(col, uEdge, smoothstep(0.62, 1.0, max(e2.x, e2.y)) * 0.55);
  diffuseColor.rgb *= col;
`);
  };
  m.customProgramCacheKey = () => 'terrain';
  return m;
}

/**
 * Mares : eau (dégradé du fond vers la rive, vagues, reflets, écume), lave (croûte qui dérive, fissures
 * incandescentes, pulsation) ou vase (eau trouble, algues, bulles). Attribut `edge` : 0 au centre, 1 sur la rive.
 */
export function liquidMaterial(kind: 'eau' | 'lave' | 'vase'): THREE.ShaderMaterial {
  const colors = {
    eau: [0x1f6f9f, 0x58c4dc],
    lave: [0xb52a05, 0xffb02e],
    vase: [0x24382a, 0x56703e],
  }[kind];
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      cA: { value: new THREE.Color(colors[0]) }, cB: { value: new THREE.Color(colors[1]) }, uKind: { value: kind === 'eau' ? 0 : kind === 'lave' ? 1 : 2 },
    }]),
    vertexShader: /* glsl */ `
      varying vec2 vP; varying float vEdge;
      attribute float edge;
      #include <fog_pars_vertex>
      void main() {
        vP = (modelMatrix * vec4(position, 1.0)).xz; vEdge = edge;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 cA; uniform vec3 cB; uniform float uKind;
      varying vec2 vP; varying float vEdge;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        float t = uTime, e = vEdge;
        vec2 p = vP;
        vec3 col;
        if (uKind < 0.5) {
          // eau
          float w1 = tNoise(p * 0.9 + vec2(t * 0.22, t * 0.15));
          float w2 = tNoise(p * 2.1 - vec2(t * 0.3, -t * 0.19));
          float w = w1 * 0.6 + w2 * 0.4;
          col = mix(cA, cB, smoothstep(0.25, 1.0, e) * 0.85 + (w - 0.5) * 0.15);
          // reflets : réseau de caustiques déformé par les vagues (lignes douces, sans artefacts de grille)
          vec2 q = p * 1.6 + vec2(w1, w2) * 2.2;
          float ca = sin(q.x * 2.3 + t * 0.9) * sin(q.y * 2.1 - t * 0.7) + sin((q.x + q.y) * 1.7 + t * 0.6) * 0.6;
          float glint = smoothstep(0.7, 1.6, ca);
          col += glint * 0.28 * (1.0 - e * 0.4);
          col += (w2 - 0.5) * 0.08;
          // écume sur la rive
          float foam = smoothstep(0.84, 0.97, e + (w - 0.5) * 0.14 + sin(t * 1.6 + e * 18.0) * 0.012);
          col = mix(col, vec3(0.93, 0.98, 1.0), foam * 0.85);
        } else if (uKind < 1.5) {
          // lave
          float n = tFbm(p * 0.6 + vec2(t * 0.05, t * 0.03));
          float cr = tNoise(p * 1.8 - vec2(t * 0.09, 0.0));
          float crust = smoothstep(0.42, 0.58, n * 0.6 + cr * 0.4);
          vec3 hot = mix(cA * 1.3, cB * 1.35, smoothstep(0.35, 0.9, tNoise(p * 2.6 + t * 0.35)));
          float cracks = 1.0 - smoothstep(0.0, 0.05, abs(n * 0.6 + cr * 0.4 - 0.5));
          col = mix(hot, vec3(0.16, 0.07, 0.05) + cracks * 0.0, crust * 0.88);
          col += vec3(1.0, 0.55, 0.15) * cracks * crust * 0.9;
          col *= 0.92 + 0.12 * sin(t * 2.0 + p.x * 0.7 + p.y * 0.5);
          col = mix(col, vec3(0.12, 0.06, 0.05), smoothstep(0.86, 1.0, e) * 0.9);
        } else {
          // vase
          float w = tNoise(p * 1.2 + vec2(t * 0.06, -t * 0.04));
          col = mix(cA, cB, smoothstep(0.3, 1.0, e) * 0.6 + (w - 0.5) * 0.25);
          // algues : petites taches sombres qui dérivent lentement, lentilles d'eau claires éparses
          float algae = smoothstep(0.6, 0.75, tFbm(p * 1.6 + vec2(t * 0.02, 4.0)));
          col = mix(col, vec3(0.17, 0.27, 0.12), algae * 0.55);
          float duck = tDots(p * 2.2 + vec2(t * 0.03, 0.0), 0.18, 0.12, 0.22) * (1.0 - smoothstep(0.7, 0.95, e));
          col = mix(col, vec3(0.38, 0.52, 0.22), duck * 0.8);
          // bulles qui apparaissent et éclatent
          vec2 cell = floor(p * 2.5);
          float seed = tHash(cell);
          float life = fract(t * 0.35 + seed);
          vec2 q = fract(p * 2.5) - 0.5 - (vec2(tHash(cell + 3.1), tHash(cell + 7.7)) - 0.5) * 0.5;
          float ring = smoothstep(0.03, 0.0, abs(length(q) - life * 0.25)) * step(0.7, seed) * (1.0 - life);
          col += ring * 0.35;
          col = mix(col, vec3(0.2, 0.17, 0.1), smoothstep(0.85, 1.0, e) * 0.7);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // horloge partagée (la fusion des uniformes la copierait)
  mat.uniforms.uTime = uniforms.uTime;
  return mat;
}
