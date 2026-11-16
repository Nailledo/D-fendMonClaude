# Icônes 2D à produire (Higgsfield)

Les icônes actuelles sont des SVG dessinés à la main dans `packages/client/src/ui/icons.ts`.
Les compétences des héros et les améliorations de tours n'ont pas d'icône du tout (boutons vides).

Format de génération : une planche par lot, grille régulière, fond blanc uni `#FFFFFF`, une icône par case,
même style partout. Chaque planche est ensuite découpée en fichiers PNG à fond transparent.

Style commun à tous les prompts :

> game UI icon sheet, hand-painted stylized fantasy icons, thick dark outline, bold readable silhouette,
> warm saturated colors, soft cel shading, each icon centered in its own cell of a regular grid,
> pure white background #FFFFFF, no text, no labels, no frame, no drop shadow

Sont exclus et restent en SVG : pause, lecture, vitesse ×2, engrenage, fermer, bulle de discussion, joueurs
(simples pictogrammes monochromes, plus nets en vectoriel).

## Lot 1 — Ressources et HUD (9, grille 3×3)

| Clé | Icône |
|---|---|
| coin | pièce d'or |
| heart | cœur rouge (vies) |
| skull | crâne (ennemis) |
| horn | cor de guerre (appel de vague) |
| flag | étendard doré (point de ralliement) |
| star | étoile d'or pleine |
| starEmpty | étoile vide, grise |
| trophy | coupe d'or |
| crown | couronne d'or |

## Lot 2 — Tours et actions (9, grille 3×3)

| Clé | Icône |
|---|---|
| bow | arc et flèche (archers) |
| shield | bouclier rouge à croix dorée (caserne) |
| orb | orbe violet sur socle (mages) |
| cannon | canon sur roues (artillerie) |
| up | flèche verte vers le haut (amélioration) |
| sell | pièce d'or barrée d'un signe moins (vente) |
| lock | cadenas |
| gift | coffre cadeau rouge à ruban doré |
| boot | botte de cuir (vitesse) |

## Lot 3 — Sorts, Samuel, Lyra (8, grille 4×2)

| Clé | Icône |
|---|---|
| meteor | météore enflammé (Pluie de météores) |
| helmet | casque de milicien (Renforts) |
| samuel-1 | Charge héroïque : chevalier fonçant, épée en avant |
| samuel-2 | Cri de ralliement : cor et ondes dorées |
| samuel-3 | Pour Ethan ! : épée géante frappant le sol, éclat doré |
| lyra-1 | Flèche perçante : flèche verte traversant une cible |
| lyra-2 | Pluie de flèches : volée de flèches tombant |
| lyra-3 | Volée de l'aube : éventail de flèches dorées devant un soleil levant |

## Lot 4 — Brom, Nox, passifs (9, grille 3×3)

| Clé | Icône |
|---|---|
| brom-1 | Coup de marteau : marteau de forge frappant le sol |
| brom-2 | Tourelle de forge : petite tourelle mécanique |
| brom-3 | Forge ardente : sol de métal en fusion |
| nox-1 | Os ranimés : main de squelette sortant de terre |
| nox-2 | Drain de vie : tourbillon violet autour d'un cœur |
| nox-3 | Armée des morts : trois crânes aux yeux violets |
| passif-samuel | Cœur vaillant : cœur dans un bouclier |
| passif-lyra | Œil perçant : œil de faucon vert |
| passif-brom | Peau d'enclume : enclume |

Le passif de Nox (Vol de vie : goutte de sang ailée) passe dans le lot 5.

## Lot 5 — Améliorations archers et caserne (9, grille 3×3)

| Clé | Icône |
|---|---|
| passif-nox | Vol de vie : goutte de sang ailée |
| mortel | Tir mortel : flèche dans un crâne |
| faucon | Œil de faucon : longue-vue et cible |
| poison | Carreaux empoisonnés : carreau à pointe verte gouttant |
| rafale | Pluie de carreaux : trois carreaux en éventail |
| bouclier | Bouclier sacré : bouclier doré lumineux |
| provoc | Provocation : poing ganté levé |
| bond | Bond : silhouette encapuchonnée bondissant |
| lames | Lames jumelles : deux dagues croisées |

## Lot 6 — Améliorations mages et artillerie (8, grille 4×2)

| Clé | Icône |
|---|---|
| desint | Désintégration : rayon violet pulvérisant une silhouette |
| teleport | Téléportation : portail tourbillonnant bleu |
| blizzard | Blizzard : flocon géant et bourrasque |
| percant | Givre perçant : stalactite brisant une armure |
| napalm | Napalm : flaque de feu |
| frag | Bombe à fragmentation : bombe éclatant en bombinettes |
| surcharge | Surcharge : éclair ramifié |
| statique | Champ statique : sphère électrique à arcs |

## Total

52 icônes en 6 planches. Avec le modèle GPT Image 2 (1 crédit par image), cela coûte 6 des 10 crédits gratuits,
ce qui laisse 4 crédits pour refaire une planche ratée.
