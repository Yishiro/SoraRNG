# Passation SoraRNG

Préparée le 17 novembre 2026. Le dépôt contient l'application et ses ressources publiques, les migrations, les tests et le bot Discord. Les secrets, données de production et outils temporaires du dossier `.local` sont exclus.

## Prompt à copier dans Claude

```text
Tu reprends SoraRNG, mon jeu de collection Kingdom Hearts et son bot Discord.
Dépôt https://github.com/Yishiro/SoraRNG.git
Commence par lire CLAUDE.md, HANDOFF_CLAUDE.md et AGENTS.md, puis examine l'état Git et les sources concernées.
Conserve l'architecture et les données existantes. Travaille et communique en français.
Utilise les fichiers de configuration du code comme référence pour les règles actuelles. Plusieurs documents décrivent des états historiques.
Ne recrée pas le projet et ne réinitialise aucune donnée. Ne modifie pas les règles économiques ou les probabilités sans ma demande.
Préserve l'autorité serveur, les transactions et l'idempotence de toutes les opérations financières et des transferts.
N'affiche aucun secret. La base et les secrets du VPS ne sont pas dans GitHub.
Lis les instructions de déploiement avant toute intervention sur le serveur et vérifie son état réel.
Pour cette première prise en main, donne-moi un bref état du projet et attends ma prochaine demande de fonctionnalité.
```

## Fonctionnalités présentes

- Authentification Discord avec profil lié à l'identifiant Discord et sessions JWT de 30 jours.
- Catalogue de 150 modèles, cartes individuelles avec UUID, niveaux, éveil, finition holographique, découvertes permanentes, favoris et wishlist.
- Invocation avec cinq cartes par booster, animation d'ouverture et révélation obligatoire des cartes. Les boosters gratuits de démonstration ont été retirés du parcours public. Des constantes et rapports historiques peuvent encore les mentionner.
- Économie commune au bot et au site, bonus, banque avec intérêts de 2 % par jour, mini-jeux, dons, journal financier et protections contre le double débit.
- Marché et enchères de 24 heures, cartes séquestrées, mises réservées, remboursement lors de surenchère, livraison atomique, historique et prix moyens issus des ventes réelles.
- Notifications et réglage des messages privés, administration et journal financier staff, missions, profils publics et bannière des gros drops.
- Défis Discord toutes les 20 minutes, réponses surveillées pendant cinq minutes, premier gagnant récompensé. Configuration par commande sur le serveur.
- Derniers ajouts du 5 novembre, carnet de cinq mondes avec insignes de profil, vitrine ordonnée de cinq exemplaires et synchronisation avec `/vitrine`, échanges directs sur `/exchanges`, boosts temporaires en boutique.

## Paramètres actuels

Les références sont `src/game/config.ts`, `src/game/finance.ts` et `src/game/boosts.ts`.

| Paramètre                      | Valeur                                          |
| ------------------------------ | ----------------------------------------------- |
| Booster                        | 1 000 Munny, cinq cartes                        |
| Commun / Rare / Épique         | 90 % / 5,6 % / 2,8 %                            |
| Légendaire / Mythique / Secret | 1,2 % / 0,36 % / 0,04 %                         |
| Holographique indépendant      | 0,40 %                                          |
| Bonus horaire / quotidien      | 1 000 / 5 000 Munny                             |
| Bonus hebdomadaire / mensuel   | 5 000 / 10 000 Munny                            |
| Boost Rare                     | 1 500 Munny, Rare à 6,6 %, Commun à 89 %        |
| Boost holographique            | 1 000 Munny, holographique à 0,45 %             |
| Durée des boosts               | 30 minutes dès l'achat, un seul actif à la fois |
| Quêtes journalières            | 10 par jour (UTC), 250 à 1 000 Munny chacune    |
| Quêtes hebdomadaires           | 50 par semaine (lundi UTC), 500 à 2 000 Munny   |
| Saison mensuelle (UTC)         | Top 3 : 30 000 / 20 000 / 10 000 Munny          |
| Fusion                         | 1 doublon standard + 500 Munny × rang visé      |
| Rang de fusion                 | 10 maximum, 3 points de stats par rang          |

Les intérêts restent dans l'épargne. Les mises `all` utilisent le disponible et excluent l'épargne et les fonds réservés. Le catalogue JSON d'origine conserve ses métadonnées historiques, le serveur applique la configuration actuelle.

Ajouts du 17 novembre : quêtes (`src/game/quests.ts`), saisons et versement automatique du top 3 au premier accès du mois suivant (`src/server/seasons.ts`, table `SeasonSettlement`, première saison novembre 2026), fusion et statistiques PV, Attaque, Défense, Vitesse pour le futur PvP (`src/game/stats.ts`), succès sans récompense (`src/game/achievements.ts`), alertes de liste de souhaits sur le site lors d'une mise en vente, comparateur de collections sur les profils, pages Classements et Événements ouvertes avec un fil d'activité.

## Carte du code

- `app/` contient les routes Next.js et API. `src/components/` contient les interfaces.
- `src/game/` contient les règles et fonctions communes. `worlds.ts`, `showcase.ts` et `boosts.ts` couvrent les derniers ajouts.
- `src/server/` contient les accès PostgreSQL et transactions. Examiner `game.ts`, `trades.ts`, `auctions.ts`, `finance.ts`, `wallet-audit.ts` et `auth.ts` selon l'intervention.
- `bot/` contient les commandes et événements Discord. `collector.ts` contient notamment la vitrine.
- `prisma/` contient schéma et migrations, `scripts/` les outils et recettes d'intégration, `tests/` les tests unitaires et navigateur.
- `card-assets.json` conserve les sources et statuts des illustrations. Les droits de nombreuses illustrations publiées à la demande du propriétaire restent non vérifiés. Aucune autorisation des ayants droit n'est attestée par cette demande.

Les mutations verrouillent le joueur et journalisent le résultat dans la même transaction. Les échanges utilisent deux confirmations et une révision d'offre. Les exemplaires sont revérifiés au transfert. Une modification de lot réinitialise les accords. Les schémas d'intégration sont temporaires et doivent être supprimés après test.

## Installation sur une nouvelle machine

Installer Git, Node.js 24, pnpm 11.25.0 et Docker avec Compose pour PostgreSQL.

```sh
git clone https://github.com/Yishiro/SoraRNG.git
cd SoraRNG
pnpm install --frozen-lockfile
pnpm env:init
pnpm db:up
pnpm db:generate
pnpm db:deploy
pnpm catalog:import
pnpm dev
```

`pnpm env:init` crée uniquement un `.env` absent et refuse d'écraser un environnement existant. Renseigner les identifiants Discord localement via un canal privé. Le callback local est `http://localhost:3000/api/auth/callback/discord`. Les noms de variables sont dans `.env.example` et `deploy/production.env.example`.

Le site, le bot et PostgreSQL sont trois processus distincts. Démarrer le bot localement avec `pnpm bot:dev` exige son token et peut interagir avec l'application Discord réelle. Vérifier la configuration avant ce lancement.

## Vérifications et preuves disponibles

La dernière recette du 5 novembre a réussi avec 91 tests unitaires, TypeScript, ESLint, Prettier, build de production et tests PostgreSQL isolés pour achats, expiration et non-cumul des boosts, vitrine et échanges. Sept tests navigateur ciblés ont passé sur l'origine publique, avec mutations UI interceptées et protections d'API réelles. Ils ne prouvent pas des transactions entre deux comptes Discord humains. Ces résultats sont historiques et doivent être actualisés après modification.

```sh
pnpm check
pnpm build
pnpm test:integration
pnpm test:auth
pnpm test:e2e
```

Les intégrations exigent un PostgreSQL de test et les permissions de création de schéma. Lire chaque script avant lancement. D'autres recettes ciblées sont disponibles dans `scripts/test-*.ts`. Les configurations publiques temporaires sous `.local` ne sont pas distribuées, la configuration Playwright versionnée sert au parcours local.

## Production et déploiement

- Origine publique connue `https://sorarng.54-37-13-70.sslip.io`.
- SSH `ubuntu@54.37.13.70`, dossier `/home/ubuntu/sorarng`. L'accès exige une clé autorisée fournie séparément. La clé du poste Windows n'est pas transférée par Git.
- Secrets conservés sur le VPS dans `.env.production` et `.env.bot` avec permissions privées.
- Compose web `compose.production.yaml`, Compose bot `compose.bot.production.yaml`. Projet Compose `sorarng`, base PostgreSQL 17 persistante, web derrière Nginx sur `127.0.0.1:3010`.
- Tags déployés le 18 novembre : web et maintenance `20261118-refonte04` (construits sur le VPS dans `releases/refonte04/`, à partir de l'image précédente), bot inchangé `20261105-worlds`. Retour arrière possible vers `20261118-refonte03`, sans migration à défaire. Vérifier les conteneurs et tags actuels avant action.
- Sauvegarde automatique chaque jour à 4 h (Paris) par `sorarng-backup.timer`, rétention de deux jours. Lancer `sudo systemctl start sorarng-backup.service` avant une migration ou une opération risquée. Les dumps antérieurs au 17 novembre sont dans `backups/archive-avant-retention/`. Docker exige `sudo` pour l'utilisateur `ubuntu`.

Le `Dockerfile` versionné permet les cibles `tools`, `production` et `discord-bot`. Construire des images portant un nouveau tag, puis mettre à jour uniquement `SORA_IMAGE_TAG` et `SORA_BOT_IMAGE_TAG` dans les fichiers privés existants. Préserver toutes les autres valeurs et garder les anciennes images pour retour arrière. Consulter `DEPLOYMENT.md` et `BOT_SETUP.md` pour les procédures détaillées.

```sh
docker compose --env-file .env.production -f compose.production.yaml up -d --no-deps app
docker compose --env-file .env.production --env-file .env.bot -f compose.bot.production.yaml up -d --no-deps bot
```

Les commandes ci-dessus supposent que les images et variables sont déjà préparées. Elles ne construisent pas les images et n'appliquent pas les migrations. Ne jamais supprimer les volumes ni lancer une réinitialisation de base. Les derniers ajouts ne nécessitent pas de nouvelle migration. Vérifier ensuite santé, routes publiques et erreurs, sans exposer de secrets ni envoyer de messages Discord de test aux membres.

## Limites de cette passation

GitHub transfère le code et les ressources publiques. Il ne transfère pas les comptes, soldes, inventaires ou historique de production, qui restent dans PostgreSQL sur le VPS. Les conversations Codex et les outils temporaires ne sont pas importés dans Claude. Ce document en fournit le contexte exploitable.

`PROGRESS.md`, `README.md`, `ARCHITECTURE.md` et les rapports JSON contiennent des états anciens, dont des taux, sessions, bonus ou commandes remplacés depuis. En cas de divergence, examiner le code actuel et les dernières sections datées de progression. L'état du serveur n'a pas été réaudité pour cette seule passation.
