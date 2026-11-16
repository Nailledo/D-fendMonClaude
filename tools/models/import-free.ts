/**
 * Importe des modèles de packs gratuits (CC0) vers assets/models-src/ sous les noms attendus par le catalogue :
 *   pnpm tsx tools/models/import-free.ts
 *
 * Les packs sont à extraire dans assets/models-src/_packs/<dossier>/ (voir docs/modeles-3d-sources-gratuites.md).
 * Chaque source (.glb ou .gltf + .bin + textures) est relue puis réécrite en un seul GLB autonome.
 * Une source absente est simplement ignorée : on peut relancer le script après avoir ajouté un pack.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, getBounds, type Document } from '@gltf-transform/core';
import { dedup, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'assets/models-src');
const PACKS = join(SRC, '_packs');

const KK_ADV = 'kaykit-adventurers/KayKit_Adventurers_2.0_FREE/Characters/gltf';
const KK_SKE = 'kaykit-skeletons/KayKit_Skeletons_1.1_FREE/characters/gltf';
const RTS = 'quaternius-rts/glTF';
const KEN = 'kenney-td/Models/GLB format';
const MON = 'quaternius-monsters/Ultimate Monsters';
const NAT = 'quaternius-nature/glTF';

/**
 * FREE_SOURCES : fichier attendu par le catalogue -> chemin de la source dans _packs/, ou recette.
 *
 * Les 81 entrées du catalogue ont une source ; les remplaçants approximatifs sont signalés en commentaire.
 */
/** Source composée : pièces empilées de bas en haut, teinte multipliée sur les matériaux, étirement (x, y, z). */
export interface Recipe {
  parts: string[];
  tint?: [number, number, number];
  scale?: [number, number, number];
  /** 0..1 : désature textures et matériaux avant la teinte (pour changer franchement de couleur) */
  desat?: number;
  /** ne garde que les maillages dont le nom correspond (ex. la tête d'un squelette) */
  only?: RegExp;
}
const KR = (...n: string[]) => n.map((p) => `${KEN}/tower-round-${p}.glb`);
const KS = (...n: string[]) => n.map((p) => `${KEN}/tower-square-${p}.glb`);
const one = (path: string, tint?: Recipe['tint'], scale?: Recipe['scale']): Recipe => ({ parts: [path], tint, scale });

export const FREE_SOURCES: Record<string, string | Recipe> = {
  // héros
  'hero-samuel.glb': `${KK_ADV}/Knight.glb`,
  'hero-lyra.glb': `${KK_ADV}/Rogue.glb`,
  'hero-nox.glb': `${KK_ADV}/Mage.glb`,
  // soldats
  'soldier-0.glb': `${KK_ADV}/Ranger.glb`,
  'soldier-1.glb': `${KK_ADV}/Knight.glb`,
  'soldier-4.glb': `${KK_ADV}/Rogue_Hooded.glb`,
  'soldier-5.glb': `${KK_ADV}/Barbarian.glb`,
  'soldier-6.glb': `${KK_SKE}/Skeleton_Warrior.glb`,
  'soldier-7.glb': `${KEN}/weapon-turret.glb`,
  // tours
  'tower-0-0.glb': `${RTS}/WatchTower_FirstAge_Level1.gltf`,
  'tower-0-1.glb': `${RTS}/WatchTower_FirstAge_Level2.gltf`,
  'tower-0-2.glb': `${RTS}/WatchTower_FirstAge_Level3.gltf`,
  'tower-0-3.glb': `${RTS}/WatchTower_SecondAge_Level3.gltf`,
  'tower-0-4.glb': `${RTS}/Archery_SecondAge_Level3.gltf`,
  'tower-1-0.glb': `${RTS}/Barracks_FirstAge_Level1.gltf`,
  'tower-1-1.glb': `${RTS}/Barracks_FirstAge_Level2.gltf`,
  'tower-1-2.glb': `${RTS}/Barracks_FirstAge_Level3.gltf`,
  'tower-1-3.glb': `${RTS}/Barracks_SecondAge_Level3.gltf`,
  // ennemis
  'enemy-grolbak.glb': `${MON}/Big/glTF/BlueDemon.gltf`,
  'enemy-chauvesouris.glb': `${MON}/Flying/glTF/Pigeon.gltf`,
  'enemy-gobelin.glb': `${MON}/Blob/glTF/Orc.gltf`,
  'enemy-brute.glb': `${MON}/Big/glTF/Orc.gltf`,
  'enemy-chaman.glb': `${MON}/Big/glTF/Tribal.gltf`,
  'enemy-bouclier.glb': `${MON}/Big/glTF/Orc_Skull.gltf`,
  'enemy-crapaud.glb': `${MON}/Big/glTF/Frog.gltf`,
  'enemy-limon.glb': `${MON}/Blob/glTF/GreenSpikyBlob.gltf`,
  'enemy-petitlimon.glb': `${MON}/Blob/glTF/GreenBlob.gltf`,
  'enemy-diablotin.glb': `${MON}/Flying/glTF/Demon.gltf`,
  'enemy-cornu.glb': `${MON}/Big/glTF/Demon.gltf`,
  'enemy-invocateur.glb': `${MON}/Blob/glTF/Wizard.gltf`,
  'enemy-gargouille.glb': `${MON}/Flying/glTF/Dragon.gltf`,
  // ennemis approchés par une teinte ou un modèle voisin
  'enemy-corbeau.glb': one(`${MON}/Flying/glTF/Pigeon.gltf`, [0.25, 0.25, 0.32]),
  'enemy-noye.glb': one(`${KK_SKE}/Skeleton_Minion.glb`, [0.5, 0.85, 0.8]),
  'enemy-sorciere.glb': one(`${KK_SKE}/Skeleton_Mage.glb`, [0.65, 0.9, 0.55]),
  'enemy-golem.glb': one(`${MON}/Big/glTF/Yeti.gltf`, [0.5, 0.4, 0.38]),
  'enemy-chevalierinf.glb': one(`${KK_ADV}/Knight.glb`, [0.8, 0.3, 0.3]),
  'enemy-kessin1.glb': one(`${MON}/Big/glTF/Demon.gltf`, [0.7, 0.45, 0.95]),
  'enemy-kessin2.glb': one(`${MON}/Big/glTF/BlueDemon.gltf`, [1, 0.4, 0.4]),
  'enemy-kessin3.glb': one(`${MON}/Flying/glTF/Dragon_Evolved.gltf`, [0.75, 0.4, 0.6]),
  'enemy-loup.glb': { parts: [`${MON}/Blob/glTF/Dog.gltf`], desat: 1, tint: [0.62, 0.64, 0.72] },
  'enemy-ver.glb': { parts: [`${MON}/Flying/glTF/Squidle.gltf`], desat: 0.7, tint: [0.85, 0.6, 0.5] },
  'enemy-vasiere.glb': { parts: [`${MON}/Blob/glTF/GreenBlob.gltf`], desat: 1, tint: [0.6, 0.42, 0.26] },
  // héros et soldats approchés
  'hero-brom.glb': one(`${KK_ADV}/Barbarian.glb`, [1, 0.8, 0.7], [1.35, 1, 1.35]),
  'soldier-2.glb': one(`${KK_ADV}/Knight.glb`, [0.7, 0.78, 1]),
  'soldier-3.glb': one(`${KK_ADV}/Knight.glb`, [1, 0.82, 0.4]),
  // tours assemblées à partir des pièces du Tower Defense Kit de Kenney
  'tower-1-4.glb': { parts: KS('bottom-b', 'middle-b', 'roof-b'), tint: [0.55, 0.5, 0.72] },
  'tower-2-0.glb': { parts: KR('bottom-a', 'roof-a'), tint: [0.72, 0.62, 1] },
  'tower-2-1.glb': { parts: KR('bottom-a', 'middle-a', 'roof-b'), tint: [0.72, 0.62, 1] },
  'tower-2-2.glb': { parts: KR('bottom-b', 'middle-b', 'top-b', 'roof-c'), tint: [0.72, 0.62, 1] },
  'tower-2-3.glb': { parts: KR('bottom-c', 'middle-c', 'top-c', 'crystals'), tint: [1, 0.95, 0.6] },
  'tower-2-4.glb': { parts: KR('bottom-c', 'middle-c', 'top-c', 'crystals'), tint: [0.6, 0.85, 1] },
  'tower-3-0.glb': { parts: [...KS('bottom-a'), `${KEN}/weapon-catapult.glb`] },
  'tower-3-1.glb': { parts: [...KS('bottom-a', 'middle-a'), `${KEN}/weapon-cannon.glb`] },
  'tower-3-2.glb': { parts: [...KS('bottom-b', 'middle-b', 'top-b'), `${KEN}/weapon-cannon.glb`] },
  'tower-3-3.glb': { parts: [...KS('bottom-c', 'middle-c', 'top-c'), `${KEN}/weapon-turret.glb`], tint: [0.7, 0.8, 1] },
  'tower-3-4.glb': { parts: [...KS('bottom-c', 'middle-c'), `${KEN}/weapon-ballista.glb`], tint: [1, 0.55, 0.4] },
  // bâtiments
  'gate-vallee.glb': `${RTS}/WallTowers_DoorClosed_SecondAge.gltf`,
  'gate-marais.glb': one(`${RTS}/WallTowers_DoorClosed_FirstAge.gltf`, [0.7, 0.8, 0.65]),
  'gate-cendre.glb': one(`${RTS}/WallTowers_DoorClosed_SecondAge.gltf`, [0.55, 0.35, 0.35]),
  'spawn-vallee.glb': `${RTS}/Mine.gltf`,
  'spawn-marais.glb': one(`${RTS}/Mine.gltf`, [0.6, 0.75, 0.55]),
  'spawn-cendre.glb': one(`${RTS}/Mine.gltf`, [0.5, 0.3, 0.3]),
  // décor
  'decor-vallee-chene-0.glb': `${RTS}/Resource_Tree1.gltf`,
  'decor-vallee-chene-1.glb': `${RTS}/Resource_Tree2.gltf`,
  'decor-cendre-basalte-0.glb': one(`${RTS}/Resource_Rock_3.gltf`, [0.35, 0.33, 0.38], [1, 2.4, 1]),
  'decor-cendre-cristal-0.glb': one(`${RTS}/Resource_Gold_2.gltf`, [1, 0.45, 0.3]),
  'decor-cendre-rocher-0.glb': one(`${RTS}/Rock.gltf`, [0.42, 0.36, 0.36]),
  'decor-cendre-pic-0.glb': one(`${RTS}/Mountain_Single.gltf`, [0.45, 0.38, 0.38]),
  'decor-marais-champignon-0.glb': `${MON}/Blob/glTF/Mushnub.gltf`,
  'decor-marais-saule-0.glb': one(`${RTS}/Resource_Tree1.gltf`, [0.75, 0.95, 0.7], [1.35, 1, 1.35]),
  'decor-cendre-crane-0.glb': { parts: [`${KK_SKE}/Skeleton_Minion.glb`], only: /Head|Jaw|Eyes/ },
  // végétaux à feuillage découpé (texture transparente)
  'decor-vallee-buisson-0.glb': one(`${NAT}/Bush.gltf`, [0.55, 0.7, 0.45]),
  'decor-vallee-fleurs-0.glb': `${NAT}/Flower_3_Clump.gltf`,
  'decor-vallee-herbe-0.glb': `${NAT}/Grass_Large.gltf`,
  'decor-marais-herbe-0.glb': one(`${NAT}/Grass_Small.gltf`, [0.75, 0.8, 0.5]),
  'decor-marais-roseaux-0.glb': one(`${NAT}/Grass_Large_Extruded.gltf`, [0.85, 0.75, 0.45], [1, 2, 1]),
  // (le reste garde l'art construit en code : les feuillages du pack nature sont des textures
  // transparentes, que la cuisson ne gère pas)
  'decor-vallee-sapin-0.glb': `${RTS}/Resource_PineTree.gltf`,
  'decor-vallee-rocher-0.glb': `${RTS}/Rock.gltf`,
  'decor-marais-arbremort-0.glb': `${NAT}/DeadTree_1.gltf`,
  'decor-marais-rocher-0.glb': `${RTS}/Resource_Rock_1.gltf`,
  'decor-cendre-arbrecalcine-0.glb': `${NAT}/DeadTree_5.gltf`,
};

/** Lit une source simple ou assemble une recette en un seul document. */
async function load(io: NodeIO, src: string | Recipe): Promise<Document> {
  const r: Recipe = typeof src === 'string' ? { parts: [src] } : src;
  let doc: Document | null = null;
  let y = 0;
  for (const rel of r.parts) {
    const part = await io.read(join(PACKS, rel));
    const b = getBounds(part.getRoot().listScenes()[0]);
    const holder = part.createNode('part').setTranslation([0, y, 0]);
    if (r.scale) holder.setScale(r.scale);
    const scene = part.getRoot().listScenes()[0];
    for (const c of scene.listChildren()) holder.addChild(c);
    scene.addChild(holder);
    y += b.max[1];
    if (!doc) { doc = part; continue; }
    mergeDocuments(doc, part);
    const [main, ...extra] = doc.getRoot().listScenes();
    for (const s of extra) { for (const c of s.listChildren()) main.addChild(c); s.dispose(); }
  }
  if (r.only) for (const n of doc!.getRoot().listNodes()) if (n.getMesh() && !r.only.test(n.getName())) n.setMesh(null);
  if (r.desat) {
    const k = r.desat;
    const gray = (d: Uint8Array | Buffer) => {
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
        for (let c = 0; c < 3; c++) d[i + c] = d[i + c] + (l - d[i + c]) * k;
      }
    };
    for (const t of doc!.getRoot().listTextures()) {
      const buf = Buffer.from(t.getImage()!);
      let out: PNG;
      if (t.getMimeType() === 'image/png') { out = PNG.sync.read(buf) as unknown as PNG; }
      else { const j = jpeg.decode(buf, { useTArray: true }); out = new PNG({ width: j.width, height: j.height }); out.data = Buffer.from(j.data); }
      gray(out.data);
      t.setImage(new Uint8Array(PNG.sync.write(out))).setMimeType('image/png');
    }
    for (const m of doc!.getRoot().listMaterials()) {
      const f = m.getBaseColorFactor(), l = 0.3 * f[0] + 0.59 * f[1] + 0.11 * f[2];
      m.setBaseColorFactor([f[0] + (l - f[0]) * k, f[1] + (l - f[1]) * k, f[2] + (l - f[2]) * k, f[3]]);
    }
  }
  if (r.tint) for (const m of doc!.getRoot().listMaterials()) {
    const f = m.getBaseColorFactor();
    m.setBaseColorFactor([f[0] * r.tint[0], f[1] * r.tint[1], f[2] * r.tint[2], f[3]]);
  }
  if (r.parts.length > 1) await doc!.transform(dedup(), unpartition());
  return doc!;
}

async function main() {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  mkdirSync(SRC, { recursive: true });
  // les GLB déjà présents à la racine de models-src ne sont pas touchés : pour retirer un modèle,
  // supprimer son fichier là-bas, son GLB cuit et son entrée dans public/models/manifest.json
  let done = 0, missing = 0, failed = 0;
  for (const [dst, src] of Object.entries(FREE_SOURCES)) {
    const parts = typeof src === 'string' ? [src] : src.parts;
    const rel = parts.map((p) => p.split('/').pop()).join(' + ');
    if (!parts.every((p) => existsSync(join(PACKS, p)))) { console.log(`absent   ${dst.padEnd(30)} ${rel}`); missing++; continue; }
    try {
      const doc = await load(io, src);
      await io.write(join(SRC, dst), doc);
      console.log(`importé  ${dst.padEnd(30)} ${rel}`);
      done++;
    } catch (err) {
      console.log(`ÉCHEC    ${dst.padEnd(30)} ${(err as Error).message}`);
      failed++;
    }
  }
  console.log(`\n${done} importé(s), ${missing} source(s) absente(s), ${failed} échec(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
