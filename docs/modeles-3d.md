# Modèles 3D à générer dans Higgsfield

Ce fichier est généré par `pnpm models:prompts` à partir de `tools/models/catalog.ts`. Ne le modifiez pas à la main.

## Procédure

1. Dans Higgsfield, ouvrez **3D → Meshy 7 Image to 3D** (ou **Meshy 6 Text to 3D** pour partir du texte).
   - Si vous passez par une image : générez-la d'abord (Soul ou Nano Banana) avec le prompt ci-dessous,
     **vue de face, fond uni gris, pas d'ombre portée, personnage entier**.
2. Réglages recommandés :
   - `model_type` : **lowpoly**, `target_polycount` : **6000** (le jeu re-décime ensuite au budget indiqué),
   - `should_texture` : **oui**, `enable_pbr` : **non**, `symmetry_mode` : auto,
   - personnages (colonne « rig ») : `pose_mode` : **a-pose**, `enable_rigging` : **oui**, `rigging_height_meters` : 1.7,
     `enable_animation` : non (les animations sont procédurales dans le jeu),
   - tours, décor, bâtiments : pas de rig.
3. Téléchargez le **GLB** et enregistrez-le sous le nom indiqué dans `assets/models-src/` (dossier ignoré par git).
4. `pnpm models:bake` puis `pnpm dev` : le modèle remplace l'art en code. Un modèle absent garde l'art en code.
5. Le modèle doit **regarder vers +Z** (vers le bas de l'écran à l'orientation 0). S'il marche à reculons ou de côté,
   ajoutez `yaw: 180` (ou 90 / -90) à son entrée du catalogue puis relancez la cuisson.

Un seul matériau et une seule texture par modèle (c'est ce que Meshy produit par défaut) : sinon la texture est cuite
dans les couleurs de sommets (moins fin).

Budget : 60 modèles. Priorité conseillée : héros → boss → ennemis fréquents (gobelin, loup, brute) → tours → décor.

## Héros (4)

### Samuel, chevalier

- Fichier : `assets/models-src/hero-samuel.glb` · clé `hero:samuel`
- Hauteur en jeu : 1.35 · budget : 2500 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > young human knight hero with steel plate armor, blue tabard, longsword and small round shield, determined face, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Lyra, archère

- Fichier : `assets/models-src/hero-lyra.glb` · clé `hero:lyra`
- Hauteur en jeu : 1.35 · budget : 2500 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > elf ranger heroine with green hooded cloak, leather armor, longbow and quiver, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Brom, ingénieur nain

- Fichier : `assets/models-src/hero-brom.glb` · clé `hero:brom`
- Hauteur en jeu : 1.35 · budget : 2500 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > dwarf engineer hero with red beard, goggles, leather apron, huge wrench and a backpack of gears, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Nox, mage sombre

- Fichier : `assets/models-src/hero-nox.glb` · clé `hero:nox`
- Hauteur en jeu : 1.35 · budget : 2500 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > mysterious dark mage hero in purple robes with a hood, glowing staff with a violet crystal, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera


## Boss (3)

### Kessin (phase 1)

- Fichier : `assets/models-src/enemy-kessin1.glb` · clé `enemy:kessin1`
- Hauteur en jeu : 2.4 · budget : 4000 triangles · texture 1024 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > demon lord Kessin, elegant tall demon in dark regal armor with a crown of horns and a scepter, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Kessin (phase 2)

- Fichier : `assets/models-src/enemy-kessin2.glb` · clé `enemy:kessin2`
- Hauteur en jeu : 2.8 · budget : 5000 triangles · texture 1024 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > demon lord Kessin enraged, armor cracked with fire, bat wings unfolding, flaming scepter, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Kessin (phase 3)

- Fichier : `assets/models-src/enemy-kessin3.glb` · clé `enemy:kessin3`
- Hauteur en jeu : 3.2 · budget : 6000 triangles · texture 1024 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > demon lord Kessin true form, colossal fire demon with huge wings and a lava core, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera


## Ennemis (21)

### Gobelin

- Fichier : `assets/models-src/enemy-gobelin.glb` · clé `enemy:gobelin`
- Hauteur en jeu : 1 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > small green goblin raider with a rusty dagger, ragged brown cloth, big pointy ears, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Loup

- Fichier : `assets/models-src/enemy-loup.glb` · clé `enemy:loup`
- Hauteur en jeu : 0.8 · budget : 1200 triangles · texture 512 px · animation : quadrupède
- Prompt :

  > grey feral wolf with dark fur, bared teeth, running pose, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Brute orque

- Fichier : `assets/models-src/enemy-brute.glb` · clé `enemy:brute`
- Hauteur en jeu : 1.5 · budget : 1600 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > big orc brute with iron pauldrons, huge club, green skin, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Chaman gobelin

- Fichier : `assets/models-src/enemy-chaman.glb` · clé `enemy:chaman`
- Hauteur en jeu : 1.1 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > goblin shaman with bone necklace, feathered staff, tribal mask, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Corbeau géant

- Fichier : `assets/models-src/enemy-corbeau.glb` · clé `enemy:corbeau`
- Hauteur en jeu : 0.7 · budget : 1200 triangles · texture 512 px · animation : ailes
- Prompt :

  > giant black crow with spread wings, red eyes, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Porte-bouclier

- Fichier : `assets/models-src/enemy-bouclier.glb` · clé `enemy:bouclier`
- Hauteur en jeu : 1.2 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > orc shield bearer with a huge wooden tower shield and iron helmet, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Noyé

- Fichier : `assets/models-src/enemy-noye.glb` · clé `enemy:noye`
- Hauteur en jeu : 1.1 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > drowned zombie covered in algae, pale blue skin, dripping water, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Sorcière des marais

- Fichier : `assets/models-src/enemy-sorciere.glb` · clé `enemy:sorciere`
- Hauteur en jeu : 1.2 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > swamp witch with a crooked hat, dark green robes, glowing hands, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Crapaud géant

- Fichier : `assets/models-src/enemy-crapaud.glb` · clé `enemy:crapaud`
- Hauteur en jeu : 0.8 · budget : 1200 triangles · texture 512 px · animation : quadrupède
- Prompt :

  > giant warty toad monster, mossy green, big yellow eyes, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Limon

- Fichier : `assets/models-src/enemy-limon.glb` · clé `enemy:limon`
- Hauteur en jeu : 0.8 · budget : 1200 triangles · texture 512 px · animation : masse (rebond)
- Prompt :

  > big acid green slime blob monster with a grinning face, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Petit limon

- Fichier : `assets/models-src/enemy-petitlimon.glb` · clé `enemy:petitlimon`
- Hauteur en jeu : 0.5 · budget : 500 triangles · texture 512 px · animation : masse (rebond)
- Prompt :

  > small acid green slime blob with a cute face, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Ver fouisseur

- Fichier : `assets/models-src/enemy-ver.glb` · clé `enemy:ver`
- Hauteur en jeu : 0.9 · budget : 1200 triangles · texture 512 px · animation : masse (rebond)
- Prompt :

  > segmented burrowing worm monster emerging from the ground, pink flesh, round toothy mouth, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Chauve-souris

- Fichier : `assets/models-src/enemy-chauvesouris.glb` · clé `enemy:chauvesouris`
- Hauteur en jeu : 0.5 · budget : 700 triangles · texture 512 px · animation : ailes
- Prompt :

  > purple cave bat with spread membrane wings, fangs, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Diablotin

- Fichier : `assets/models-src/enemy-diablotin.glb` · clé `enemy:diablotin`
- Hauteur en jeu : 0.9 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > small red imp demon with horns, tail and a pitchfork, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Démon cornu

- Fichier : `assets/models-src/enemy-cornu.glb` · clé `enemy:cornu`
- Hauteur en jeu : 1.5 · budget : 1600 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > tall horned demon warrior with cracked lava skin and a curved blade, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Golem de cendre

- Fichier : `assets/models-src/enemy-golem.glb` · clé `enemy:golem`
- Hauteur en jeu : 1.7 · budget : 1800 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > hulking ash and basalt golem with glowing orange cracks, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Invocateur

- Fichier : `assets/models-src/enemy-invocateur.glb` · clé `enemy:invocateur`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > cultist summoner in black and red robes holding a glowing skull, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Gargouille

- Fichier : `assets/models-src/enemy-gargouille.glb` · clé `enemy:gargouille`
- Hauteur en jeu : 1 · budget : 1200 triangles · texture 512 px · animation : ailes
- Prompt :

  > stone gargoyle with bat wings and horns, grey weathered stone, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Chevalier infernal

- Fichier : `assets/models-src/enemy-chevalierinf.glb` · clé `enemy:chevalierinf`
- Hauteur en jeu : 1.5 · budget : 1800 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > infernal black knight with fiery eyes, spiked armor and a great sword, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Grolbak

- Fichier : `assets/models-src/enemy-grolbak.glb` · clé `enemy:grolbak`
- Hauteur en jeu : 2 · budget : 2200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > giant troll champion with stone armor plates and a massive hammer, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Vasière

- Fichier : `assets/models-src/enemy-vasiere.glb` · clé `enemy:vasiere`
- Hauteur en jeu : 1.1 · budget : 1200 triangles · texture 512 px · animation : masse (rebond)
- Prompt :

  > mud elemental monster rising from a swamp, dripping mud, hollow glowing eyes, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera


## Soldats et unités (8)

### Milicien

- Fichier : `assets/models-src/soldier-0.glb` · clé `soldier:0`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > peasant militia soldier with padded jacket, wooden shield and spear, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Soldat

- Fichier : `assets/models-src/soldier-1.glb` · clé `soldier:1`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > human footman with chainmail, kettle helmet, sword and kite shield, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Chevalier

- Fichier : `assets/models-src/soldier-2.glb` · clé `soldier:2`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > armored knight with full plate, great helm, sword and tower shield, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Garde royal

- Fichier : `assets/models-src/soldier-3.glb` · clé `soldier:3`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > royal guard with golden ornate armor, red cape, halberd, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Rôdeur

- Fichier : `assets/models-src/soldier-4.glb` · clé `soldier:4`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > hooded ranger with leather armor and two short swords, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Renfort

- Fichier : `assets/models-src/soldier-5.glb` · clé `soldier:5`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > volunteer farmer militia with straw hat, pitchfork and wooden buckler, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Squelette

- Fichier : `assets/models-src/soldier-6.glb` · clé `soldier:6`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > skeleton warrior with rusty sword and broken shield, cracked bones, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera

### Tourelle de Brom

- Fichier : `assets/models-src/soldier-7.glb` · clé `soldier:7`
- Hauteur en jeu : 1.3 · budget : 1200 triangles · texture 512 px · animation : rig Meshy (jambes/bras depuis le squelette) → **rig Meshy, A-pose**
- Prompt :

  > small steampunk automated gun turret on three legs, brass and copper, spinning barrel, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, A-pose, facing the camera


## Tours (20)

### Archers I

- Fichier : `assets/models-src/tower-0-0.glb` · clé `tower:0-0`
- Hauteur en jeu : 2.6 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > small wooden watchtower with a thatched roof and an archer platform, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Archers II

- Fichier : `assets/models-src/tower-0-1.glb` · clé `tower:0-1`
- Hauteur en jeu : 3.2 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > wooden and stone archer tower with a wooden roof and banners, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Archers III

- Fichier : `assets/models-src/tower-0-2.glb` · clé `tower:0-2`
- Hauteur en jeu : 3.8 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > tall stone archer tower with battlements and a wooden roof, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Rangers (spé. A)

- Fichier : `assets/models-src/tower-0-3.glb` · clé `tower:0-3`
- Hauteur en jeu : 4.2 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > elven ranger tower made of living wood and leaves with a green crystal, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Arbalétriers (spé. B)

- Fichier : `assets/models-src/tower-0-4.glb` · clé `tower:0-4`
- Hauteur en jeu : 4.2 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > heavy crossbow fortress tower with iron reinforcements and a large ballista, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Caserne I

- Fichier : `assets/models-src/tower-1-0.glb` · clé `tower:1-0`
- Hauteur en jeu : 2.2 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > small wooden barracks with a training dummy and a flag, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Caserne II

- Fichier : `assets/models-src/tower-1-1.glb` · clé `tower:1-1`
- Hauteur en jeu : 2.6 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > stone barracks with a wooden roof, weapon racks and a flag, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Caserne III

- Fichier : `assets/models-src/tower-1-2.glb` · clé `tower:1-2`
- Hauteur en jeu : 3 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > fortified stone keep barracks with battlements and a big gate, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Chevaliers (spé. A)

- Fichier : `assets/models-src/tower-1-3.glb` · clé `tower:1-3`
- Hauteur en jeu : 3.4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > royal knight hall with golden roof, stained glass and banners, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Nécropole (spé. B)

- Fichier : `assets/models-src/tower-1-4.glb` · clé `tower:1-4`
- Hauteur en jeu : 3.4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > dark necromancer crypt with skulls, green glow and a gothic arch, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Mages I

- Fichier : `assets/models-src/tower-2-0.glb` · clé `tower:2-0`
- Hauteur en jeu : 2.8 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > small wizard tower with a blue conical roof and a crystal on top, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Mages II

- Fichier : `assets/models-src/tower-2-1.glb` · clé `tower:2-1`
- Hauteur en jeu : 3.4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > wizard tower with two floors, blue roof and floating runes, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Mages III

- Fichier : `assets/models-src/tower-2-2.glb` · clé `tower:2-2`
- Hauteur en jeu : 4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > tall arcane tower with a glowing blue orb and a spiral staircase, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Foudre (spé. A)

- Fichier : `assets/models-src/tower-2-3.glb` · clé `tower:2-3`
- Hauteur en jeu : 4.4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > storm mage tower with a lightning rod and electric blue coils, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Givre (spé. B)

- Fichier : `assets/models-src/tower-2-4.glb` · clé `tower:2-4`
- Hauteur en jeu : 4.4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > frost mage tower made of ice crystals with a cold white glow, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Artillerie I

- Fichier : `assets/models-src/tower-3-0.glb` · clé `tower:3-0`
- Hauteur en jeu : 2.4 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > small dwarven catapult emplacement on a stone base, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Artillerie II

- Fichier : `assets/models-src/tower-3-1.glb` · clé `tower:3-1`
- Hauteur en jeu : 2.8 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > dwarven bombard cannon on a reinforced stone base with sandbags, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Artillerie III

- Fichier : `assets/models-src/tower-3-2.glb` · clé `tower:3-2`
- Hauteur en jeu : 3.2 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > big dwarven mortar with brass fittings and a steam engine, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Tesla (spé. A)

- Fichier : `assets/models-src/tower-3-3.glb` · clé `tower:3-3`
- Hauteur en jeu : 3.8 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > steampunk tesla cannon with copper coils and glowing tubes, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset

### Brasier (spé. B)

- Fichier : `assets/models-src/tower-3-4.glb` · clé `tower:3-4`
- Hauteur en jeu : 3.8 · budget : 2500 triangles · texture 512 px · animation : statique
- Prompt :

  > dwarven flame mortar with a furnace, glowing lava core and chimney, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, medieval fantasy tower defense building on a round stone base, isometric game asset


## Décor (19)

### Chêne

- Fichier : `assets/models-src/decor-vallee-chene-0.glb` · clé `decor:vallee:chene:0`
- Hauteur en jeu : 3.2 · budget : 700 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > round leafy oak tree, bright green canopy, brown trunk, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Chêne (variante)

- Fichier : `assets/models-src/decor-vallee-chene-1.glb` · clé `decor:vallee:chene:1`
- Hauteur en jeu : 3 · budget : 700 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > leafy oak tree with two canopy clumps, yellow green leaves, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Sapin

- Fichier : `assets/models-src/decor-vallee-sapin-0.glb` · clé `decor:vallee:sapin:0`
- Hauteur en jeu : 3.4 · budget : 500 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > low-poly pine tree with three tiers of dark green needles, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Buisson

- Fichier : `assets/models-src/decor-vallee-buisson-0.glb` · clé `decor:vallee:buisson:0`
- Hauteur en jeu : 0.9 · budget : 300 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > small round green bush with red berries, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Rocher

- Fichier : `assets/models-src/decor-vallee-rocher-0.glb` · clé `decor:vallee:rocher:0`
- Hauteur en jeu : 0.8 · budget : 200 triangles · texture 256 px · animation : statique
- Prompt :

  > mossy grey boulder, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Fleurs

- Fichier : `assets/models-src/decor-vallee-fleurs-0.glb` · clé `decor:vallee:fleurs:0`
- Hauteur en jeu : 0.4 · budget : 200 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > small patch of wild flowers, yellow and white, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Touffe d’herbe

- Fichier : `assets/models-src/decor-vallee-herbe-0.glb` · clé `decor:vallee:herbe:0`
- Hauteur en jeu : 0.45 · budget : 120 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > tuft of tall green grass, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Saule

- Fichier : `assets/models-src/decor-marais-saule-0.glb` · clé `decor:marais:saule:0`
- Hauteur en jeu : 3.6 · budget : 800 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > weeping willow tree with hanging dark green branches, twisted trunk, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Arbre mort

- Fichier : `assets/models-src/decor-marais-arbremort-0.glb` · clé `decor:marais:arbremort:0`
- Hauteur en jeu : 3 · budget : 500 triangles · texture 256 px · animation : statique
- Prompt :

  > dead twisted tree without leaves, dark grey bark, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Roseaux

- Fichier : `assets/models-src/decor-marais-roseaux-0.glb` · clé `decor:marais:roseaux:0`
- Hauteur en jeu : 1.2 · budget : 200 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > clump of swamp reeds with cattails, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Champignon

- Fichier : `assets/models-src/decor-marais-champignon-0.glb` · clé `decor:marais:champignon:0`
- Hauteur en jeu : 0.8 · budget : 300 triangles · texture 256 px · animation : statique
- Prompt :

  > cluster of glowing violet swamp mushrooms, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Rocher moussu

- Fichier : `assets/models-src/decor-marais-rocher-0.glb` · clé `decor:marais:rocher:0`
- Hauteur en jeu : 0.8 · budget : 200 triangles · texture 256 px · animation : statique
- Prompt :

  > slimy dark boulder covered in moss, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Herbe de marais

- Fichier : `assets/models-src/decor-marais-herbe-0.glb` · clé `decor:marais:herbe:0`
- Hauteur en jeu : 0.45 · budget : 120 triangles · texture 256 px · animation : balancement (végétation)
- Prompt :

  > tuft of yellow green marsh grass, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Colonne de basalte

- Fichier : `assets/models-src/decor-cendre-basalte-0.glb` · clé `decor:cendre:basalte:0`
- Hauteur en jeu : 2.6 · budget : 400 triangles · texture 256 px · animation : statique
- Prompt :

  > cluster of black hexagonal basalt columns, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Arbre calciné

- Fichier : `assets/models-src/decor-cendre-arbrecalcine-0.glb` · clé `decor:cendre:arbrecalcine:0`
- Hauteur en jeu : 2.8 · budget : 500 triangles · texture 256 px · animation : statique
- Prompt :

  > burnt charred dead tree with glowing embers, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Cristal de feu

- Fichier : `assets/models-src/decor-cendre-cristal-0.glb` · clé `decor:cendre:cristal:0`
- Hauteur en jeu : 1.6 · budget : 300 triangles · texture 256 px · animation : statique
- Prompt :

  > cluster of glowing orange fire crystals, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Rocher volcanique

- Fichier : `assets/models-src/decor-cendre-rocher-0.glb` · clé `decor:cendre:rocher:0`
- Hauteur en jeu : 0.8 · budget : 200 triangles · texture 256 px · animation : statique
- Prompt :

  > dark volcanic rock with orange cracks, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Crâne

- Fichier : `assets/models-src/decor-cendre-crane-0.glb` · clé `decor:cendre:crane:0`
- Hauteur en jeu : 0.5 · budget : 200 triangles · texture 256 px · animation : statique
- Prompt :

  > bleached animal skull with horns on ash ground, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body

### Pic de roche

- Fichier : `assets/models-src/decor-cendre-pic-0.glb` · clé `decor:cendre:pic:0`
- Hauteur en jeu : 2.2 · budget : 200 triangles · texture 256 px · animation : statique
- Prompt :

  > tall sharp obsidian rock spike, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body


## Bâtiments (porte, entrées) (6)

### Porte (Vallée)

- Fichier : `assets/models-src/gate-vallee.glb` · clé `gate:vallee`
- Hauteur en jeu : 6.5 · budget : 5000 triangles · texture 1024 px · animation : statique
- Prompt :

  > fortified medieval castle gatehouse with two round towers, blue conical roofs, a big wooden gate and a banner, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, isometric game asset

### Porte (Marais)

- Fichier : `assets/models-src/gate-marais.glb` · clé `gate:marais`
- Hauteur en jeu : 6.5 · budget : 5000 triangles · texture 1024 px · animation : statique
- Prompt :

  > mossy stone gatehouse with two towers, green wooden roofs, lanterns, a big wooden gate, swamp fortress, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, isometric game asset

### Porte (Cendres)

- Fichier : `assets/models-src/gate-cendre.glb` · clé `gate:cendre`
- Hauteur en jeu : 6.5 · budget : 5000 triangles · texture 1024 px · animation : statique
- Prompt :

  > dark basalt fortress gatehouse with two towers, dark red roofs, iron gate with spikes, braziers, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, isometric game asset

### Entrée (Vallée)

- Fichier : `assets/models-src/spawn-vallee.glb` · clé `spawn:vallee`
- Hauteur en jeu : 2.6 · budget : 1500 triangles · texture 512 px · animation : statique
- Prompt :

  > rocky cave entrance with two torches and broken wooden palisade, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, isometric game asset

### Entrée (Marais)

- Fichier : `assets/models-src/spawn-marais.glb` · clé `spawn:marais`
- Hauteur en jeu : 2.6 · budget : 1500 triangles · texture 512 px · animation : statique
- Prompt :

  > ruined mossy stone archway with two torches, swamp, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, isometric game asset

### Entrée (Cendres)

- Fichier : `assets/models-src/spawn-cendre.glb` · clé `spawn:cendre`
- Hauteur en jeu : 2.6 · budget : 1500 triangles · texture 512 px · animation : statique
- Prompt :

  > demonic portal made of black rock with glowing lava cracks and two braziers, stylized low-poly game asset, hand-painted look, bold readable silhouette, slightly cartoon proportions, clean flat colors, no background, full body, isometric game asset

