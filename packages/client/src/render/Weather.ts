import * as THREE from 'three';
import { TORCH_R } from '@dfend/shared';
import { drape } from './drape';

const DROPS = 1400;
/** demi-côté de la boîte de pluie autour du centre de la vue, hauteur de chute */
const BOX = 30;
const TOP = 16;

/**
 * Météo affichée : torches de la carte (allumées la nuit, avec le halo de la zone où les archers gardent
 * leur portée) et rideau de pluie qui suit la caméra. L'éclairage de la scène est réglé par le Renderer.
 */
export class WeatherView {
  readonly group = new THREE.Group();
  private flames: THREE.InstancedMesh;
  private pools: THREE.Mesh[] = [];
  private poolMat: THREE.MeshBasicMaterial;
  private flameMat: THREE.MeshBasicMaterial;
  private rain: THREE.LineSegments;
  private rainMat: THREE.LineBasicMaterial;
  private drops = new Float32Array(DROPS * 3);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private torches: { x: number; z: number }[], heightAt: (x: number, z: number) => number) {
    // poteaux : bois et coupelle de fer
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 1.5, 6);
    pole.translate(0, 0.75, 0);
    const cup = new THREE.CylinderGeometry(0.2, 0.1, 0.18, 8);
    cup.translate(0, 1.55, 0);
    const wood = new THREE.InstancedMesh(pole, new THREE.MeshLambertMaterial({ color: 0x6d4c33 }), Math.max(1, torches.length));
    const iron = new THREE.InstancedMesh(cup, new THREE.MeshLambertMaterial({ color: 0x3a3a3a }), Math.max(1, torches.length));
    const flame = new THREE.ConeGeometry(0.16, 0.5, 7);
    flame.translate(0, 0.25, 0);
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.9, depthWrite: false });
    this.flames = new THREE.InstancedMesh(flame, this.flameMat, Math.max(1, torches.length));
    this.poolMat = new THREE.MeshBasicMaterial({ color: 0xffc56b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const disc = new THREE.CircleGeometry(TORCH_R, 40);
    disc.rotateX(-Math.PI / 2);
    torches.forEach((t, i) => {
      const y = heightAt(t.x, t.z);
      this.m.makeTranslation(t.x, y, t.z);
      wood.setMatrixAt(i, this.m);
      iron.setMatrixAt(i, this.m);
      const pool = new THREE.Mesh(disc.clone(), this.poolMat);
      pool.position.set(t.x, 0, t.z);
      pool.renderOrder = 2;
      drape(pool, heightAt, 0.07);
      this.pools.push(pool);
      this.group.add(pool);
    });
    wood.count = iron.count = this.flames.count = torches.length;
    for (const o of [wood, iron]) { o.castShadow = true; o.instanceMatrix.needsUpdate = true; }
    this.group.add(wood, iron, this.flames);
    this.heights = torches.map((t) => heightAt(t.x, t.z));
    // pluie : segments obliques, réinjectés en haut de la boîte
    for (let i = 0; i < DROPS; i++) {
      this.drops[i * 3] = (Math.random() * 2 - 1) * BOX;
      this.drops[i * 3 + 1] = Math.random() * TOP;
      this.drops[i * 3 + 2] = (Math.random() * 2 - 1) * BOX;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xc9d8ea, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);
  }
  private heights: number[];

  /** `rain`, `night` : intensités (0..1) ; cx, cz : centre de la vue. */
  update(dt: number, time: number, rain: number, night: number, cx: number, cz: number) {
    // flammes : vacillent toujours, plus grosses et plus vives la nuit
    const fs = 0.55 + 0.6 * night;
    this.torches.forEach((t, i) => {
      const k = 1 + 0.18 * Math.sin(time * 13 + i * 2.1) + 0.1 * Math.sin(time * 23 + i);
      this.s.set(fs * (1 - rain * 0.3), fs * k * (1 - rain * 0.3), fs * (1 - rain * 0.3));
      this.v.set(t.x, this.heights[i] + 1.62, t.z);
      this.m.compose(this.v, this.q, this.s);
      this.flames.setMatrixAt(i, this.m);
    });
    this.flames.instanceMatrix.needsUpdate = true;
    this.flameMat.color.setHex(night > 0.5 ? 0xffc04d : 0xff9a2e);
    this.poolMat.opacity = night * (0.2 + 0.03 * Math.sin(time * 9));
    for (const p of this.pools) p.visible = night > 0.02;
    // pluie
    this.rain.visible = rain > 0.01;
    this.rainMat.opacity = rain * 0.55;
    if (!this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array;
    const fall = 22 * dt;
    for (let i = 0; i < DROPS; i++) {
      const o = i * 3;
      let y = this.drops[o + 1] - fall;
      if (y < 0) {
        y += TOP;
        this.drops[o] = (Math.random() * 2 - 1) * BOX;
        this.drops[o + 2] = (Math.random() * 2 - 1) * BOX;
      }
      this.drops[o + 1] = y;
      const x = cx + this.drops[o], z = cz + this.drops[o + 2];
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z;
      a[i * 6 + 3] = x + 0.12; a[i * 6 + 4] = y + 0.75; a[i * 6 + 5] = z + 0.06;
    }
    pos.needsUpdate = true;
  }
}
