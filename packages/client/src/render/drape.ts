import type * as THREE from 'three';

/**
 * Marques au sol (anneaux de sélection, portée, visée) posées sur le relief : chaque sommet est relevé
 * à la hauteur du terrain sous lui (+ `lift`). Une marque plate s'enfonçait en partie dans les ondulations.
 * La géométrie doit être horizontale (rotation déjà appliquée) ; le maillage peut être déplacé et mis à l'échelle.
 */
export function drape(mesh: THREE.Mesh, heightAt: (x: number, z: number) => number, lift = 0.05) {
  const g = mesh.geometry;
  const pos = g.attributes.position as THREE.BufferAttribute;
  let base = g.userData.drapeBase as Float32Array | undefined;
  if (!base) base = g.userData.drapeBase = new Float32Array(pos.array as Float32Array);
  mesh.updateWorldMatrix(true, false);
  const e = mesh.matrixWorld.elements;
  const sy = e[5] || 1;
  for (let i = 0; i < pos.count; i++) {
    const lx = base[i * 3], lz = base[i * 3 + 2];
    const wx = e[0] * lx + e[8] * lz + e[12], wz = e[2] * lx + e[10] * lz + e[14];
    pos.setY(i, (heightAt(wx, wz) + lift - e[13]) / sy);
  }
  pos.needsUpdate = true;
  g.computeBoundingSphere();
}
