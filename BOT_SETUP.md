# Bot Discord SoraRNG

Le bot est un processus distinct du site. Il utilise le même catalogue et les profils associés aux identifiants Discord, avec un portefeuille Munny partagé. Il ne crée pas de joueur : une première connexion Discord au site reste nécessaire. Les opérations financières sont transactionnelles et journalisées.

## Commandes

- `/play` : lien vers les boosters, ouverts avec des Munny ou un ticket après connexion Discord. Les boosters gratuits et la démonstration ont été retirés.
- `/profile` : ressources, invocations et progression du Codex du compte qui exécute la commande.
- `/collection` : exemplaires, modèles présents et holographiques du compte.
- `/leaderboard` : rubrique en construction, comme sur le site.
- `/help` : aide et liens.

Les résultats et révélations de tous les jeux (`double`, `roulette`, `guess`, `coinflip`, `duel-des`) sont visibles dans le salon, y compris les essais et abandons de Guess Number. Les défis modifient leur message public ; leur accusé de réception peut rester privé. `/collection` est également public. Les réponses de banque, bonus, solde et les confirmations de dons restent éphémères. Les mentions sont désactivées. Les comptes suspendus ne peuvent pas lire leur profil via le bot. Un compte absent reçoit un lien de connexion au site ; aucun profil n’est créé par le bot.

## Configuration locale

Variables du fichier privé `.env` (ignoré par Git et Docker) : `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_SITE_URL` et `DATABASE_URL`. `DISCORD_GUILD_ID` est facultatif pour enregistrer les commandes dans un serveur de test ; sans cette variable, elles sont globales. Les secrets OAuth du site sont distincts du token du bot.

```powershell
pnpm bot:check
pnpm exec tsx --env-file=.env bot/verify.ts
pnpm exec tsx --env-file=.env bot/register.ts
pnpm bot:dev
```

L’enregistrement est volontairement séparé du démarrage. Il ajoute ou actualise les dix-neuf commandes SoraRNG et supprime explicitement les anciennes commandes `cf` et `partie`, sans effacer les commandes étrangères. La vérification compare l’application et le token sans afficher celui-ci.

## Installation Discord

[Lien d’ajout du bot](https://discord.com/oauth2/authorize?client_id=1565274940100452383&scope=bot%20applications.commands&permissions=0)

Le bot utilise `Guilds`, et ajoute `GuildMessages` et `MessageContent` si l’application autorise la lecture des réponses aux défis. Activer « Message Content Intent » dans Developer Portal → Bot → Privileged Gateway Intents avant de redémarrer le bot. L’absence de cet accès laisse les autres commandes disponibles et bloque explicitement l’activation des défis. Aucun accès à la liste complète des membres n’est requis. Le rôle Administrateur n’est pas nécessaire pour le bot : le salon des défis doit lui accorder Voir le salon, Envoyer des messages, Intégrer des liens et Lire l’historique. Les commandes globales peuvent demander un délai avant d’apparaître dans Discord.

## Défis automatiques et crédits administrateur

La banque active est `bot/challenge-bank.json` : 100 noms/mots Kingdom Hearts et 100 questions approuvés par le propriétaire. Questions et réponses proviennent du catalogue de relecture, avec références officielles/communautaires conservées. Copie et inversion utilisent désormais ces noms (casse et accents exacts) ; anagrammes et trous utilisent leurs lettres sans séparateurs ni accents et acceptent toutes les solutions compatibles de la banque. Les questions ignorent la casse et les accents, avec les variantes de réponses prévues. Les défis déjà publiés conservent leur énoncé et réponse persistés.

- `/defi-maintenant` : envoi ponctuel dans le salon déjà configuré, réservé à Gérer le serveur. Fonctionne même si les annonces automatiques sont en pause, sans les réactiver ni modifier leur prochain horaire. Refus si un défi est déjà actif ; rejouer la même interaction ne publie pas deux défis. Récompense habituelle de 250 Munny et expiration après cinq minutes.

- `/defis salon:#general minutes:20 actif:true` : un administrateur ou membre disposant de Gérer le serveur choisit le salon. Première annonce après 20 minutes, puis cadence persistante ; pas de rattrapage des périodes manquées. `/defis actif:false` suspend les nouvelles annonces ; un défi déjà publié conserve ses cinq minutes. Une configuration par serveur.
- Cinq formats aléatoires : question, code à recopier, code à inverser, mot mélangé, mot à trous. La première bonne réponse reçue et validée gagne exactement 250 Munny sur le portefeuille commun. Les codes respectent les majuscules ; les mots et questions tolèrent casse et accents. Bots, webhooks, messages anciens et joueurs sans profil ou suspendus ne gagnent pas. Aucun profil créé automatiquement. Aucun message ordinaire n’est conservé ; seule la réponse gagnante figure dans le journal financier.
- Un défi expire après cinq minutes. Sa configuration, sa réponse attendue et son gagnant sont persistants. Verrous PostgreSQL et paiement idempotent empêchent le double gain. L’annonce publique est modifiée pour montrer le gagnant, ou la solution après expiration. Les publications et annonces de fin échouées sont réessayées ; nonce Discord pour limiter les doublons après interruption.

Recette : `pnpm exec tsx --env-file=.env scripts/test-chat-challenges.ts` vérifie la cadence, la concurrence et la reprise sur un schéma PostgreSQL isolé avec Discord simulé. Elle ne publie rien dans les serveurs réels.

## VPS

Image dédiée : `docker build --target discord-bot -t sorarng-bot:20261029-economy01 .`. Le dernier étage par défaut du Dockerfile reste celui du site.

Le fichier `compose.bot.production.yaml` gère seulement le service `bot` et rejoint le réseau existant `sorarng_default`. Il n’expose aucun port. Le fichier privé `/home/ubuntu/sorarng/.env.bot` (mode 600) contient le token, l’identifiant d’application et `SORA_BOT_IMAGE_TAG`. Les paramètres de base et l’URL publique proviennent du fichier `.env.production` existant, dont les secrets OAuth ne sont pas passés au bot.

```sh
cd /home/ubuntu/sorarng
docker compose --env-file .env.production --env-file .env.bot -f compose.bot.production.yaml config --quiet
docker compose --env-file .env.production --env-file .env.bot -f compose.bot.production.yaml up -d --no-deps bot
```

Le service tourne sous l’utilisateur `node`, sans capacités Linux, avec système de fichiers en lecture seule, `/tmp` temporaire et redémarrage automatique. La santé combine la connexion Discord et une lecture SQL. Les sessions PostgreSQL permettent les transactions financières et imposent un délai de requête de cinq secondes. Les écritures utilisent les mêmes verrous de joueurs que le site, avec un journal idempotent et des mises réservées persistantes. Aucun détail d’erreur Discord, token ou URL SQL n’est écrit dans les journaux.

Pour remplacer le token, mettre à jour la valeur privée dans `.env.bot`, puis recréer uniquement le service `bot`. Ne pas afficher le fichier dans les logs et ne pas copier le token dans les tickets ou descriptions de changements.

## Économie partagée

- `/double mise` : tirage cryptographique uniforme entre deux issues. Victoire : total reçu égal à deux fois la mise ; défaite : mise perdue. Résultat persistant avant la révélation animée et idempotence des interactions. Exemple : `/double mise:all`.
- Toutes les commandes de mise acceptent `all` ou `tout`, sans distinction de casse et avec espaces autour tolérés. Cela utilise tout le disponible, sans retirer l’épargne ni reprendre les mises déjà réservées. Sur un défi, `all` fixe la mise du proposant ; le destinataire doit disposer du même montant à l’acceptation.

- `/don membre montant` : confirmation privée valable cinq minutes. Le montant est fixé lors de la confirmation ; le transfert est atomique et idempotent, sans frais. Aucun transfert vers soi-même, un bot ou un profil absent/suspendu. `tout` utilise le disponible au moment de la proposition et le solde est revérifié à la validation.
- Les résultats de roulette, Guess Number, coinflip et dés passent par une courte séquence de révélation. Le résultat financier est enregistré avant l’animation ; un échec d’affichage n’annule ni ne rejoue la transaction.
- Le profil public `/profile/<identifiant Discord>` expose progression, vitrine des favoris et wishlist, sans soldes. La wishlist se gère dans le Codex sur le site ; ajout/retrait persistant sur le compte, liste publique sur le profil.

- `/solde [pseudo]` : disponible, épargne et mises réservées du membre sélectionné ; sans option, votre propre compte. Les délais de bonus restent visibles uniquement pour votre compte.
- `/hourly`, `/daily`, `/weekly`, `/monthly` : respectivement 1 000 / 5 000 / 20 000 / 30 000 Munny, avec délais glissants de 1 h / 24 h / 7 jours / 30 jours. Les quatre bonus se cumulent ; les périodes manquées ne s’accumulent pas. Le quotidien est commun avec celui du site et conserve ses 10 fragments.
- `/banque solde`, `/banque deposer`, `/banque retirer` : transferts immédiats sans frais. L’épargne produit 2 % par jour composés au prorata du temps, y compris hors connexion. Les intérêts restent à la banque ; précision interne au millionième de Munny, retraits entiers.
- `/roulette` : rouge, noir, vert ou numéro 0–36. Résultat immédiat et persistant.
- `/guess` : nombre secret fixé entre 1 et 100, cinq essais avec indices plus haut / plus bas ; relancer `/guess` avec une mise reprend la partie existante sans nouveau débit. Abandon clôture sans remboursement.
- `/coinflip` et `/duel-des` : défi à un membre, mises égales. Seul le membre invité accepte. Annulation ou expiration après deux minutes rembourse la mise réservée ; égalité aux dés rembourse les deux joueurs. Les boutons du message servent à accepter et annuler.
- Les mises n’ont aucun plafond commercial ; `tout` ou `all` utilise le disponible. Les limites techniques des entiers exacts restent contrôlées.

Les probabilités et gains potentiels ne sont pas affichés avant les paris, selon le choix du propriétaire. Les résultats effectifs et les montants réellement versés sont affichés après résolution. Paramètres internes : roulette à zéro unique, retour total 2× pour rouge/noir ou 36× pour zéro/numéro ; Guess trouvé 3× ; défi gagné 2×. Aucun argent réel ni achat de Munny n’est introduit.

Le tableau « Munny & banque » de l’Accueil permet également les quatre bonus et les transferts bancaires. Le site recharge le portefeuille toutes les quinze secondes lorsqu’il est visible et au retour sur l’onglet.

Validation locale : `pnpm exec tsx --env-file=.env scripts/test-finance.ts` utilise un schéma PostgreSQL isolé supprimé après les essais. Ce test et les fixtures navigateur ne remplacent pas une recette humaine des commandes Discord.

### Solde public (3 novembre 2026)

`/solde pseudo:@membre` affiche dans le salon le portefeuille disponible, l’épargne (avec intérêts à l’instant de consultation) et les mises réservées du compte choisi. Sans option, la commande affiche le compte de son auteur. Le message est public ; les transferts `/banque` et les bonus restent privés. Aucune création de profil ni modification de portefeuille n’est nécessaire pour consulter le solde.

## Commandes de collection (3 novembre 2026)

- `/carte nom:` : choix par autocomplétion du nom, de la version et de l’identifiant KH-xxx ; illustration déjà publiée sur le site, légende originale du catalogue et moyennes standard/holographique des ventes finalisées. Aucun prix inventé sans historique.
- `/collection pseudo:@membre page:` : collection partageable d’un membre (soi-même par défaut), dix modèles par page, quantités et holographiques. Aucune ressource financière, clé de session ou préférence privée n’est publiée.
- `/wishlist afficher page:`, `/wishlist ajouter carte:`, `/wishlist retirer carte:` : consultation et édition privées de la wishlist commune au site. Écritures liées à l’auteur de l’interaction, verrouillées et idempotentes, sans création de compte ni changement de Munny.
- `/marche carte: page:` : enchères actuellement ouvertes, filtre sur la version exacte, dix annonces par page et accès au marché du site.
- `/ventes page:` : ventes et enchères du joueur uniquement, en privé, avec prix et état.
- `/historique` : dix derniers mouvements financiers du joueur uniquement, en privé, avec disponible avant/après et épargne/réserves lorsqu’elles ont été enregistrées. Complément par l’ancien historique antérieur au nouveau journal, avec ses limites indiquées.
- `/bonus` : les quatre bonus, leur montant et leur disponibilité, en privé. La consultation ne réclame aucun bonus.
- `/vitrine` : partage public des cinq premières cartes marquées comme favorites dans la collection du site, avec leur finition, niveau et éveil réels. Le bouton mène au profil public.

`/carte`, `/collection`, `/marche` et `/vitrine` sont publics ; `/wishlist`, `/ventes`, `/historique` et `/bonus` sont éphémères. Les cartes ayant plusieurs versions ne sont jamais sélectionnées au hasard : utiliser les suggestions ou l’identifiant précis.
