import * as THREE from 'three';
import { PROP_FOUND, PropKind, SECRETS, type Biome, type MapProp, type Snapshot } from '@dfend/shared';
import { barrelGeometry, campGeometry, secretGeometry } from '../art/props';
import { worldMaterial } from './materials';
import { settings } from '../settings';

interface Item {
  p: MapProp;
  root: THREE.Group;
  y: number;
  /** secousse après un clic (1 → 0) */
  wob: number;
  /** échelle de base (lisible de loin) */
  k: number;
}

/**
 * Carte interactive : dessine les éléments cliquables selon leur état (tonneau sauté, secret trouvé)
 * et un anneau sous celui que vise le curseur.
 */
export class PropsView {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private ring: THREE.Mesh;

  constructor(props: MapProp[], private biome: Biome, heightAt: (x: number, z: number) => number) {
    const mat = worldMaterial();
    props.forEach((p) => {
      const root = new THREE.Group();
      const y = Math.max(0, heightAt(p.x, p.z)) - 0.04;
      root.position.set(p.x, y, p.z);
      root.rotation.y = -p.ang;
      const geo = p.kind === PropKind.Poudre ? barrelGeometry() : p.kind === PropKind.Camp ? campGeometry() : secretGeometry(SECRETS[biome]?.[p.v]?.id ?? 'mouton');
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = settings.shadows;
      mesh.receiveShadow = true;
      root.add(mesh);
      this.group.add(root);
      this.items.push({ p, root, y, wob: 0, k: p.kind === PropKind.Camp ? 1.3 : p.kind === PropKind.Poudre ? 1.25 : 1.1 });
    });
    const ring = new THREE.RingGeometry(0.85, 1, 40);
    ring.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.group.add(this.ring);
  }

  /** Secousse d'un élément cliqué (secret qui réagit, mèche allumée…). */
  poke(i: number) {
    const it = this.items[i];
    if (it) it.wob = 1;
  }

  /** Peut-il servir maintenant ? (tonneau pas encore sauté, camp reposé) */
  static ready(p: MapProp, st: number, cd: number) {
    return p.kind !== PropKind.Secret && cd <= 0 && st === 0;
  }

  update(dt: number, time: number, snap: Snapshot | null, hover: number) {
    this.items.forEach((it, i) => {
      const st = snap && i < snap.propN ? snap.propState[i] : 0;
      const p = it.p;
      const vanish = p.kind === PropKind.Secret && st === PROP_FOUND && SECRETS[this.biome]?.[p.v]?.vanish;
      it.root.visible = !((p.kind === PropKind.Poudre && st === 1) || vanish);
      it.wob = Math.max(0, it.wob - dt * 2.2);
      // seuls les secrets réagissent au clic (secousse, petit saut, battement sous le curseur) :
      // le camp et le tonneau ouvrent leur menu sans bouger
      const secret = p.kind === PropKind.Secret;
      const w = secret ? it.wob : 0;
      const sq = 1 + Math.sin(w * Math.PI * 4) * 0.12 * w;
      const k = it.k * (secret && hover === i ? 1 + 0.04 * Math.sin(time * 6) : 1);
      it.root.scale.set(k / Math.sqrt(sq), k * sq, k / Math.sqrt(sq));
      it.root.position.y = it.y + Math.sin(w * Math.PI) * 0.25 * w;
      it.root.rotation.y = -p.ang + Math.sin(w * Math.PI * 6) * 0.15 * w;
    });
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
