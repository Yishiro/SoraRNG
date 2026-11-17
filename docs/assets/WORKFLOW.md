# Illustrations : provenance et intégration

## État livré

Les 150 identités du catalogue sont couvertes dans `card-assets.json`. Après autorisation explicite du propriétaire pour un aperçu local, 135 références candidates sont téléchargées et affichées uniquement en développement sur localhost ; 15 cartes restent sans image. Aucune autorisation de publication n’est établie. Aucune image n’est générée par IA. Les réserves sur les correspondances de version sont conservées.

Le composant `src/components/game-card.tsx` est partagé par la collection, le Codex, les résultats d’invocation et les fiches. Il affiche un cadre neutre nominatif lorsque l’image est indisponible, une erreur d’image survient ou les droits ne sont pas validés. Les cadres de rareté et reflets sont en CSS ; aucune illustration n’est dessinée par IA. L’image autorisée est ajustée avec `contain` pour préserver ses proportions. Les miniatures sont utilisées dans les grilles, les images complètes dans les fiches.

`public/assets/cards/` et `public/assets/cards/thumbnails/` sont créés et vides de médias : aucun `.webp` n’est produit en l’absence d’autorisation. Les identifiants deviennent les noms de fichier une fois les conditions satisfaites.

## Sources et preuves

- `data/card-asset-targets.json` : correspondances de recherche explicites, distinctes du catalogue de gameplay.
- `card-assets.json` : carte, nom, version, origine, page de fichier, URL de média de référence, ayant droit présumé, statut, preuves, contrôles et chemins locaux éventuels.
- `docs/assets/research-requests.json` : requêtes MediaWiki ayant confirmé les fichiers candidats et leurs métadonnées.
- `docs/assets/prefix-searches.json` : recherches complémentaires de fichiers par noms anglais.
- `docs/assets/missing-searches.json` : recherches supplémentaires des identités non résolues.
- `docs/assets/reference-health.json` : 248 URL vérifiées par HEAD avec succès, sans récupération du corps des médias.
- `docs/assets/REPORT.md` et `report.json` : bilan reproductible.

Les sources consultées ne donnent pas de licence générale pour les images du wiki. La politique Square Enix West exclut Kingdom Hearts ; les directives japonaises et les règles officielles de partage/streaming ne permettent pas de conclure à une autorisation pour les illustrations de ce jeu web. Les photos de cosplay trouvées sur Commons ne sont pas des illustrations exactes des cartes et n’ont pas été substituées.

Sources complémentaires : [règles officielles de partage](https://www.square-enix.com/kingdomhearts/about/us/), [Commons — cosplay Sora](<https://commons.wikimedia.org/wiki/Category:Cosplay_of_Sora_(Kingdom_Hearts)>). Ces liens décrivent la recherche, pas une autorisation accordée.

`retrievedAt` indique la récupération du média local lorsqu’elle a eu lieu. `localPreview` contient les chemins privés, la date, l’empreinte source et la restriction de contexte. `localPath` et `thumbnailPath` restent réservés aux images publiables et nuls ici. `metadataCheckedAt` indique la date réelle de consultation des métadonnées. Les dates sont stockées en ISO UTC. L’auteur individuel n’est pas déduit automatiquement d’un nom de fichier ou de la mention d’un jeu.

## Contrôle avant téléchargement

Une image ne devient publiable que si le manifeste contient simultanément :

1. `rightsStatus` : `licensed`, `public_domain` ou `permission_granted`.
2. `rightsProof` : URL de preuve, licence ou permission, portée couvrant ce jeu et ses transformations, identité du vérificateur et date.
3. `validationStatus` : `approved_exact_match` (puis `published` après intégration).
4. `aiStatus` : `verified_non_ai`, après vérification de provenance ; une apparence « officielle » seule ne suffit pas.

Ces champs sont des preuves à établir, jamais des valeurs à activer simplement pour forcer un téléchargement. Le code ne peut pas déterminer juridiquement une permission à partir d’un intitulé. Toute autre situation reste bloquée côté téléchargement et rendu. Les URL externes du manifeste ne sont jamais utilisées comme `src` dans le jeu.

## Commandes

`pnpm assets:local` prépare les aperçus locaux dans `.local/card-assets/images/` et `thumbnails/`, avec index et reçus. Le dossier est ignoré par Git, Prettier et Docker. Les routes `/api/local-card-assets` et `/api/local-card-assets/[id]` ne répondent qu’en développement et sur loopback, sans cache et sans indexation. En production elles retournent 404, même si les fichiers privés sont présents. Le composant contourne l’optimiseur Next pour ces aperçus afin de ne pas en conserver une copie dans son cache public. L’index est partagé entre les cartes pour éviter 150 requêtes de métadonnées. Un rechargement de page actualise l’index après préparation.

```powershell
pnpm assets:research
pnpm assets:prepare
pnpm assets:check
pnpm assets:test
node scripts/check-asset-references.mjs
```

`assets:research` refait uniquement la recherche de métadonnées et refuse de remplacer un manifeste contenant déjà des fichiers publiés. Pour préserver les preuves, ne pas le relancer après une approbation manuelle sans fusionner les changements.

`assets:prepare` ne télécharge que les entrées autorisées et vérifiées. Hôtes sources limités à ceux examinés ; redirections de téléchargement refusées ; limite de 20 Mo et 40 millions de pixels ; contrôle du format réel. Les sorties WebP sont au maximum 960 × 1 280 et les miniatures 240 × 320, sans agrandissement ni recadrage. SHA-256 du média source conservé. Les sources ne sont pas modifiées en place.

`assets:check` contrôle les identités, les droits, les chemins, les formats, proportions, dimensions et miniatures, ainsi que les images publiées sans entrée autorisée. La limite des miniatures est 150 Ko. Avec zéro illustration autorisée, le contrôle des fichiers réels est vide, et non présenté comme un chargement réussi d’images inexistantes.

`assets:test` vérifie la conversion sur des buffers géométriques temporaires, créés en mémoire et jamais publiés. Ces fixtures ne sont ni des illustrations ni des images IA. Le moteur Sharp déjà livré avec Next.js est réutilisé.

Les tests navigateur de collection utilisent les vrais modèles et des exemplaires de test injectés uniquement dans la réponse UI, sans modifier la base et sans ajouter de contournement de session. Captures contrôlées : `collection-desktop.png` et `collection-mobile.png`.

## Ambiguïtés à conserver

Forme Souvenance et Forme Limite ont un même candidat Limit Form ; les deux cartes restent distinctes. Armure possédée indique BBS alors que le candidat Armored Ventus Nightmare correspond à DDD. « Forme Lumière », « Lumière du Crépuscule » et le Simili « Crépuscule » ne sont pas remplacés par une forme ressemblante. Ces remarques sont conservées dans le manifeste, sans changement des règles du jeu.
