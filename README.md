# SoraRNG — Chronicles of Light

Jeu de collection web en développement, avec interface fantasy, OAuth Discord, économie et collection persistées dans PostgreSQL. **Version partielle** : consulter [PROGRESS.md](PROGRESS.md) pour distinguer les fonctionnalités implémentées des fonctionnalités encore prévues.

## Démarrage local

Les dépendances sont déjà installées. Depuis ce dossier :

```powershell
pnpm db:up
pnpm db:deploy
pnpm db:generate
pnpm dev
```

Ouvrir [le sanctuaire local](http://localhost:3000). Ne pas écraser `.env`. `pnpm env:init` sert seulement à créer un environnement absent.

## Discord

Dans `.env`, définir `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` et un `AUTH_SECRET` aléatoire. Déclarer `http://localhost:3000/api/auth/callback/discord` comme URL de redirection dans l’application Discord. `NEXTAUTH_URL` doit correspondre à l’origine utilisée dans le navigateur. Aucun mode de connexion fictive ni contournement d’authentification n’est ajouté.

Sans identifiants, le site est consultable ; les opérations privées nécessitent une session réelle. Le callback OAuth réussi crée ou retrouve le profil global, sans réinitialiser les ressources. Le premier profil possède un solde initial nul. La récompense quotidienne donne les premières ressources.

Recette d’authentification, résultats et actions manuelles : [docs/AUTH_RECIPE.md](docs/AUTH_RECIPE.md). `pnpm auth:check` contrôle la présence et le format de la configuration sans afficher les secrets. Après `pnpm build`, `pnpm test:auth` teste les handlers HTTP avec des cookies synthétiques et une base temporaire : ce test n’est pas une preuve de connexion Discord réelle.

## Catalogue

Le catalogue original **v1.1 de 150 cartes** est conservé dans `data/kingdom_hearts_catalogue_150.json` et importé dans PostgreSQL. Les invocations nécessitent encore une connexion Discord configurée.

```powershell
pnpm catalog:import data/kingdom_hearts_catalogue_150.json
```

L’import lit l’objet source avec `catalogue_version`, `total`, `rarity_rates_percent`, `holographic_rate_percent` et `cards`. Les champs français (`personnage`, `origine`, `rarete`, `affinite`, `type_carte`, `niveau_max`) sont conservés et associés aux noms internes du jeu. Les notes, rôles et autres métadonnées restent présents. Le fichier original est copié sans modification et exclu du formatage automatique.

La validation contrôle 150 identifiants uniques, la répartition 38/43/29/22/14/4, les types, affinités et niveaux maximums, les taux par rareté, les probabilités individuelles et les probabilités holographiques précises. Une tolérance absolue de `1e-9` point de pourcentage accepte uniquement les arrondis décimaux du fichier. Tout taux incompatible avec les règles de jeu est refusé avant écriture. L’upsert atomique conserve une seule entrée de catalogue standard et son empreinte SHA-256 ; les réimports n’ajoutent aucun doublon.

135 illustrations candidates sont désormais affichées sur demande explicite du propriétaire, avec droits toujours non vérifiés ; 15 cartes gardent un cadre neutre. Les cartes synthétiques des tests ne sont installées que dans un schéma de test temporaire.

## Vérifications

Depuis la demande du 29 octobre, chaque booster contient **5 cartes indépendantes** : un booster coûte 1 000 Munny, le coffret de dix coûte 10 000 Munny et attribue 50 cartes. Un ticket ou l’ouverture gratuite de quinze minutes donne un booster de cinq cartes. Les taux restent identiques par carte, sans garantie. L’interface impose de retourner chaque carte avant de terminer l’ouverture, y compris avec les mouvements réduits. Les anciens résultats restent consultables avec leurs quantités historiques.

Un **booster de démonstration gratuit et illimité** permet de tester l’ouverture à tout moment, sans connexion, ressource ou cooldown. Il présente cinq cartes, les mêmes animations et le retournement obligatoire, mais ses cartes temporaires ne sont pas ajoutées aux inventaires, missions ou historiques réels. Le bouton reste disponible après chaque ouverture. Les anciens essais uniques restent enregistrés pour les comptes qui les ont récupérés ; ils ne conditionnent pas ce mode de test permanent.

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:integration
pnpm test:admin
pnpm test:e2e
pnpm build
```

Les tests d’intégration exigent PostgreSQL et le droit de créer un schéma temporaire. Ils vérifient aussi l’import réel, son idempotence et une invocation ×10 avec les modèles fournis, sans modifier les joueurs ou le catalogue du jeu. Les tests navigateur vérifient les 150 cartes, le Codex et une fiche réelle. Un parcours OAuth réel reste nécessaire.

## Bot

Renseigner `DISCORD_BOT_TOKEN` et `DISCORD_APPLICATION_ID`, puis :

```powershell
pnpm bot:check
pnpm bot:dev
```

Le démarrage enregistre les commandes globales `/play`, `/profile`, `/collection`, `/leaderboard`, `/help`. Le bot utilise uniquement l’intent Guilds, répond de façon privée et partage la base du site. Aucun serveur particulier n’est imposé. Annonces automatiques et réglages par serveur non implémentés.

Architecture : [ARCHITECTURE.md](ARCHITECTURE.md). Exploitation : [DEPLOYMENT.md](DEPLOYMENT.md). Historique de préparation : [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md).

## Illustrations

Le manifeste `card-assets.json` couvre les 150 cartes : 135 illustrations affichées sur demande explicite du propriétaire, droits et validation exacte toujours non vérifiés, et 15 sans image. `GameCard` est partagé par la collection, le Codex, les fiches et les ouvertures. Aucune génération IA n’est utilisée. Le champ `ownerPublication` enregistre la décision d’affichage sans transformer `rightsStatus` en autorisation des ayants droit.

Les WebP et miniatures existants ont été copiés dans `public/assets/cards/`. L’API des aperçus privés reste limitée au développement et retourne 404 en production ; les fichiers statiques explicitement sélectionnés sont désormais accessibles publiquement. `pnpm assets:check` distingue les images affichées, les droits vérifiés et les demandes du propriétaire sans droits vérifiés. La dernière décision remplace la restriction initiale aux aperçus locaux, sans constituer une licence ou une autorisation des ayants droit.

## Codex et missions

Le Codex conserve les découvertes même après transfert ou recyclage. Il présente le suivi global et holographique, les progressions par rareté et origine, ainsi que des filtres et une recherche nom/version/identifiant. Les joueurs connectés voient les cartes non découvertes sous forme de cartes inconnues ; le bouton « Afficher le catalogue complet » permet de passer volontairement en aperçu. Sans connexion, le catalogue public reste consultable.

Les missions sont définies dans `src/game/missions.ts` : deux succès d’invocation existants, paliers de 10 et 50 modèles, trois invocations quotidiennes et 25 hebdomadaires. Les nouvelles récompenses sont des valeurs de lancement configurables dans ce module ; les coûts d’invocation, les taux et les récompenses des deux anciens succès restent inchangés. Les compteurs périodiques proviennent du journal serveur ; les claims sont atomiques et identifiés par période. Renouvellement quotidien à minuit UTC, hebdomadaire le lundi à minuit UTC. Aucun scheduler n’est nécessaire pour réinitialiser les périodes.

Les tests PostgreSQL isolés vérifient les claims concurrents, les récompenses Munny/tickets/fragments, les paliers permanents et l’exclusion des opérations des périodes passées. Les scénarios navigateur connectés restent des fixtures UI ; la validation OAuth réelle nécessite les identifiants Discord.

Rapport : [docs/assets/REPORT.md](docs/assets/REPORT.md). Commandes, preuves et limites : [docs/assets/WORKFLOW.md](docs/assets/WORKFLOW.md). `pnpm assets:check` vérifie les fichiers publiés ; `pnpm assets:test` vérifie l’optimisation WebP sur des fixtures en mémoire.

## Administration, calendrier et échanges

L’administration utilise des listes d’identifiants utilisateur Discord explicites, vides par défaut. Les ajustements de ressources et suspensions exigent un motif et sont journalisés de façon transactionnelle. Le calendrier distingue brouillons et événements publiés, avec protection contre les modifications simultanées. Il ne change aucune règle du jeu. Les échanges proposent une sélection par quantités et une recherche de joueur authentifiée.

Configuration, permissions, tests et limites : [docs/ADMINISTRATION.md](docs/ADMINISTRATION.md). Aucun rôle n’a été attribué et aucun événement créé dans la base habituelle pendant la recette. La connexion Discord réelle demeure à valider après configuration OAuth.
