# Prompt de développement : « D-Fend : La Quête de Samuel »

> Prompt destiné à un agent de développement (Claude Code ou équivalent). Il décrit le jeu complet, les choix techniques imposés et l'ordre de livraison. Le titre est provisoire.

---

## 0. Rôle et objectif

Tu es un développeur senior de jeux web 3D et de réseau temps réel. Tu construis de zéro, dans ce dépôt vide, un **tower defense 3D coopératif jouable dans le navigateur**, inspiré des **mécaniques** de Kingdom Rush (emplacements de tours fixes, casernes qui bloquent les ennemis, héros contrôlable, sorts, appel anticipé des vagues, étoiles), mais avec un univers, des personnages, des cartes et un style visuel **100 % originaux**. Ne reprends aucun nom, personnage, visuel, son ou niveau de Kingdom Rush.

Le jeu sera hébergé sur un VPS avec Docker et Caddy, à l'adresse **`https://defend.sayk.fr`**.

Priorités, dans l'ordre :
1. **Fluidité et performance** (60 FPS stables, aucun à-coup).
2. **Difficulté réelle**, qui s'adapte au nombre de joueurs.
3. **Beauté** : 3D low-poly stylisée, faite à la main en code, sans aucune image ni modèle généré par IA.
4. Contenu : mode histoire de 8 niveaux, mode survie infini, coop jusqu'à 4.

Tout le texte du jeu est **en français**.

---

## 1. Pile technique (imposée)

| Domaine | Choix |
|---|---|
| Langage | TypeScript strict partout |
| Monorepo | pnpm workspaces : `packages/shared`, `packages/client`, `packages/server` |
| Rendu 3D | Three.js (WebGL2), pas de moteur additionnel |
| Interface (menus, HUD) | Svelte 5 en surcouche HTML/CSS au-dessus du canvas |
| Build client | Vite |
| Serveur | Node.js 22 + `ws` (WebSocket natif), protocole binaire maison |
| Stockage | SQLite (`better-sqlite3`) pour le classement survie uniquement |
| Audio | Web Audio API, sons et musique **synthétisés en code** (aucun fichier audio) |
| Tests | Vitest (simulation, équilibrage), Playwright (test de fumée) |
| Déploiement | Docker multi-stage, docker compose, Caddy |

### Architecture de simulation

- `packages/shared` contient **toute la logique de jeu** : simulation à pas fixe (**20 ticks/s**), entités, données des tours, ennemis, héros, vagues, formules de difficulté, et le protocole réseau. Aucune dépendance à Three.js ni au DOM.
- **Solo** : la simulation tourne en local dans un Web Worker (pas besoin du serveur, sauf pour envoyer un score survie).
- **Multi** : le serveur est **autoritaire**. Les clients envoient des commandes (`build`, `upgrade`, `sell`, `setRally`, `moveHero`, `castSpell`, `useHeroSkill`, `callWave`, `ping`, `chat`). Le serveur valide (or, emplacement libre, propriétaire, cooldown) et applique.
- Le serveur diffuse des **snapshots binaires compacts** (20 Hz) : ennemis encodés par `id, pathId, progression (uint16), hp (uint16), état`, et non par position 3D. Les événements ponctuels (tir, mort, construction, sort) partent dans un flux d'événements séparé.
- Le client affiche avec **~100 ms d'interpolation** et rend à la fréquence de l'écran, découplée du tick.
- Le placement d'une tour affiche un fantôme immédiat (retour visuel local), confirmé ou annulé par le serveur.
- Les rendus et la simulation ne s'appellent jamais directement : le rendu lit un état interpolé.

---

## 2. Performance : budget non négociable

Matériel cible : **GPU intégré type Intel Iris Xe, 1080p, préréglage « Moyen »**, scène chargée (4 joueurs, 400 ennemis, 60 tours, 250 projectiles, 4 héros) → **60 FPS stables**, frame time p99 < 20 ms.

Règles à appliquer partout :
- **InstancedMesh** pour tout ce qui se répète : ennemis (une instance par partie du corps), projectiles, soldats, arbres, rochers, particules.
- Décor statique d'une carte **fusionné** en quelques géométries (mergeGeometries) au chargement.
- **Un matériau toon partagé** à couleurs de sommets (pas de textures image) ; variations par attributs d'instance.
- **Moins de 200 draw calls** en pleine bataille. Affiche un compteur debug (F3) : FPS, draw calls, triangles, entités, ping, taille des snapshots.
- **Zéro allocation dans la boucle de jeu** : pools d'objets, vecteurs/matrices réutilisés, tableaux typés.
- Animations des ennemis **procédurales dans le vertex shader** (balancement, cycle de marche par sinus, phase par instance), pas de squelettes.
- Une seule lumière directionnelle avec ombres, frustum d'ombre ajusté à la carte ; ombres désactivées en « Bas ».
- Préréglages graphiques **Bas / Moyen / Haut / Ultra** + échelle de résolution + limite de FPS. Détection automatique au premier lancement.
- Post-traitement léger et optionnel : FXAA en Moyen, bloom discret en Haut et Ultra seulement.
- Chargement initial **< 3 Mo gzip**, partie jouable en < 5 s. Code découpé (menus vs jeu).
- Mettre la simulation solo dans un Worker pour libérer le thread de rendu.
- Pause automatique du rendu quand l'onglet est caché (la simulation multi continue côté serveur).

Écris un **benchmark automatisé** (`pnpm bench`) qui lance une scène de stress headless avec Playwright et vérifie le budget de draw calls et le temps de frame.

---

## 3. Direction artistique « faite main »

- **Low-poly stylisé construit en code** : chaque tour, ennemi, héros et élément de décor est une fonction TypeScript qui assemble des primitives (boîtes, cylindres, cônes, icosphères, extrusions de formes 2D) en un modèle cohérent. Rassemble-les dans `packages/client/src/art/` (un fichier par famille).
- **Silhouettes lisibles** de loin, proportions un peu cartoon (têtes et armes surdimensionnées), couleurs franches.
- **Toon shading** : 3 paliers de lumière via une gradient map, ombre colorée (pas noire), occlusion ambiante peinte dans les couleurs de sommets (bas des murs plus sombre, etc.).
- **Contour** (inverted hull) uniquement sur les héros, les boss et l'élément survolé.
- Palette par biome, définie dans un fichier de thème :
  - **Vallée d'Aubeclair** (niveaux 1-3) : verts tendres, toits ocre, ciel doré.
  - **Marais de Brumenoire** (niveaux 4-5) : violets, verts acides, brume basse, lucioles.
  - **Terres de Cendre / Citadelle de Kessin** (niveaux 6-8) : basalte, rouge braise, lave animée, ciel orageux.
- Ambiance : brouillard de profondeur, eau et lave animées par shader simple, herbe en instances qui ondule, particules (feuilles, cendres, étincelles) en instances.
- Effets de jeu très lisibles : chiffres de dégâts optionnels, éclairs de coup, explosions en particules, cercle de portée au survol, flash de construction.
- **Écran titre** : un diorama 3D animé (le château, Samuel au premier plan, la citadelle de Kessin à l'horizon) avec une caméra qui tourne lentement.
- Interface : parchemin et bois dessinés en CSS (dégradés, bordures, ombres), police libre de type fantasy (Google Fonts, ex. « Cinzel » pour les titres, « Nunito » pour le texte), icônes en SVG dessinés à la main dans le code.

---

## 4. Mécaniques de jeu (inspirées de Kingdom Rush)

### 4.1 Base
- Les ennemis suivent des **chemins prédéfinis** (courbes Catmull-Rom, plusieurs chemins par carte, variantes de voie).
- Les tours se construisent uniquement sur des **emplacements fixes**.
- **Vies partagées** par l'équipe (20 en histoire). Chaque ennemi qui sort retire 1 vie (les boss en retirent plus).
- **Or personnel** par joueur (voir § 6 pour le partage des primes).
- **Appel anticipé** d'une vague : bonus d'or pour le joueur qui appelle **et** réduction des recharges de sorts pour tous, proportionnels au temps restant.
- **Revente** à 60 % de l'investissement total (100 % si revendue dans les 3 s pour annuler une erreur).
- **Étoiles** en fin de niveau : 3 (≥ 18 vies), 2 (≥ 6), 1 (sinon).
- Vitesse de jeu ×1 / ×2 (en multi : seulement si tous les joueurs votent ×2).

### 4.2 Tours (4 familles, 3 niveaux + 2 spécialisations au niveau 4)

| Famille | Rôle | Spécialisation A | Spécialisation B |
|---|---|---|---|
| **Archers** | Dégâts physiques rapides, touche les volants | Tireurs d'élite (longue portée, coup critique « tir mortel ») | Arbalétriers à répétition (rafales, flèches empoisonnées) |
| **Caserne** | 3 soldats qui **bloquent** les ennemis au sol, point de ralliement déplaçable | Gardes royaux (tank, provocation) | Rôdeurs (dégâts, saut sur cible prioritaire) |
| **Mages** | Dégâts magiques (ignorent l'armure) | Arcaniste (rayon de désintégration, téléportation d'ennemis en arrière) | Sorcier du givre (ralentissement, gel de zone) |
| **Artillerie** | Dégâts de zone, lents, sol uniquement | Mortier à flammes (sol enflammé) | Canon tesla (chaîne d'éclairs, touche les volants) |

Chaque spécialisation a **2 compétences** achetables (3 rangs chacune). Toutes les valeurs dans `packages/shared/src/data/towers.ts`.

### 4.3 Types d'armure et de dégâts
- Dégâts **physiques** / **magiques** / **vrais**.
- Armure physique et résistance magique : aucune, faible (30 %), moyenne (50 %), forte (80 %).

### 4.4 Ennemis (au moins 18 types + 3 boss)
Couvre ces archétypes : piétaille, coureur rapide, brute blindée, chaman qui soigne, mage à résistance magique, volant, volant qui largue des ennemis, invocateur, ennemi qui se divise à la mort, ennemi qui creuse sous terre (invisible un temps), ennemi qui étourdit les tours, régénérateur, kamikaze qui explose sur les soldats, porte-bouclier qui protège ses voisins, enragé qui accélère quand il est blessé.
Thèmes par biome : gobelins et loups (Vallée), noyés et sorcières des marais (Brumenoire), démons et golems de lave (Cendre).
Boss : **Grôlbak le chef gobelin** (niveau 3), **Mère Vasière** (niveau 5), **Kessin** (niveau 8, 3 phases).

### 4.5 Héros (un par joueur)
Contrôlé au clic (clic sur le héros puis clic au sol, ou raccourci). Gagne de l'expérience **pendant la partie** (niveaux 1 à 10), réapparaît 15 s après sa mort. Chaque héros a 1 passif, 2 compétences actives et 1 ultime.
- **Samuel** (héros de l'histoire, imposé en solo) : chevalier au grand cœur un peu maladroit. Épée et bouclier, charge, cri de ralliement, ultime « Pour Ethan ! » (zone de dégâts + bouclier sur les soldats proches).
- **Lyra** : archère de la forêt, à distance, flèche perçante, pluie de flèches.
- **Brom** : forgeron nain, tank, pose une tourelle temporaire, marteau qui étourdit.
- **Nox** : apprentie nécromancienne repentie, invoque des squelettes, drain de vie.
Deux joueurs peuvent prendre le même héros (couleur de cape différente par joueur).

### 4.6 Sorts d'équipe
Chaque joueur a ses propres recharges pour : **Pluie de météores** (ciblée, zone) et **Renforts** (2 miliciens temporaires). En multi, les sorts sont colorés selon le joueur qui les lance.

### 4.7 Encyclopédie
Fiches des tours et des ennemis débloquées à la première rencontre (stats, résistances, petite description humoristique).

---

## 5. Modes de jeu

### 5.1 Mode histoire (solo ou coop 2-4)
8 niveaux sur une **carte du monde** 3D (vue de dessus, chemin qui se débloque). Progression sauvegardée en `localStorage` (étoiles, niveaux débloqués, encyclopédie). En coop, c'est la progression de **l'hôte** qui détermine les niveaux accessibles ; chaque joueur enregistre ses étoiles chez lui.

Chaque niveau : 10 à 16 vagues, un modificateur ou une mécanique de carte unique (pont-levis à activer, brouillard qui masque une voie, coulées de lave périodiques, emplacements bonus à débloquer…).

**Scénario** (ton : épique avec humour, à la Kingdom Rush ; dialogues courts, punchlines, clins d'œil) :
- **Prologue** : pendant le bal du royaume d'Aubeclair, le démon **Kessin** surgit et enlève **la princesse Ethan**. Le roi, paniqué, confie la mission au seul chevalier encore debout : **Samuel**, qui était parti chercher des petits fours.
- **Niveaux 1-3 (Vallée d'Aubeclair)** : Samuel repousse les gobelins alliés de Kessin. Rencontre avec Lyra. Boss : Grôlbak, qui révèle que Kessin veut le pouvoir caché de la princesse.
- **Niveaux 4-5 (Marais de Brumenoire)** : Brom et Nox rejoignent l'aventure. Ethan, prisonnière, envoie des messages via des corbeaux et se révèle bien plus débrouillarde que prévu. Boss : Mère Vasière.
- **Niveaux 6-7 (Terres de Cendre)** : assaut des remparts de la citadelle. Kessin nargue Samuel par projection holographique démoniaque.
- **Niveau 8 (Salle du trône de Kessin)** : combat final en 3 phases (Kessin invoque, puis vole, puis se transforme). Ethan s'échappe en plein combat et aide Samuel.
- **Épilogue** : Ethan est sauvée, Kessin vaincu… avec une scène finale drôle (teaser).

Cinématiques **dans le moteur** : caméra scriptée sur la scène 3D + boîtes de dialogue avec portraits 3D rendus en temps réel. Toujours passables (Échap). Tous les textes dans `packages/client/src/story/`.

Modes de difficulté par niveau : **Normal**, **Vétéran** (par défaut proposé), **Cauchemar** (débloqué après 3 étoiles).

### 5.2 Mode survie infini (solo ou coop 2-4)
- 3 cartes dédiées (une par biome) avec plusieurs chemins qui s'ouvrent au fil des vagues.
- Vagues **générées procéduralement** à partir d'un budget de menace qui croît (budget × 1,13 par vague, plus additif) ; composition tirée selon des pondérations qui évoluent.
- **Mutation** toutes les 5 vagues (ex. « ennemis +30 % vitesse », « volants doublés », « régénération »), choisie au hasard et annoncée.
- **Boss toutes les 10 vagues**, de plus en plus forts.
- Vies : 20 au départ, +1 tous les 10 vagues réussies.
- **Classement** côté serveur (SQLite) par carte et par nombre de joueurs (1, 2, 3, 4) : vague atteinte, temps, pseudos. Validation serveur : en multi, le score vient de la partie serveur ; en solo, envoie la graine + le journal des commandes et le serveur **rejoue la simulation** pour valider le score.

---

## 6. Difficulté et adaptation au nombre de joueurs

Le jeu doit être **difficile** : un joueur moyen ne doit pas obtenir 3 étoiles en Vétéran du premier coup à partir du niveau 3.

Toutes les formules sont dans `packages/shared/src/balance.ts`, avec des constantes faciles à ajuster. Base de départ (n = nombre de joueurs) :

| Paramètre | Formule |
|---|---|
| PV des ennemis | `base × (1 + 0,45 × (n − 1))` |
| Nombre d'ennemis par vague | `base × (1 + 0,35 × (n − 1))`, arrondi |
| Vitesse | inchangée (lisibilité) |
| Or de départ par joueur | `base × (1,0 ; 0,7 ; 0,6 ; 0,55)` pour n = 1..4 |
| Prime de kill | versée **à chaque joueur** : `prime × (1,0 ; 0,62 ; 0,48 ; 0,4)` |
| Emplacements | les cartes ont assez d'emplacements pour 4 joueurs ; en solo certains sont verrouillés, ils s'ouvrent selon n |
| Boss | PV `× (1 + 0,6 × (n − 1))` + une compétence supplémentaire à partir de 3 joueurs |
| Multiplicateur Normal / Vétéran / Cauchemar | PV × 0,8 / 1,0 / 1,35, primes × 1,1 / 1,0 / 0,9, vies 20 / 20 / 1 |

Règles :
- La difficulté est **recalculée au début de chaque vague** selon les joueurs connectés.
- Pas de « catch-up » automatique caché : la difficulté vient de la composition des vagues et de la contre-mesure (volants, résistants, étourdisseurs) qui force à diversifier les tours.
- Écris un **simulateur d'équilibrage headless** (`pnpm balance`) : il joue chaque niveau avec un bot placeur simple (stratégie gloutonne + stratégie « diversifiée ») pour n = 1 à 4, et affiche le taux de victoire et les vies restantes. Objectif : bot glouton perd en Vétéran à partir du niveau 3 ; bot diversifié gagne avec 5 à 15 vies ; écart de taux de victoire entre n = 1 et n = 4 inférieur à 10 points.

---

## 7. Multijoueur

- **Lobby sans compte** : le joueur choisit un pseudo (mémorisé localement) puis **Créer un salon** ou **Rejoindre** avec un **code à 5 caractères** (sans caractères ambigus : pas de 0/O, 1/I).
- Dans le salon : liste des joueurs, choix du héros, couleur, bouton Prêt. L'hôte choisit le mode, le niveau ou la carte et la difficulté. Lancement quand tout le monde est prêt.
- **Pendant la partie** :
  - Chaque tour a la couleur de son propriétaire (bannière). Seul le propriétaire peut l'améliorer ou la vendre.
  - **Don d'or** à un coéquipier (par tranches de 50).
  - **Pings** sur la carte (Alt + clic) avec 3 types : « attention ici », « je construis ici », « aide ».
  - **Chat** texte court + messages rapides.
  - Indicateur de ping réseau par joueur.
- **Déconnexion** : jeton de reconnexion stocké localement, place gardée **90 s** (ses tours continuent de tirer, son héros reste en position). Au-delà, ses tours et son or sont répartis équitablement entre les joueurs restants et la difficulté se recalcule à la vague suivante. Si l'hôte part, un autre joueur devient hôte.
- Limites serveur : 4 joueurs par salon, salons vides détruits après 2 min, limitation du débit des commandes par client, validation de toutes les entrées, taille maximale des messages.
- Le serveur doit tenir **au moins 50 salons simultanés** sur un VPS 2 vCPU / 4 Go.

---

## 8. Contrôles

Tout est faisable **à la souris seule**. Le clavier sert de raccourci, et **tous les raccourcis sont modifiables** dans Paramètres > Contrôles (réattribution, détection de conflit, bouton « Par défaut », sauvegarde locale).

Les raccourcis sont stockés par **position physique** (`event.code`) pour fonctionner en AZERTY comme en QWERTY, et affichés avec la lettre réelle du clavier du joueur (`navigator.keyboard.getLayoutMap()` quand disponible, sinon table AZERTY par défaut).

Raccourcis par défaut (lettres affichées en AZERTY) :

| Action | Touche |
|---|---|
| Sélectionner son héros | `H` |
| Compétences du héros | `A`, `Z`, `E` (ultime : `R`) |
| Pluie de météores / Renforts | `1` / `2` (`&` / `é` sans Maj) |
| Construire sur l'emplacement survolé : Archers, Caserne, Mages, Artillerie | `W`, `X`, `C`, `V` |
| Améliorer / Vendre la tour sélectionnée | `U` / `S` |
| Déplacer le point de ralliement | `D` |
| Appeler la vague suivante | `Espace` |
| Vitesse ×2 | `F` |
| Ping | `Alt` + clic |
| Chat | `Entrée` |
| Pause (solo) / menu | `Échap` |
| Affichage debug | `F3` |

Caméra : vue en perspective inclinée (~55°), **zoom à la molette**, déplacement par **clic-molette glissé**, bords d'écran (désactivable) ou flèches du clavier ; limites de carte ; double-clic sur le portrait du héros pour centrer.

Menus contextuels « à la Kingdom Rush » : clic sur un emplacement ouvre un **anneau radial** autour de lui avec les 4 tours (prix, grisé si or insuffisant, info-bulle avec stats).

Paramètres : graphismes (préréglages + options détaillées), audio (général, musique, effets), contrôles, accessibilité (taille du texte, mode daltonien pour les couleurs de joueurs, réduction des tremblements d'écran), affichage des dégâts.

---

## 9. Audio synthétisé

- Moteur dans `packages/client/src/audio/` : petits synthétiseurs Web Audio (oscillateurs, bruit filtré, enveloppes ADSR, réverbération par convolution générée).
- Effets : tir d'arc, sort, explosion, construction, amélioration, mort d'ennemi par famille, vie perdue, vague entrante (cor), victoire, défaite, clics d'interface.
- **Musique procédurale** par biome : séquenceur simple avec gammes et progressions d'accords écrites à la main, couches qui s'intensifient pendant les vagues et les boss.
- Limiter les voix simultanées (pool de 24) et regrouper les sons identiques dans la même frame.

---

## 10. Arborescence attendue

```
/
├─ packages/
│  ├─ shared/        # simulation, données, balance, protocole, RNG à graine
│  ├─ client/        # Three.js, art procédural, UI Svelte, audio, entrées
│  └─ server/        # ws, salons, validation, classement SQLite
├─ tools/            # balance (simulateur), bench (perf), éditeur de chemins
├─ deploy/
│  ├─ Dockerfile
│  ├─ docker-compose.yml
│  └─ Caddyfile
├─ .env.example
└─ README.md
```

Ajoute un **petit éditeur de cartes** en mode dev (`?editor=1`) pour placer chemins et emplacements et exporter du JSON : les 11 cartes (8 histoire + 3 survie) sont stockées en JSON dans `packages/shared/src/data/maps/`.

---

## 11. Déploiement (VPS + Docker + Caddy)

- **Dockerfile multi-stage** : build pnpm → image finale `node:22-alpine` minimale qui sert le client statique **et** le WebSocket sur le même port (3000), utilisateur non-root, `HEALTHCHECK` sur `/health`.
- **docker-compose.yml** : service `game` (volume nommé pour la base SQLite, `restart: unless-stopped`, limites mémoire/CPU) + service `caddy` (ports 80/443, volumes `caddy_data` et `caddy_config`). Prévoir aussi la variante où Caddy est déjà installé sur le VPS (le service `game` expose alors seulement `127.0.0.1:3000`).
- **Caddyfile** :

```caddy
{$DOMAIN:defend.sayk.fr} {
	encode zstd gzip

	@assets path /assets/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	header /index.html Cache-Control "no-cache"

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}

	reverse_proxy game:3000
}
```

  Le WebSocket est sur `/ws` (Caddy gère l'upgrade automatiquement).
- `.env.example` : `DOMAIN=defend.sayk.fr`, `PORT=3000`, `MAX_ROOMS=60`, `LOG_LEVEL=info`.
- README : installation locale (`pnpm i && pnpm dev`), commandes, déploiement pas à pas (enregistrement DNS A/AAAA pour `defend.sayk.fr`, `docker compose up -d --build`, mise à jour, sauvegarde du volume SQLite).

---

## 12. Plan de livraison (dans cet ordre, chaque jalon jouable et commité)

1. **Socle** : monorepo, simulation partagée à pas fixe, 1 carte, 2 types d'ennemis, tours Archers + Caserne, rendu Three.js simple avec instanciation, HUD minimal. Tests Vitest de la simulation.
2. **Gameplay complet** : 4 familles de tours avec niveaux et spécialisations, armures, héros Samuel, sorts, appel anticipé, étoiles, raccourcis modifiables, menu radial.
3. **Direction artistique** : art procédural de toutes les tours, ennemis, héros et du premier biome ; toon shading, particules, écran titre, préréglages graphiques, benchmark de perf qui passe.
4. **Multijoueur** : serveur, salons à code, synchronisation par snapshots, interpolation, propriété des tours, dons d'or, pings, chat, reconnexion, mise à l'échelle de la difficulté.
5. **Mode histoire** : 8 niveaux, 3 biomes, 3 boss, carte du monde, cinématiques et dialogues, sauvegarde locale, encyclopédie, héros Lyra, Brom, Nox.
6. **Mode survie** : génération procédurale, mutations, 3 cartes, classement SQLite avec validation par rejeu.
7. **Audio, polish et équilibrage** : synthés et musique, simulateur d'équilibrage aux objectifs, accessibilité.
8. **Déploiement** : Docker, compose, Caddyfile, README, test de fumée Playwright (créer un salon, rejoindre à 2, construire une tour, finir une vague).

À la fin de chaque jalon : lancer les tests, le benchmark (à partir du jalon 3) et faire un commit clair.

---

## 13. Critères d'acceptation

- [ ] 60 FPS stables sur la scène de stress en préréglage Moyen (benchmark vert), < 200 draw calls.
- [ ] Une partie à 4 joueurs reste fluide avec 150 ms de latence simulée (pas de saccade visible des ennemis).
- [ ] Aucun modèle, texture, image ou son externe généré par IA : tout l'art est en code, seule la police vient de Google Fonts.
- [ ] Tous les raccourcis sont réattribuables et le jeu est entièrement jouable à la souris.
- [ ] Les 8 niveaux de l'histoire et la survie sont jouables en solo et en coop jusqu'à 4.
- [ ] Le simulateur d'équilibrage respecte les objectifs du § 6.
- [ ] `docker compose up -d --build` sur un VPS vierge sert le jeu en HTTPS sur `defend.sayk.fr`.
- [ ] Textes 100 % en français, sans faute.
