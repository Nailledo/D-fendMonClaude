# Modèles 3D : sources gratuites (sans Meshy ni Higgsfield)

Correspondance entre les 81 entrées de `tools/models/catalog.ts` et des modèles gratuits sous licence CC0
(domaine public : usage libre, y compris commercial, sans attribution).

> **État réel** : la table qui fait foi est `FREE_SOURCES` dans `tools/models/import-free.ts`.
> Les 81 modèles sont importés. Les tableaux ci-dessous sont le plan initial, établi avant téléchargement.
>
> - Modèles directs : héros, soldats, tours d'archers, casernes, la plupart des ennemis, sapin, rochers, arbres morts.
> - Tours de mages, d'artillerie et Nécropole : assemblées à partir des pièces du Tower Defense Kit de Kenney
>   (étages empilés + arme ou cristaux), avec une teinte par famille.
> - Approximations par teinte d'un modèle voisin : Brom (Barbarian élargi), Chevalier et Garde royal (Knight),
>   chevalier infernal, noyé et sorcière (squelettes KayKit), corbeau, golem (Yeti), Kessin ×3 (démons et dragon),
>   portes, entrées (mine), décor des Cendres.
> - Buisson et fleurs : textures à transparence découpée (PNG, `cutout` dans le manifeste, seuil alpha 0,5 côté jeu).
> - Remplaçants, faute d'équivalent gratuit : loup (chien désaturé), ver (Squidle), vasière (blob désaturé brun),
>   champignon (créature Mushnub), saule (arbre feuillu élargi), crâne (tête du squelette KayKit).
>
> Contrôle visuel : ouvrir `http://localhost:5173/preview-models.html?g=enemy` pendant `pnpm dev`
> (groupes : hero, soldier, enemy, tower, decor, gate, spawn).
>
> Pour refaire l'import : extraire les packs dans `assets/models-src/_packs/`, puis
> `pnpm tsx tools/models/import-free.ts` et `pnpm models:bake`.

## Ce qui a été vérifié

- **Pipeline** : `tools/models/bake.ts` ne dépend pas de Meshy. Il reconnaît les os par leur nom
  (`left`/`right`/`.l`/`.r` + `arm`, `leg`, `hand`, `foot`, `wing`…), donc les squelettes KayKit, Quaternius
  et Mixamo conviennent. Un modèle sans squelette est animé par les modes `biped`, `quad`, `flyer`, `blob`.
  Il accepte une texture PNG/JPEG ou de simples couleurs de matériau.
- **Licences** (lues sur les pages officielles) : KayKit, Kenney et Quaternius sont en CC0 et gratuits.
  Les versions « EXTRA » de KayKit sont payantes : on ne les utilise pas.
- **Existence des modèles** : vérifiée par recherche sur poly.pizza (titre et auteur). Les modèles n'ont pas
  été ouverts ni téléchargés : l'adéquation visuelle reste à juger.

## À télécharger (tout est gratuit)

| Pack | Page officielle | Format |
|---|---|---|
| KayKit Adventurers (version FREE, 12 Mo) | https://kaylousberg.itch.io/kaykit-adventurers | glTF |
| KayKit Skeletons (version FREE, 7,7 Mo) | https://kaylousberg.itch.io/kaykit-skeletons | glTF |
| Quaternius Ultimate Monsters | https://quaternius.com/packs/ultimatemonsters.html | glTF |
| Quaternius Ultimate Fantasy RTS | https://quaternius.com/packs/ultimatefantasyrts.html | glTF |
| Quaternius Ultimate Stylized Nature | https://quaternius.com/packs/ultimatestylizednature.html | glTF |
| Kenney Tower Defense Kit | https://kenney.nl/assets/tower-defense-kit | à vérifier |

Sur itch.io, choisir « No thanks, just take me to the downloads » : aucun paiement n'est requis.
poly.pizza permet aussi de télécharger chaque modèle à l'unité, mais ses conditions interdisent le
téléchargement automatisé : à faire à la main.

Chaque fichier se renomme selon la colonne « Fichier » et se dépose dans `assets/models-src/`,
puis `pnpm models:bake`.

## Correspondance

Fiabilité : **bon** = modèle du bon type trouvé ; **approx.** = modèle proche à retoucher ou à accepter tel quel ;
**manque** = rien de gratuit en CC0 trouvé (garder l'art procédural, ou générer par IA gratuite).

### Héros (4)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| hero-samuel.glb | KayKit Adventurers — Knight | bon |
| hero-lyra.glb | KayKit Adventurers — Ranger (arc ; pas d'oreilles d'elfe) | bon |
| hero-brom.glb | aucun nain gratuit (l'Engineer de KayKit est payant) | manque |
| hero-nox.glb | KayKit Adventurers — Mage (teinte à assombrir) | approx. |
| hero-ethan.glb | composé (`pnpm models:kitbash`) depuis hero-lyra : robe rose, cheveux blonds, diadème | bon |
| hero-roi.glb | composé (`pnpm models:kitbash`) depuis soldier-0 : tenue royale, barbe, couronne, cape d'hermine | bon |

### Boss (3)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| enemy-kessin1.glb | Quaternius — Demon | approx. |
| enemy-kessin2.glb | Quaternius — Demon (autre variante) | approx. |
| enemy-kessin3.glb | Quaternius — Dragon Evolved | approx. |

### Ennemis (21)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| enemy-gobelin.glb | Quaternius — Goblin (https://poly.pizza/m/OdCOFSmEhl) | bon |
| enemy-loup.glb | Quaternius — Wolf | bon |
| enemy-brute.glb | Quaternius — Orc | bon |
| enemy-chaman.glb | Quaternius — Goblin, variante recolorée | approx. |
| enemy-corbeau.glb | seuls des modèles CC-BY (attribution obligatoire) | manque |
| enemy-bouclier.glb | Quaternius — Orc Enemy | approx. |
| enemy-noye.glb | Quaternius — Zombie | bon |
| enemy-sorciere.glb | Quaternius — Witch | bon |
| enemy-crapaud.glb | Quaternius — Frog | bon |
| enemy-limon.glb | Quaternius — Slime | bon |
| enemy-petitlimon.glb | Quaternius — Green Blob | bon |
| enemy-ver.glb | Quaternius — Worm | bon |
| enemy-chauvesouris.glb | Quaternius — Bat | bon |
| enemy-diablotin.glb | Quaternius — Demon (petite variante) | approx. |
| enemy-cornu.glb | Quaternius — Demon | bon |
| enemy-golem.glb | Quaternius — Goleling Evolved | approx. |
| enemy-invocateur.glb | Quaternius — Wizard (recoloré) | approx. |
| enemy-gargouille.glb | rien trouvé | manque |
| enemy-chevalierinf.glb | KayKit Knight assombri | approx. |
| enemy-grolbak.glb | aucun troll en CC0 | manque |
| enemy-vasiere.glb | Quaternius — Slime Enemy (teinte boue) | approx. |

### Soldats et unités (8)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| soldier-0.glb (Milicien) | KayKit — Rogue | approx. |
| soldier-1.glb (Soldat) | KayKit — Knight | bon |
| soldier-2.glb (Chevalier) | Quaternius Animated Knight Pack — Knight | bon |
| soldier-3.glb (Garde royal) | Quaternius — King | approx. |
| soldier-4.glb (Rôdeur) | KayKit — Rogue Hooded | bon |
| soldier-5.glb (Renfort) | KayKit — Barbarian | approx. |
| soldier-6.glb (Squelette) | KayKit Skeletons — Warrior, hache et petit bouclier du pack (dossier `assets/gltf`) accrochés aux mains | bon |
| soldier-7.glb (Tourelle de Brom) | Kenney — Turret (https://poly.pizza/m/mXKbcMPLSS) ou Quaternius — Turret Gun | bon |

### Tours (20)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| tower-0-0 à 0-2 (Archers I–III) | Quaternius — Watch Tower (3 variantes), Archery Towers | bon |
| tower-0-3 (Rangers) | Quaternius — Archery Building | approx. |
| tower-0-4 (Arbalétriers) | Quaternius — Archery Towers (autre variante) | approx. |
| tower-1-0 à 1-2 (Caserne I–III) | Quaternius — Barracks, Fantasy Barracks, Barracks (3 variantes) | bon |
| tower-1-3 (Chevaliers) | rien de spécifique | manque |
| tower-1-4 (Nécropole) | à chercher dans Kenney Graveyard Kit | manque |
| tower-2-0 à 2-2 (Mages I–III) | Quaternius — Tower, Stone Tower (la vraie « Wizard Tower » est CC-BY) | approx. |
| tower-2-3 (Foudre), tower-2-4 (Givre) | rien trouvé | manque |
| tower-3-0 (Artillerie I) | catapulte : CC-BY uniquement | manque |
| tower-3-1, 3-2 (Artillerie II–III) | Quaternius — Cannon (2 variantes), Kenney — Cannon | bon |
| tower-3-3 (Tesla), tower-3-4 (Brasier) | rien trouvé | manque |

Le pack Ultimate Fantasy RTS annonce des bâtiments « à plusieurs stades d'évolution » : il comblera
peut-être une partie des manques, à vérifier une fois téléchargé. Idem pour le Tower Defense Kit de Kenney.

### Décor (19)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| decor-vallee-chene-0, -1 | Quaternius — Tree, Trees (arbres feuillus génériques) | approx. |
| decor-vallee-sapin-0 | Quaternius — Pine | bon |
| decor-vallee-buisson-0 | Quaternius — Bush | bon |
| decor-vallee-rocher-0 | Quaternius — Rock | bon |
| decor-vallee-fleurs-0 | Quaternius — Flowers | bon |
| decor-vallee-herbe-0 | Quaternius — Grass | bon |
| decor-marais-saule-0 | Quaternius — Willow | bon |
| decor-marais-arbremort-0 | Quaternius — Dead Tree | bon |
| decor-marais-roseaux-0 | Quaternius — Tall Grass | approx. |
| decor-marais-champignon-0 | Quaternius — Mushroom | bon |
| decor-marais-rocher-0 | Quaternius — Rock Large | bon |
| decor-marais-herbe-0 | Quaternius — Grass (autre variante) | bon |
| decor-cendre-basalte-0 | Quaternius — Rock Medium | approx. |
| decor-cendre-arbrecalcine-0 | Quaternius — Dead Trees (assombri) | approx. |
| decor-cendre-cristal-0 | Quaternius — Big Crystal | bon |
| decor-cendre-rocher-0 | Quaternius — Rock (teinte sombre) | approx. |
| decor-cendre-crane-0 | Kay Lousberg — Skull (https://poly.pizza/m/7clFQGz5jH) | bon |
| decor-cendre-pic-0 | rocher allongé, à défaut de pic | approx. |

### Bâtiments (6)

| Fichier | Modèle proposé | Fiabilité |
|---|---|---|
| gate-vallee.glb | Quaternius — Castle Gate | bon |
| gate-marais.glb | Quaternius — Wooden Fortress Gate | approx. |
| gate-cendre.glb | Quaternius — Wall Towers Door | approx. |
| spawn-vallee.glb | grotte : CC-BY uniquement | manque |
| spawn-marais.glb | Quaternius — Arch | bon |
| spawn-cendre.glb | portail : rien en CC0 | manque |

## Bilan

- **bon** : 40 modèles
- **approx.** : 28 modèles
- **manque** : 13 modèles — Brom, corbeau, gargouille, Grolbak, tours Chevaliers, Nécropole, Foudre, Givre,
  Artillerie I, Tesla, Brasier, entrées Vallée et Cendres.

Pour les manques : garder l'art procédural existant, ou générer avec un outil gratuit
(Hunyuan3D, TRELLIS, offre gratuite de Tripo3D) en reprenant les prompts de `docs/modeles-3d.md`.

Les recolorations (« assombri », « teinte boue ») ne sont pas faites par le pipeline actuel :
il faudrait ajouter une option de teinte à `catalog.ts` / `bake.ts`, ou retoucher dans Blender.
