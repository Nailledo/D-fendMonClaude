import * as THREE from 'three';
import { ENEMIES } from '@dfend/shared';
import { enemyGeometry } from '../art/enemies';
import { heroGeometry, soldierGeometry } from '../art/units';
import { towerModel } from '../art/towers';
import { K, model } from '../art/models';
import { toonGradient, worldMaterial } from './materials';

/**
 * Rend les modèles 3D en petites images (portraits, encyclopédie).
 * Les modèles importés (ceux qu'on voit en jeu) sont utilisés dès qu'ils sont chargés,
 * sinon l'art construit en code : appeler à nouveau une fois les modèles chargés.
 */
export function renderPortraits(): Record<string, string> {
  const out: Record<string, string> = {};
  const size = 160;
  const canvas = document.createElement('canvas');
  let gl: THREE.WebGLRenderer;
  try {
    gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  gl.setPixelRatio(1);
  gl.setSize(size, size, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x665544, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const mat = worldMaterial();
  const texMats = new Map<THREE.Texture, THREE.Material>();
  const matFor = (map: THREE.Texture | null) => {
    if (!map) return mat;
    let m = texMats.get(map);
    if (!m) {
      const t = new THREE.MeshToonMaterial({ vertexColors: true, map, gradientMap: toonGradient() });
      if (map.userData.cutout) { t.alphaTest = 0.5; t.side = THREE.DoubleSide; }
      texMats.set(map, (m = t));
    }
    return m;
  };
  /** modèle importé s'il est chargé, sinon art en code */
  const pick = (key: string, fb: () => THREE.BufferGeometry) => {
    const m = model(key);
    return m ? { geo: m.geo, map: m.map } : { geo: fb(), map: null };
  };
  const shot = (key: string, src: { geo: THREE.BufferGeometry; map: THREE.Texture | null }, face: boolean) => {
    const geo = src.geo;
    const mesh = new THREE.Mesh(geo, matFor(src.map));
    scene.add(mesh);
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const h = bb.max.y - bb.min.y;
    const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    const cy = face ? bb.min.y + h * 0.78 : (bb.max.y + bb.min.y) / 2;
    const span = face ? Math.max(h * 0.42, w * 0.45) : Math.max(h, w) * 0.62;
    const d = span / Math.tan((15 * Math.PI) / 180);
    cam.position.set(d * 0.45, cy + d * 0.18, d * 0.9);
    cam.lookAt(0, cy, 0);
    gl.render(scene, cam);
    out[key] = canvas.toDataURL('image/png');
    scene.remove(mesh);
  };
  for (const id of ['samuel', 'lyra', 'brom', 'nox', 'ethan', 'roi']) shot(id, pick(K.hero(id), () => heroGeometry(id)), true);
  for (const id of ['samuel', 'lyra', 'brom', 'nox', 'ethan', 'roi']) shot('full_' + id, pick(K.hero(id), () => heroGeometry(id)), false);
  for (const e of ENEMIES) shot('e_' + e.id, pick(K.enemy(e.id), () => enemyGeometry(e.id)), false);
  shot('kessin', pick(K.enemy('kessin1'), () => enemyGeometry('kessin1')), true);
  shot('grolbak', pick(K.enemy('grolbak'), () => enemyGeometry('grolbak')), true);
  shot('vasiere', pick(K.enemy('vasiere'), () => enemyGeometry('vasiere')), true);
  shot('corbeau', pick(K.enemy('corbeau'), () => enemyGeometry('corbeau')), false);
  for (let f = 0; f < 4; f++) for (let l = 0; l < 5; l++) shot(`t_${f}_${l}`, pick(K.tower(f, l), () => towerModel(f, l).base), false);
  for (let k = 0; k < 8; k++) shot('s_' + k, pick(K.soldier(k), () => soldierGeometry(k)), false);
  for (const m of texMats.values()) m.dispose();
  gl.dispose();
  gl.forceContextLoss();
  return out;
}
