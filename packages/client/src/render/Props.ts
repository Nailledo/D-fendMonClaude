import * as THREE from 'three';
import { PROP_FOUND, PropKind, SECRETS, type Biome, type MapProp, type Snapshot } from '@dfend/shared';
import { barrelGeometry, bridgeGeometry, campGeometry, secretGeometry } from '../art/props';
import { worldMaterial } from './materials';
import { settings } from '../settings';

interface Item {
  p: MapProp;
  root: THREE.Group;
  meshes: THREE.Mesh[];
  /** pont : tablier effondré */
  alt: THREE.Mesh | null;
  y: number;
  /** secousse après un clic (1 → 0) */
  wob: number;
  /** apparition (tonneau livré) 0 → 1 */
  pop: number;
  st: number;
  /** échelle de base (lisible de loin) */
  k: number;
}

/**
 * Carte interactive : dessine les éléments cliquables selon leur état (pont effondré, tonneau sauté,
 * secret trouvé), un losange doré au-dessus de ceux qui sont prêts, et un anneau sous celui que vise le curseur.
 */
export class PropsView {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private gems: THREE.InstancedMesh;
  private ring: THREE.Mesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(props: MapProp[], private biome: Biome, heightAt: (x: number, z: number) => number) {
    const mat = worldMaterial();
    props.forEach((p) => {
      const root = new THREE.Group();
      const y = p.kind === PropKind.Pont ? 0 : Math.max(0, heightAt(p.x, p.z)) - 0.04;
      root.position.set(p.x, y, p.z);
      // le pont suit le chemin (+x local = direction du chemin)
      root.rotation.y = -p.ang;
      let geo: THREE.BufferGeometry;
      if (p.kind === PropKind.Pont) geo = bridgeGeometry(biome, false);
      else if (p.kind === PropKind.Poudre) geo = barrelGeometry();
      else if (p.kind === PropKind.Camp) geo = campGeometry();
      else geo = secretGeometry(SECRETS[biome]?.[p.v]?.id ?? 'mouton');
      const main = new THREE.Mesh(geo, mat);
      main.castShadow = settings.shadows;
      main.receiveShadow = true;
      root.add(main);
      let alt: THREE.Mesh | null = null;
      if (p.kind === PropKind.Pont) {
        alt = new THREE.Mesh(bridgeGeometry(biome, true), mat);
        alt.visible = false;
        alt.receiveShadow = true;
        root.add(alt);
      }
      this.group.add(root);
      this.items.push({ p, root, meshes: [main], alt, y, wob: 0, pop: 1, st: 0, k: p.kind === PropKind.Camp ? 1.3 : p.kind === PropKind.Poudre ? 1.25 : 1.1 });
    });
    const gem = new THREE.OctahedronGeometry(0.2, 0);
    gem.scale(1, 1.5, 1);
    this.gems = new THREE.InstancedMesh(gem, new THREE.MeshBasicMaterial({ color: 0xffd54f }), Math.max(1, props.length));
    this.gems.count = 0;
    this.gems.frustumCulled = false;
    this.group.add(this.gems);
    const ring = new THREE.RingGeometry(0.85, 1, 40);
    ring.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.group.add(this.ring);
  }

  /** Secousse d'un élément cliqué (secret qui réagit, tonneau qui saute…). */
  poke(i: number) {
    const it = this.items[i];
    if (it) it.wob = 1;
  }

  /** Est-il prêt à servir ? (losange doré au-dessus) */
  static ready(p: MapProp, st: number, cd: number) {
    if (p.kind === PropKind.Secret) return false;
    if (cd > 0) return false;
    return st === 0;
  }

  update(dt: number, time: number, snap: Snapshot | null, hover: number) {
    let n = 0;
    this.items.forEach((it, i) => {
      const st = snap && i < snap.propN ? snap.propState[i] : 0;
      const cd = snap && i < snap.propN ? snap.propCd[i] : 0;
      const p = it.p;
      if (st !== it.st) {
        // tonneau livré : il apparaît en grandissant
        if (p.kind === PropKind.Poudre && st === 0) it.pop = 0;
        it.st = st;
      }
      const vanish = p.kind === PropKind.Secret && st === PROP_FOUND && SECRETS[this.biome]?.[p.v]?.vanish;
      const gone = (p.kind === PropKind.Poudre && st === 1) || vanish;
      it.root.visible = !gone;
      if (it.alt) {
        it.alt.visible = st === 1;
        it.meshes[0].visible = st !== 1;
      }
      it.pop = Math.min(1, it.pop + dt * 2.5);
      it.wob = Math.max(0, it.wob - dt * 2.2);
      if (p.kind !== PropKind.Pont) {
        const w = it.wob;
        const pop = (1 - (1 - it.pop) ** 3) * it.k;
        // secousse : écrasement puis rebond, petit saut
        const sq = 1 + Math.sin(w * Math.PI * 4) * 0.12 * w;
        const hov = hover === i ? 1 + 0.04 * Math.sin(time * 6) : 1;
        it.root.scale.set(pop * hov / Math.sqrt(sq), pop * hov * sq, pop * hov / Math.sqrt(sq));
        it.root.position.y = it.y + Math.sin(w * Math.PI) * 0.25 * w;
        it.root.rotation.y = -p.ang + Math.sin(w * Math.PI * 6) * 0.15 * w;
      }
      if (PropsView.ready(p, st, cd) && !gone) {
        const h = p.kind === PropKind.Camp ? 2.6 : p.kind === PropKind.Pont ? 1.5 : 1.35;
        this.v.set(p.x, it.y + h + Math.sin(time * 2.5 + i) * 0.1, p.z);
        this.q.setFromEuler(this.e.set(0, time * 1.8 + i, 0));
        this.s.setScalar(hover === i ? 1.3 : 1);
        this.m.compose(this.v, this.q, this.s);
        this.gems.setMatrixAt(n++, this.m);
      }
    });
    this.gems.count = n;
    this.gems.instanceMatrix.needsUpdate = true;
    const h = this.items[hover];
    this.ring.visible = !!h && h.root.visible && h.p.kind !== PropKind.Secret;
    if (h) {
      this.ring.position.set(h.p.x, h.y + 0.1, h.p.z);
      this.ring.scale.setScalar(h.p.r * (1 + 0.05 * Math.sin(time * 5)));
    }
  }

  /** Élément sous le point (x, z) dans un rayon de clic `pad` en plus du sien, ou -1. */
  at(x: number, z: number, pad: number, snap: Snapshot | null): number {
    let best = -1, bd = Infinity;
    this.items.forEach((it, i) => {
      if (!it.root.visible) return;
      const st = snap && i < snap.propN ? snap.propState[i] : 0;
      // secret trouvé : il ne réagit plus
      if (it.p.kind === PropKind.Secret && st === PROP_FOUND) return;
      const r = it.p.r + pad;
      const d = (it.p.x - x) ** 2 + (it.p.z - z) ** 2;
      if (d < r * r && d < bd) { bd = d; best = i; }
    });
    return best;
  }
}
