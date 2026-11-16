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
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

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
 * fichier attendu par le catalogue -> chemin de la source dans _packs/
 *
 * Écartés après contrôle visuel (ils gardent l'art construit en code) : Kessin (démons trop génériques pour
 * le boss), corbeau, noyé, golem, vasière, tours de mages (temples en bois), artillerie (armes Kenney sans
 * socle), chênes, cristal et rocher des Cendres (mauvaises teintes), portes (simples palissades).
 */
export const FREE_SOURCES: Record<string, string> = {
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
  // décor (le reste garde l'art construit en code : les feuillages du pack nature sont des textures
  // transparentes, que la cuisson ne gère pas)
  'decor-vallee-sapin-0.glb': `${RTS}/Resource_PineTree.gltf`,
  'decor-vallee-rocher-0.glb': `${RTS}/Rock.gltf`,
  'decor-marais-arbremort-0.glb': `${NAT}/DeadTree_1.gltf`,
  'decor-marais-rocher-0.glb': `${RTS}/Resource_Rock_1.gltf`,
  'decor-cendre-arbrecalcine-0.glb': `${NAT}/DeadTree_5.gltf`,
};

async function main() {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  mkdirSync(SRC, { recursive: true });
  // les GLB déjà présents à la racine de models-src ne sont pas touchés : pour retirer un modèle,
  // supprimer son fichier là-bas, son GLB cuit et son entrée dans public/models/manifest.json
  let done = 0, missing = 0, failed = 0;
  for (const [dst, rel] of Object.entries(FREE_SOURCES)) {
    const from = join(PACKS, rel);
    if (!existsSync(from)) { console.log(`absent   ${dst.padEnd(30)} ${rel}`); missing++; continue; }
    try {
      const doc = await io.read(from);
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
