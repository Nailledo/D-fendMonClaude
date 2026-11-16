/**
 * Génère des GLB de test (un bipède riggé texturé, une tour statique) dans assets/models-src/
 * pour valider la cuisson sans modèle Higgsfield :  pnpm tsx tools/models/test-glb.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { PNG } from 'pngjs';

const OUT = 'assets/models-src';
mkdirSync(OUT, { recursive: true });

function box(doc: Document, buffer: ReturnType<Document['createBuffer']>, w: number, h: number, d: number, cx: number, cy: number, cz: number, uvOff: number, joint: number) {
  const P: number[] = [], N: number[] = [], UV: number[] = [], J: number[] = [], W: number[] = [], I: number[] = [];
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  let v = 0;
  for (const [n, u, r] of faces) {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      P.push(cx + (n[0] * 0.5 + u[0] * 0.5 * b + r[0] * 0.5 * a) * w, cy + (n[1] * 0.5 + u[1] * 0.5 * b + r[1] * 0.5 * a) * h, cz + (n[2] * 0.5 + u[2] * 0.5 * b + r[2] * 0.5 * a) * d);
      N.push(...n);
      UV.push(uvOff + (a + 1) * 0.1, (b + 1) * 0.45);
      J.push(joint, 0, 0, 0); W.push(1, 0, 0, 0);
    }
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }
  return { P, N, UV, J, W, I };
}

async function build(file: string, rigged: boolean) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const parts = rigged
    ? [box(doc, buffer, 0.5, 0.6, 0.3, 0, 0.95, 0, 0, 0), box(doc, buffer, 0.35, 0.35, 0.35, 0, 1.45, 0, 0.2, 0),
       box(doc, buffer, 0.18, 0.65, 0.2, 0.14, 0.33, 0, 0.4, 1), box(doc, buffer, 0.18, 0.65, 0.2, -0.14, 0.33, 0, 0.4, 2),
       box(doc, buffer, 0.14, 0.55, 0.16, 0.36, 0.95, 0, 0.6, 3), box(doc, buffer, 0.14, 0.55, 0.16, -0.36, 0.95, 0, 0.6, 4)]
    : [box(doc, buffer, 2, 0.4, 2, 0, 0.2, 0, 0, 0), box(doc, buffer, 1.2, 2.4, 1.2, 0, 1.6, 0, 0.3, 0), box(doc, buffer, 1.6, 0.5, 1.6, 0, 3.0, 0, 0.6, 0)];
  const P: number[] = [], N: number[] = [], UV: number[] = [], J: number[] = [], W: number[] = [], I: number[] = [];
  for (const p of parts) { const o = P.length / 3; P.push(...p.P); N.push(...p.N); UV.push(...p.UV); J.push(...p.J); W.push(...p.W); I.push(...p.I.map((i) => i + o)); }
  const acc = (t: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', a: Float32Array | Uint16Array) => doc.createAccessor().setType(t).setArray(a).setBuffer(buffer);
  // texture damier colorée
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const o = (y * 64 + x) * 4; const c = ((x >> 3) + (y >> 3)) & 1; png.data[o] = c ? 220 : 60; png.data[o + 1] = x * 3; png.data[o + 2] = c ? 80 : 200; png.data[o + 3] = 255; }
  const tex = doc.createTexture().setImage(new Uint8Array(PNG.sync.write(png))).setMimeType('image/png');
  const mat = doc.createMaterial().setBaseColorTexture(tex);
  const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', Float32Array.from(P))).setAttribute('NORMAL', acc('VEC3', Float32Array.from(N)))
    .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(UV))).setIndices(acc('SCALAR', Uint16Array.from(I))).setMaterial(mat);
  const mesh = doc.createMesh().addPrimitive(prim);
  const node = doc.createNode('model').setMesh(mesh);
  const scene = doc.createScene().addChild(node);
  if (rigged) {
    prim.setAttribute('JOINTS_0', acc('VEC4', Uint16Array.from(J))).setAttribute('WEIGHTS_0', acc('VEC4', Float32Array.from(W)));
    const names = ['Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftArm', 'RightArm'];
    const pos: [number, number, number][] = [[0, 0.65, 0], [0.14, 0.65, 0], [-0.14, 0.65, 0], [0.36, 1.2, 0], [-0.36, 1.2, 0]];
    const joints = names.map((n, i) => doc.createNode(n).setTranslation(i === 0 ? pos[0] : [pos[i][0], pos[i][1] - pos[0][1], 0]));
    for (let i = 1; i < joints.length; i++) joints[0].addChild(joints[i]);
    scene.addChild(joints[0]);
    const ibm = new Float32Array(16 * joints.length);
    joints.forEach((_, i) => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -pos[i][0], -pos[i][1], -pos[i][2], 1], i * 16); });
    const skin = doc.createSkin().setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
    for (const j of joints) skin.addJoint(j);
    node.setSkin(skin);
  }
  const bytes = await new NodeIO().writeBinary(doc);
  writeFileSync(join(OUT, file), bytes);
  console.log(`${file} : ${bytes.byteLength} octets, ${I.length / 3} triangles`);
}

await build('enemy-gobelin.glb', true);
await build('tower-0-0.glb', false);
await build('decor-vallee-chene-0.glb', false);
