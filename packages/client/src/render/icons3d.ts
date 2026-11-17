import * as THREE from 'three';
import { GB } from '../art/builder';
import { toonGradient } from './materials';

/**
 * Icônes du jeu rendues en 3D (style A) : petits objets low-poly éclairés comme le monde,
 * contour sombre pour la lisibilité, posés dans un médaillon à la couleur de leur élément
 * (les ressources affichées en ligne, comme l'or et les vies, n'ont pas de médaillon).
 */
export interface Icon3D {
  build: (g: GB) => void;
  /** couleur du médaillon (absent : objet seul) */
  medal?: number;
  /** rotation de présentation de l'objet */
  rot?: [number, number, number];
  /** zoom (1 : l'objet remplit le médaillon) */
  zoom?: number;
}

const GOLD = 0xf2b33d, GOLD_D = 0xb8781a, STEEL = 0xd5dde2, STEEL_D = 0x8b9aa3, WOOD = 0x8a5a33, RED = 0xd63a32;

/** lame d'épée le long de +y (pointe en haut), garde dorée, poignée, pommeau */
function sword(g: GB, x: number, y: number, rz: number, len = 1.5, blade = STEEL) {
  const c = Math.cos(rz), s = Math.sin(rz);
  const at = (d: number): [number, number] => [x - s * d, y + c * d];
  const [bx, by] = at(len * 0.38);
  g.box(0.17, len * 0.75, 0.07, blade, bx, by, 0, 0, 0, rz);
  const [tx, ty] = at(len * 0.78);
  g.shape([[-0.085, 0], [0.085, 0], [0, 0.2]], 0.07, blade, tx, ty, 0, 0, 0, rz);
  // arête centrale plus sombre
  g.box(0.035, len * 0.72, 0.09, STEEL_D, bx, by, 0, 0, 0, rz);
  const [gx, gy] = at(0);
  g.box(0.52, 0.11, 0.13, GOLD, gx, gy, 0, 0, 0, rz);
  const [hx, hy] = at(-0.2);
  g.box(0.1, 0.32, 0.1, WOOD, hx, hy, 0, 0, 0, rz);
  const [px, py] = at(-0.4);
  g.ball(0.09, GOLD, px, py, 0);
}

export const ICONS3D: Record<string, Icon3D> = {
  // ------------------------------------------------ ressources (sans médaillon)
  coin: {
    rot: [0.35, -0.45, 0],
    build(g) {
      g.cyl(0.92, 0.92, 0.28, 12, GOLD, 0, 0, 0, Math.PI / 2);
      g.cyl(0.74, 0.74, 0.32, 12, GOLD_D, 0, 0, 0, Math.PI / 2);
      g.cyl(0.68, 0.68, 0.34, 12, GOLD, 0, 0, 0, Math.PI / 2);
      // couronne frappée
      g.box(0.62, 0.18, 0.1, GOLD_D, 0, -0.18, 0.2);
      for (const xx of [-0.24, 0, 0.24]) g.cone(0.09, 0.32, 4, GOLD_D, xx, 0.08, 0.2);
    },
  },
  heart: {
    rot: [0.25, -0.4, 0],
    build(g) {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 16; k++) {
        const t = (k / 16) * Math.PI * 2;
        pts.push([Math.pow(Math.sin(t), 3) * 0.9, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * 0.9]);
      }
      g.shape(pts, 0.45, RED, 0, 0.05, 0);
      // reflet
      g.ball(0.13, 0xff9a8f, -0.38, 0.38, 0.2, 1, 0.7, 0.5);
    },
  },
  // ------------------------------------------------ sorts
  meteor: {
    medal: 0xc2410c,
    rot: [0.2, -0.3, 0],
    build(g) {
      // traînée de feu continue : cônes emboîtés qui partent du rocher vers le haut à droite
      const dx = Math.SQRT1_2, dy = Math.SQRT1_2, rz = -Math.PI / 4;
      const rx0 = -0.35, ry0 = -0.35;
      for (const [h, r, c, z] of [[1.9, 0.5, 0xff6f00, -0.25], [1.5, 0.36, 0xffa726, -0.1], [1.05, 0.22, 0xffe082, 0.05]] as const) {
        g.cone(r, h, 7, c, rx0 + dx * (h / 2 - 0.1), ry0 + dy * (h / 2 - 0.1), z, 0, 0, rz);
      }
      g.rock(0.62, 0x4e342e, rx0, ry0, 0.15, 1, 1, 1, 0.4);
      // fissures incandescentes
      g.box(0.55, 0.07, 0.7, 0xff8f00, rx0, ry0 + 0.05, 0.12, 0, 0.5, 0.4);
      g.box(0.07, 0.45, 0.7, 0xffb300, rx0 - 0.08, ry0 - 0.08, 0.14, 0, 0, 0.3);
      // étincelles
      g.ball(0.09, 0xffe082, 0.62, -0.05, 0.25);
      g.ball(0.07, 0xffcc80, -0.05, 0.62, 0.25);
    },
  },
  reinforce: {
    medal: 0x1e5aa8,
    rot: [0.15, -0.35, 0],
    build(g) {
      // deux grandes épées croisées derrière un bouclier
      sword(g, -0.55, -0.7, 0.62, 2.2);
      sword(g, 0.55, -0.7, -0.62, 2.2);
      g.cyl(0.5, 0.5, 0.16, 12, 0x2f6fd0, 0, -0.25, 0.3, Math.PI / 2);
      g.torus(0.48, GOLD, 0, -0.25, 0.39);
      g.ball(0.14, GOLD, 0, -0.25, 0.43);
      g.box(0.07, 0.78, 0.06, 0xf5e6b8, 0, -0.25, 0.41);
      g.box(0.78, 0.07, 0.06, 0xf5e6b8, 0, -0.25, 0.41);
    },
  },
  // ------------------------------------------------ compétences
  charge: {
    medal: 0x334155,
    rot: [0.1, -0.3, 0],
    build(g) {
      const rz = -0.85, dx = -Math.sin(rz), dy = Math.cos(rz), px = -dy, py = dx;
      sword(g, 0.3, 0, rz, 2.0);
      // traînée de vitesse : trois traits dans l'axe de l'élan, derrière le pommeau
      const bx = 0.3 - dx * 0.95, by = 0 - dy * 0.95;
      for (const [k, l] of [[-0.28, 0.55], [0, 0.85], [0.28, 0.55]] as const) {
        g.box(l, 0.07, 0.04, 0xe2e8f0, bx + px * k - dx * l * 0.5, by + py * k - dy * l * 0.5, 0, 0, 0, Math.atan2(dy, dx));
      }
    },
  },
  pierce: {
    medal: 0x2f7d32,
    rot: [0.15, -0.55, 0],
    build(g) {
      // cible
      g.cyl(0.78, 0.78, 0.16, 14, 0xfff7e6, 0.1, 0, 0, Math.PI / 2);
      g.cyl(0.58, 0.58, 0.18, 14, RED, 0.1, 0, 0, Math.PI / 2);
      g.cyl(0.38, 0.38, 0.2, 14, 0xfff7e6, 0.1, 0, 0, Math.PI / 2);
      g.cyl(0.18, 0.18, 0.22, 14, RED, 0.1, 0, 0, Math.PI / 2);
      // flèche qui la traverse
      g.box(2.2, 0.08, 0.08, WOOD, 0.05, 0.05, 0.05, 0, 0.5, 0);
      g.cone(0.13, 0.32, 4, STEEL, 1.05, 0.05, -0.5, 0, 0.5, -Math.PI / 2);
      for (const s of [1, -1]) g.shape([[0, 0], [0.42, 0], [0.5, 0.2 * s], [0.12, 0.2 * s]], 0.03, 0x7bd36b, -1.08, 0.05, 0.62, 0, 0.5, 0);
    },
  },
};

let gl: THREE.WebGLRenderer | null = null;

/** Rend les icônes demandées en images (data URL), `size` pixels de côté. */
export function renderIcons3D(keys: string[] = Object.keys(ICONS3D), size = 192): Record<string, string> {
  const out: Record<string, string> = {};
  const canvas = document.createElement('canvas');
  try {
    gl ??= new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  const inner = Math.round(size * 0.86);
  gl.setPixelRatio(1);
  gl.setSize(inner, inner, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4a3a, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-2, 3, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const out2d = document.createElement('canvas');
  out2d.width = out2d.height = size;
  const cx = out2d.getContext('2d')!;
  const sil = document.createElement('canvas');
  sil.width = sil.height = inner;
  const sx = sil.getContext('2d')!;

  for (const key of keys) {
    const def = ICONS3D[key];
    if (!def) continue;
    const g = new GB(7);
    g.jitter = 0.05;
    g.ao = false;
    def.build(g);
    const geo = g.build();
    const mesh = new THREE.Mesh(geo, mat);
    const [rx, ry, rz] = def.rot ?? [0, 0, 0];
    mesh.rotation.set(rx, ry, rz);
    // cadrage : la sphère englobante remplit l'image
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere!;
    mesh.position.set(-bs.center.x, -bs.center.y, -bs.center.z).applyEuler(mesh.rotation);
    const fill = (def.medal ? 0.78 : 0.96) * (def.zoom ?? 1);
    const d = bs.radius / Math.tan(THREE.MathUtils.degToRad(11)) / fill;
    cam.position.set(0, 0, d);
    cam.lookAt(0, 0, 0);
    scene.add(mesh);
    gl.render(scene, cam);
    scene.remove(mesh);
    geo.dispose();

    cx.clearRect(0, 0, size, size);
    const c = size / 2;
    // médaillon : disque teinté, bord sombre, reflet en haut
    if (def.medal !== undefined) {
      const col = new THREE.Color(def.medal);
      const hex = (k: number) => '#' + col.clone().multiplyScalar(k).getHexString();
      const r = size * 0.46;
      cx.fillStyle = 'rgba(0,0,0,0.35)';
      cx.beginPath(); cx.arc(c, c + size * 0.025, r, 0, Math.PI * 2); cx.fill();
      const grd = cx.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r);
      grd.addColorStop(0, '#' + col.clone().lerp(new THREE.Color(0xffffff), 0.25).getHexString());
      grd.addColorStop(1, hex(0.7));
      cx.fillStyle = grd;
      cx.beginPath(); cx.arc(c, c, r, 0, Math.PI * 2); cx.fill();
      cx.lineWidth = size * 0.045;
      cx.strokeStyle = hex(0.42);
      cx.beginPath(); cx.arc(c, c, r - cx.lineWidth / 2, 0, Math.PI * 2); cx.stroke();
      cx.lineWidth = size * 0.02;
      cx.strokeStyle = 'rgba(255,255,255,0.28)';
      cx.beginPath(); cx.arc(c, c, r * 0.8, Math.PI * 1.1, Math.PI * 1.7); cx.stroke();
    }
    // contour sombre : silhouette de l'objet tamponnée autour, puis l'objet
    const off = (size - inner) / 2;
    sx.clearRect(0, 0, inner, inner);
    sx.globalCompositeOperation = 'source-over';
    sx.drawImage(canvas, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = '#14181b';
    sx.fillRect(0, 0, inner, inner);
    sx.globalCompositeOperation = 'source-over';
    const w = size * 0.022;
    cx.globalAlpha = 0.35;
    cx.drawImage(sil, off + w * 0.6, off + w * 1.6);
    cx.globalAlpha = 1;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      cx.drawImage(sil, off + Math.cos(a) * w, off + Math.sin(a) * w);
    }
    cx.drawImage(canvas, off, off);
    out[key] = out2d.toDataURL('image/png');
  }
  mat.dispose();
  return out;
}
