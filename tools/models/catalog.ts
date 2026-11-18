/**
 * Catalogue des modèles 3D à générer dans Higgsfield (Meshy 7) puis à cuire.
 * - `key`     : clé utilisée par le client (voir packages/client/src/art/models.ts)
 * - `src`     : nom du fichier attendu dans assets/models-src/ (export GLB de Higgsfield)
 * - `height`  : hauteur normalisée en unités monde (pieds à y = 0, centré en x/z)
 * - `tris`    : budget de triangles après décimation
 * - `anim`    : mode d'animation : rig (squelette Meshy), biped, quad, flyer, blob, sway, static
 * - `prompt`  : prompt (anglais, ce que Meshy comprend le mieux)
 */
export type AnimMode = 'rig' | 'biped' | 'quad' | 'flyer' | 'blob' | 'sway' | 'static';

export interface CatalogEntry {
  key: string;
  src: string;
  group: 'heros' | 'boss' | 'ennemis' | 'soldats' | 'tours' | 'decor' | 'batiments';
  label: string;
  height: number;
  /** largeur maximale (le modèle est réduit si besoin) */
  maxWidth?: number;
  tris: number;
  tex: 256 | 512 | 1024;
  anim: AnimMode;
  /** rotation (degrés) à appliquer si le modèle généré ne regarde pas vers +Z */
  yaw?: number;
  muzzleY?: number;
  prompt: string;
}

const STYLE = 'stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body';
const CHAR = `${STYLE}, A-pose, facing the camera`;

const E = (key: string, label: string, anim: AnimMode, height: number, prompt: string, tris = 1200): CatalogEntry => ({
  key: `enemy:${key}`, src: `enemy-${key}.glb`, group: 'ennemis', label, height, tris, tex: 512, anim, prompt: `${prompt}, ${CHAR}`,
});
const H = (key: string, label: string, prompt: string): CatalogEntry => ({
  key: `hero:${key}`, src: `hero-${key}.glb`, group: 'heros', label, height: 1.35, tris: 2500, tex: 512, anim: 'rig', prompt: `${prompt}, ${CHAR}`,
});
const S = (k: number, label: string, prompt: string, tris = 1200): CatalogEntry => ({
  key: `soldier:${k}`, src: `soldier-${k}.glb`, group: 'soldats', label, height: 1.3, tris, tex: 512, anim: 'rig', prompt: `${prompt}, ${CHAR}`,
});
const T = (fam: number, level: number, label: string, height: number, prompt: string): CatalogEntry => ({
  key: `tower:${fam}-${level}`, src: `tower-${fam}-${level}.glb`, group: 'tours', label, height, maxWidth: 2.4, tris: 2500, tex: 512, anim: 'static',
  muzzleY: height - 0.5, prompt: `${prompt}, ${STYLE}, medieval fantasy tower defense building on a round stone base, isometric game asset`,
});
const D = (biome: string, name: string, v: number, label: string, height: number, anim: AnimMode, prompt: string, tris = 400, tex: 256 | 512 = 256): CatalogEntry => ({
  key: `decor:${biome}:${name}:${v}`, src: `decor-${biome}-${name}-${v}.glb`, group: 'decor', label, height, tris, tex, anim, prompt: `${prompt}, ${STYLE}`,
});

export const CATALOG: CatalogEntry[] = [
  // ------------------------------------------------------------ héros
  H('samuel', 'Samuel, chevalier', 'young human knight hero with steel plate armor, blue tabard, longsword and small round shield, determined face'),
  H('lyra', 'Lyra, archère', 'elf ranger heroine with green hooded cloak, leather armor, longbow and quiver'),
  H('brom', 'Brom, ingénieur nain', 'dwarf engineer hero with red beard, goggles, leather apron, huge wrench and a backpack of gears'),
  H('nox', 'Nox, mage sombre', 'mysterious dark mage hero in purple robes with a hood, glowing staff with a violet crystal'),
  // ------------------------------------------------------------ soldats
  S(0, 'Milicien', 'peasant militia soldier with padded jacket, wooden shield and spear'),
  S(1, 'Soldat', 'human footman with chainmail, kettle helmet, sword and kite shield'),
  S(2, 'Chevalier', 'armored knight with full plate, great helm, sword and tower shield'),
  S(3, 'Garde royal', 'royal guard with golden ornate armor, red cape, halberd'),
  S(4, 'Rôdeur', 'hooded ranger with leather armor and two short swords'),
  S(5, 'Renfort', 'volunteer farmer militia with straw hat, pitchfork and wooden buckler'),
  // os fins (bras, jambes, cornes du casque) : une décimation trop forte les efface
  S(6, 'Squelette', 'skeleton warrior with rusty sword and broken shield, cracked bones', 3200),
  S(7, 'Tourelle de Brom', 'small steampunk automated gun turret on three legs, brass and copper, spinning barrel'),
  // ------------------------------------------------------------ ennemis
  E('gobelin', 'Gobelin', 'rig', 1.0, 'small green goblin raider with a rusty dagger, ragged brown cloth, big pointy ears'),
  E('loup', 'Loup', 'quad', 0.8, 'grey feral wolf with dark fur, bared teeth, running pose'),
  E('brute', 'Brute orque', 'rig', 1.5, 'big orc brute with iron pauldrons, huge club, green skin', 1600),
  E('chaman', 'Chaman gobelin', 'rig', 1.1, 'goblin shaman with bone necklace, feathered staff, tribal mask'),
  E('corbeau', 'Corbeau géant', 'flyer', 0.7, 'giant black crow with spread wings, red eyes'),
  E('bouclier', 'Porte-bouclier', 'rig', 1.2, 'orc shield bearer with a huge wooden tower shield and iron helmet'),
  E('noye', 'Noyé', 'rig', 1.1, 'drowned zombie covered in algae, pale blue skin, dripping water'),
  E('sorciere', 'Sorcière des marais', 'rig', 1.2, 'swamp witch with a crooked hat, dark green robes, glowing hands'),
  E('crapaud', 'Crapaud géant', 'quad', 0.8, 'giant warty toad monster, mossy green, big yellow eyes'),
  E('limon', 'Limon', 'blob', 0.8, 'big acid green slime blob monster with a grinning face'),
  E('petitlimon', 'Petit limon', 'blob', 0.5, 'small acid green slime blob with a cute face', 500),
  E('ver', 'Ver fouisseur', 'blob', 0.9, 'segmented burrowing worm monster emerging from the ground, pink flesh, round toothy mouth'),
  E('chauvesouris', 'Chauve-souris', 'flyer', 0.5, 'purple cave bat with spread membrane wings, fangs', 700),
  E('diablotin', 'Diablotin', 'rig', 0.9, 'small red imp demon with horns, tail and a pitchfork'),
  E('cornu', 'Démon cornu', 'rig', 1.5, 'tall horned demon warrior with cracked lava skin and a curved blade', 1600),
  E('golem', 'Golem de cendre', 'rig', 1.7, 'hulking ash and basalt golem with glowing orange cracks', 1800),
  E('invocateur', 'Invocateur', 'rig', 1.3, 'cultist summoner in black and red robes holding a glowing skull'),
  E('gargouille', 'Gargouille', 'flyer', 1.0, 'stone gargoyle with bat wings and horns, grey weathered stone'),
  E('chevalierinf', 'Chevalier infernal', 'rig', 1.5, 'infernal black knight with fiery eyes, spiked armor and a great sword', 1800),
  E('grolbak', 'Grolbak', 'rig', 2.0, 'giant troll champion with stone armor plates and a massive hammer', 2200),
  E('vasiere', 'Vasière', 'blob', 1.1, 'mud elemental monster rising from a swamp, dripping mud, hollow glowing eyes', 1200),
  { ...E('kessin1', 'Kessin (phase 1)', 'rig', 2.4, 'demon lord Kessin, elegant tall demon in dark regal armor with a crown of horns and a scepter', 4000), group: 'boss', tex: 1024 },
  { ...E('kessin2', 'Kessin (phase 2)', 'rig', 2.8, 'demon lord Kessin enraged, armor cracked with fire, bat wings unfolding, flaming scepter', 5000), group: 'boss', tex: 1024 },
  { ...E('kessin3', 'Kessin (phase 3)', 'rig', 3.2, 'demon lord Kessin true form, colossal fire demon with huge wings and a lava core', 6000), group: 'boss', tex: 1024 },
  // ------------------------------------------------------------ tours (4 familles × 3 niveaux + 2 spécialisations)
  T(0, 0, 'Archers I', 2.6, 'small wooden watchtower with a thatched roof and an archer platform'),
  T(0, 1, 'Archers II', 3.2, 'wooden and stone archer tower with a wooden roof and banners'),
  T(0, 2, 'Archers III', 3.8, 'tall stone archer tower with battlements and a wooden roof'),
  T(0, 3, 'Rangers (spé. A)', 4.2, 'elven ranger tower made of living wood and leaves with a green crystal'),
  T(0, 4, 'Arbalétriers (spé. B)', 4.2, 'heavy crossbow fortress tower with iron reinforcements and a large ballista'),
  T(1, 0, 'Caserne I', 2.2, 'small wooden barracks with a training dummy and a flag'),
  T(1, 1, 'Caserne II', 2.6, 'stone barracks with a wooden roof, weapon racks and a flag'),
  T(1, 2, 'Caserne III', 3.0, 'fortified stone keep barracks with battlements and a big gate'),
  T(1, 3, 'Chevaliers (spé. A)', 3.4, 'royal knight hall with golden roof, stained glass and banners'),
  T(1, 4, 'Nécropole (spé. B)', 3.4, 'dark necromancer crypt with skulls, green glow and a gothic arch'),
  T(2, 0, 'Mages I', 2.8, 'small wizard tower with a blue conical roof and a crystal on top'),
  T(2, 1, 'Mages II', 3.4, 'wizard tower with two floors, blue roof and floating runes'),
  T(2, 2, 'Mages III', 4.0, 'tall arcane tower with a glowing blue orb and a spiral staircase'),
  T(2, 3, 'Foudre (spé. A)', 4.4, 'storm mage tower with a lightning rod and electric blue coils'),
  T(2, 4, 'Givre (spé. B)', 4.4, 'frost mage tower made of ice crystals with a cold white glow'),
  T(3, 0, 'Artillerie I', 2.4, 'small dwarven catapult emplacement on a stone base'),
  T(3, 1, 'Artillerie II', 2.8, 'dwarven bombard cannon on a reinforced stone base with sandbags'),
  T(3, 2, 'Artillerie III', 3.2, 'big dwarven mortar with brass fittings and a steam engine'),
  T(3, 3, 'Tesla (spé. A)', 3.8, 'steampunk tesla cannon with copper coils and glowing tubes'),
  T(3, 4, 'Brasier (spé. B)', 3.8, 'dwarven flame mortar with a furnace, glowing lava core and chimney'),
  // ------------------------------------------------------------ décor : Vallée d'Aubeclair
  D('vallee', 'chene', 0, 'Chêne', 3.2, 'sway', 'round leafy oak tree, bright green canopy, brown trunk', 700),
  D('vallee', 'chene', 1, 'Chêne (variante)', 3.0, 'sway', 'leafy oak tree with two canopy clumps, yellow green leaves', 700),
  D('vallee', 'sapin', 0, 'Sapin', 3.4, 'sway', 'low-poly pine tree with three tiers of dark green needles', 500),
  D('vallee', 'buisson', 0, 'Buisson', 0.9, 'sway', 'small round green bush with red berries', 300),
  D('vallee', 'rocher', 0, 'Rocher', 0.8, 'static', 'mossy grey boulder', 200),
  D('vallee', 'fleurs', 0, 'Fleurs', 0.4, 'sway', 'small patch of wild flowers, yellow and white', 200),
  D('vallee', 'herbe', 0, 'Touffe d’herbe', 0.45, 'sway', 'tuft of tall green grass', 120),
  // ------------------------------------------------------------ décor : Marais de Brumenoire
  D('marais', 'saule', 0, 'Saule', 3.6, 'sway', 'weeping willow tree with hanging dark green branches, twisted trunk', 800),
  D('marais', 'arbremort', 0, 'Arbre mort', 3.0, 'static', 'dead twisted tree without leaves, dark grey bark', 500),
  D('marais', 'roseaux', 0, 'Roseaux', 1.2, 'sway', 'clump of swamp reeds with cattails', 200),
  D('marais', 'champignon', 0, 'Champignon', 0.8, 'static', 'cluster of glowing violet swamp mushrooms', 300),
  D('marais', 'rocher', 0, 'Rocher moussu', 0.8, 'static', 'slimy dark boulder covered in moss', 200),
  D('marais', 'herbe', 0, 'Herbe de marais', 0.45, 'sway', 'tuft of yellow green marsh grass', 120),
  // ------------------------------------------------------------ décor : Terres de Cendre
  D('cendre', 'basalte', 0, 'Colonne de basalte', 2.6, 'static', 'cluster of black hexagonal basalt columns', 400),
  D('cendre', 'arbrecalcine', 0, 'Arbre calciné', 2.8, 'static', 'burnt charred dead tree with glowing embers', 500),
  D('cendre', 'cristal', 0, 'Cristal de feu', 1.6, 'static', 'cluster of glowing orange fire crystals', 300),
  D('cendre', 'rocher', 0, 'Rocher volcanique', 0.8, 'static', 'dark volcanic rock with orange cracks', 200),
  D('cendre', 'crane', 0, 'Crâne', 0.5, 'static', 'bleached animal skull with horns on ash ground', 200),
  D('cendre', 'pic', 0, 'Pic de roche', 2.2, 'static', 'tall sharp obsidian rock spike', 200),
  // ------------------------------------------------------------ bâtiments
  { key: 'gate:vallee', src: 'gate-vallee.glb', group: 'batiments', label: 'Porte (Vallée)', height: 6.5, maxWidth: 13, tris: 5000, tex: 1024, anim: 'static',
    prompt: `fortified medieval castle gatehouse with two round towers, blue conical roofs, a big wooden gate and a banner, ${STYLE}, isometric game asset` },
  { key: 'gate:marais', src: 'gate-marais.glb', group: 'batiments', label: 'Porte (Marais)', height: 6.5, maxWidth: 13, tris: 5000, tex: 1024, anim: 'static',
    prompt: `mossy stone gatehouse with two towers, green wooden roofs, lanterns, a big wooden gate, swamp fortress, ${STYLE}, isometric game asset` },
  { key: 'gate:cendre', src: 'gate-cendre.glb', group: 'batiments', label: 'Porte (Cendres)', height: 6.5, maxWidth: 13, tris: 5000, tex: 1024, anim: 'static',
    prompt: `dark basalt fortress gatehouse with two towers, dark red roofs, iron gate with spikes, braziers, ${STYLE}, isometric game asset` },
  { key: 'spawn:vallee', src: 'spawn-vallee.glb', group: 'batiments', label: 'Entrée (Vallée)', height: 2.6, maxWidth: 6, tris: 1500, tex: 512, anim: 'static',
    prompt: `rocky cave entrance with two torches and broken wooden palisade, ${STYLE}, isometric game asset` },
  { key: 'spawn:marais', src: 'spawn-marais.glb', group: 'batiments', label: 'Entrée (Marais)', height: 2.6, maxWidth: 6, tris: 1500, tex: 512, anim: 'static',
    prompt: `ruined mossy stone archway with two torches, swamp, ${STYLE}, isometric game asset` },
  { key: 'spawn:cendre', src: 'spawn-cendre.glb', group: 'batiments', label: 'Entrée (Cendres)', height: 2.6, maxWidth: 6, tris: 1500, tex: 512, anim: 'static',
    prompt: `demonic portal made of black rock with glowing lava cracks and two braziers, ${STYLE}, isometric game asset` },
];
