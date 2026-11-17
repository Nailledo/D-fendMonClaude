# D-Fend : La Quête de Samuel

Tower defense 3D coopératif (1 à 4 joueurs) jouable dans le navigateur, inspiré des mécaniques de Kingdom Rush.
La princesse Ethan a été enlevée par le démon Kessin : Samuel, le dernier chevalier debout, part la sauver.

- **Mode histoire** : 8 niveaux sur 3 biomes (Vallée d’Aubeclair, Marais de Brumenoire, Terres de Cendre), 3 boss dont Kessin en 3 phases, dialogues et carte de campagne. Solo ou coop.
- **Mode survie** : vagues infinies générées procéduralement, une mutation toutes les 5 vagues, un boss toutes les 10, classement par carte et par nombre de joueurs.
- **4 familles de tours** (archers, caserne, mages, artillerie), 3 niveaux puis 2 spécialisations avec compétences, **4 héros** (Samuel, Patoche, Matéo, William), 2 sorts.
- **Tout l’art est fait en code** : modèles low-poly assemblés à partir de primitives, toon shading, sons et musique synthétisés (Web Audio). Aucune image, aucun modèle, aucun son externe.

## Démarrage rapide

Prérequis : Node.js 22 et pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev          # client sur http://localhost:5173 (+ serveur sur :3000)
```

En production locale :

```bash
pnpm build
pnpm start        # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Client Vite + serveur en rechargement automatique |
| `pnpm build` | Construit le client (`packages/client/dist`) et le serveur (`packages/server/dist`) |
| `pnpm start` | Lance le serveur de production (sert aussi le client) |
| `pnpm test` | Tests de la simulation (Vitest) |
| `pnpm typecheck` | Vérification TypeScript de tout le dépôt |
| `pnpm balance` | Rapport d’équilibrage : des bots jouent chaque niveau pour 1 à 4 joueurs |
| `pnpm families` | Compare les familles de tours : un bot ne construit qu’une seule famille, en solo |
| `pnpm tune` | Recalibre automatiquement les niveaux (long) |
| `pnpm bench` | Benchmark de rendu sur une scène de stress (~400 ennemis) ; `-- --gpu` pour utiliser la carte graphique |
| `pnpm smoke` | Test de fumée multijoueur dans un vrai navigateur (2 joueurs, construction, une vague) |

`bench` et `smoke` utilisent Playwright et un serveur lancé sur `http://localhost:3000` (ou `BENCH_URL` / `SMOKE_URL`).

## Architecture

```
packages/
  shared/   simulation déterministe (20 ticks/s), données du jeu, équilibrage, protocole binaire
  client/   Three.js (rendu instancié), art procédural, interface Svelte 5, audio synthétisé
  server/   WebSocket (salons à code), validation des scores par rejeu, classement SQLite
tools/      équilibrage par bots, benchmark, test de fumée
deploy/     Dockerfile, docker-compose, Caddyfile
```

- **Une seule simulation** (`packages/shared/src/sim.ts`) : en solo elle tourne dans un Web Worker, en multijoueur sur le serveur (autoritaire).
  Le client reçoit des snapshots binaires (~10 octets par ennemi) et les interpole avec ~100 ms de retard.
- **Déterminisme** : RNG à graine, aucune fonction transcendante dans la simulation. Les scores de survie solo sont validés en rejouant la partie côté serveur à partir de la graine et du journal des commandes.
- **Rendu** : un `InstancedMesh` par modèle (ennemis, soldats, tours, décor, projectiles, particules), animations procédurales dans le vertex shader, zéro allocation par frame. ~60 draw calls avec 400 ennemis.

### Équilibrage

Toutes les formules sont dans `packages/shared/src/balance.ts` et `packages/shared/src/data/levels.ts` :

- les PV des ennemis augmentent au fil des vagues (`hpRamp`) sans augmenter les primes : c’est ce qui crée la pression ;
- le multiplicateur de PV selon le nombre de joueurs (`hpByPlayers`) et son intensité par niveau (`multiK`) ont été calibrés pour que 2, 3 et 4 joueurs aient la même difficulté que le solo ;
- objectif en Vétéran : un joueur qui ne pose que des archers perd dès le premier niveau ; un joueur qui diversifie, améliore et utilise ses sorts gagne avec environ 10 vies ;
- en coopération, chacun peut améliorer (et spécialiser) la tour d’un autre avec son propre or ; seul le propriétaire la vend ou déplace son point de ralliement ;
- un héros prend les coups de l’ennemi qu’il combat, même si des soldats le bloquent déjà, et retient jusqu’à deux ennemis de plus autour de lui.

Après une modification des données, `pnpm balance` montre l’effet, `pnpm tune` recalibre.

## Contrôles

Tout se fait à la souris : clic sur un emplacement pour construire, clic sur une tour pour l’améliorer, clic droit pour déplacer le héros, molette pour zoomer, glisser pour déplacer la caméra.
Raccourcis par défaut (disposition AZERTY, tous modifiables dans *Paramètres > Contrôles*) :

| Action | Touche |
|---|---|
| Héros / compétences / ultime | `H` / `A`, `Z` / `R` |
| Météores / renforts | `1` / `2` |
| Construire archers, caserne, mages, artillerie | `W`, `X`, `C`, `V` |
| Améliorer / vendre / ralliement | `U` / `S` / `D` |
| Appeler la vague / vitesse ×2 | `Espace` / `F` |
| Discussion / signal | `Entrée` / `Alt` + clic |
| Pause, menu / debug | `Échap` / `F3` |

Les touches sont enregistrées par position physique : elles restent au même endroit sur un clavier QWERTY.

## Déploiement (VPS + Docker + Caddy)

1. **DNS** : créez un enregistrement `A` (et `AAAA` si IPv6) pour `defend.sayk.fr` vers l’IP du VPS.
2. **Récupérez le code** sur le VPS, puis :
   ```bash
   cp .env.example deploy/.env      # ajustez DOMAIN si besoin
   cd deploy
   docker compose up -d --build
   ```
   Caddy obtient automatiquement le certificat HTTPS. Le jeu est sur `https://defend.sayk.fr`.
3. **Caddy déjà installé sur le VPS ?** Utilisez plutôt :
   ```bash
   cd deploy
   docker compose -f docker-compose.game-only.yml up -d --build
   ```
   puis ajoutez le bloc de `deploy/Caddyfile.host` à votre Caddyfile et rechargez Caddy (`caddy reload`). Le jeu n’écoute que sur `127.0.0.1:3000`.

**Mettre à jour** : `git pull && docker compose up -d --build` (dans `deploy/`).
**Sauvegarder le classement** : la base SQLite est dans le volume `game_data` :
```bash
docker compose cp game:/data/scores.db ./scores-$(date +%F).db
```
**Santé** : `https://defend.sayk.fr/health` renvoie le nombre de salons et de joueurs connectés.

Variables d’environnement :

| Variable | Rôle |
|---|---|
| `DOMAIN` | Domaine servi par Caddy |
| `PORT` | Port du jeu (3000) |
| `MAX_ROOMS` | Salons simultanés (60) |
| `MAX_CLIENTS` | Connexions WebSocket simultanées (500) |
| `MAX_CONN_PER_IP` | Connexions WebSocket par adresse IP (8) |
| `TRUST_PROXY` | `1` derrière Caddy : l’IP des joueurs est lue dans `X-Forwarded-For`. À laisser vide si le jeu est exposé directement, sinon l’en-tête est falsifiable |
| `SCORE_SECRET` | Clé de signature des tickets de survie (`openssl rand -hex 32`). Sans elle, une clé aléatoire est tirée à chaque démarrage |
| `ALLOWED_ORIGINS` | Origines supplémentaires autorisées pour le WebSocket, séparées par des virgules |
| `LOG_LEVEL` | `info` ou `silent` |
| `DB_PATH`, `STATIC_DIR` | Emplacements de la base et du client construit |

## Sécurité

- **Classement de survie** : la graine de chaque partie est tirée et signée par le serveur (`POST /api/seed`, ticket HMAC à usage unique, valable 6 h, 6 par IP toutes les 10 min). À l’envoi du score, le serveur vérifie le ticket, refuse un journal plus long que le temps réellement écoulé (vitesse ×2 comprise), puis rejoue la partie dans un thread dédié, tué au bout de 30 s. Le classement est séparé par difficulté.
- **Salons** : codes de 6 caractères, 3 créations et 5 tentatives pour rejoindre par minute et par connexion (10 et 20 par IP), salon vide supprimé immédiatement, 40 messages par seconde et par connexion (fermeture au-delà du double).
- **WebSocket** : Origin vérifiée à la connexion, nombre de connexions plafonné par IP et au total.
- **En-têtes** : CSP stricte (aucun script en ligne), `X-Frame-Options`, `Permissions-Policy`, `nosniff`, envoyés par le serveur du jeu quel que soit le proxy.
- **Noms et discussion** : caractères de contrôle, invisibles et bidirectionnels retirés, noms réservés (« Système »…) refusés.

## Notes

- Le classement utilise `node:sqlite` (intégré à Node 22) plutôt que `better-sqlite3`, pour éviter toute compilation native dans l’image Docker.
- Interface « Facette » : aplats sombres aux coins biseautés et hexagones, comme les facettes du décor low-poly ; une couleur par famille de tours, l’or pour l’argent, le rouge pour les vies. Jetons et composants de base dans `packages/client/src/app.css`, icônes au trait dans `packages/client/src/ui/icons.ts`.
- Polices hébergées avec le jeu (Grenze, Grenze Gotisch, Atkinson Hyperlegible via `@fontsource`) : aucune requête vers un service tiers.
- La carte de campagne est dessinée en code (facettes en SVG) ; l’écran titre est un diorama 3D animé.
- Les menus sont en Svelte 5 ; le HUD est mis à jour à 10 Hz, les éléments qui suivent la caméra (menu radial, boutons de vague) sont positionnés directement à chaque frame.
