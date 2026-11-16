import * as THREE from 'three';
import { ENEMIES } from '@dfend/shared';
import { enemyGeometry } from '../art/enemies';
import { heroGeometry, soldierGeometry } from '../art/units';
import { towerModel } from '../art/towers';
import { worldMaterial } from './materials';

/** Rend une fois les modèles 3D en petites images (portraits, encyclopédie). */
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
  const shot = (key: string, geo: THREE.BufferGeometry, face: boolean) => {
    const mesh = new THREE.Mesh(geo, mat);
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
  for (const id of ['samuel', 'lyra', 'brom', 'nox', 'ethan', 'roi']) shot(id, heroGeometry(id), true);
  for (const id of ['samuel', 'lyra', 'brom', 'nox']) shot('full_' + id, heroGeometry(id), false);
  for (const e of ENEMIES) shot('e_' + e.id, enemyGeometry(e.id), false);
  shot('kessin', enemyGeometry('kessin1'), true);
  shot('grolbak', enemyGeometry('grolbak'), true);
  shot('vasiere', enemyGeometry('vasiere'), true);
  shot('corbeau', enemyGeometry('corbeau'), false);
  for (let f = 0; f < 4; f++) for (let l = 0; l < 5; l++) shot(`t_${f}_${l}`, towerModel(f, l).base, false);
  for (let k = 0; k < 8; k++) shot('s_' + k, soldierGeometry(k), false);
  gl.dispose();
  gl.forceContextLoss();
  return out;
}
