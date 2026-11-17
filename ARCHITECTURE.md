# Architecture actuelle

## Organisation conservée

Le projet Next.js existant n’a pas été recréé ou déplacé dans un monorepo. `app/` contient les routes web et HTTP ; `src/components/` les vues interactives ; `src/game/` les types, règles et configuration ; `src/server/` les accès PostgreSQL, sessions et transactions ; `bot/` le bot Discord ; `prisma/` le schéma et les migrations ; `scripts/` l’import et les tests d’intégration.

## Autorité serveur

Le navigateur demande une action, jamais un résultat RNG. `crypto.randomInt` choisit séparément rareté, modèle à poids égal parmi la rareté, puis finition. Les taux standard sont 5 000/2 800/1 400/600/180/20 sur 10 000, holographique 200 sur 10 000. Aucun pity, garantie ×10 ni bonus.

`src/game/config.ts` centralise les paramètres de lancement ; les gains quotidiens, coûts d’amélioration et de fragments sont des valeurs initiales configurables, à équilibrer. Les probabilités individuelles viennent du nombre réel de modèles éligibles ; aucune liste de taux par carte n’est codée dans le frontend. Les résultats d’invocation conservent la version des taux et l’empreinte du catalogue utilisé.

## Persistance et concurrence

- `Player` : identité Discord unique et état JSONB (ressources, exemplaires, découvertes permanentes, préférences).
- `Catalogue` : catalogue actif, empreinte de version.
- `Operation` : clé d’idempotence unique par joueur, résultat persisté et variation de Munny.
- `Trade` : membres, offres constituées d’exemplaires précis, révision, validations, expiration et état.

Une mutation verrouille la ligne du joueur (`SELECT FOR UPDATE`) et écrit état et journal dans une transaction. La même clé rejoue le résultat de la première action de même type et avec les mêmes paramètres ; une réutilisation différente est refusée. Toute erreur annule le débit, les consommations et la création de cartes. Les soldes ne sont jamais acceptés du navigateur.

Une limitation PostgreSQL borne les lectures privées à 120/minute, les mutations à 60/minute et les écritures d’échange à 30/minute par joueur. Les échecs métier sont comptabilisés. Les routes publiques nécessitent une protection réseau complémentaire.

Un échange verrouille d’abord sa propre ligne. Au transfert, les deux joueurs sont verrouillés dans l’ordre de leurs identifiants afin de limiter les interblocages. La propriété et l’état de chaque exemplaire sont revérifiés. Une carte utilisée ou modifiée ailleurs fait échouer le transfert. Les cartes ne sont pas réservées pendant la négociation : la validation finale est l’autorité. Une nouvelle offre annule verrouillages et confirmations. Une offre périmée ne peut être validée via une ancienne révision.

Les piles sont uniquement visuelles ; chaque exemplaire a un UUID. Holographique, niveau, éveil, favori et verrou différencient les piles. Une amélioration ne modifie qu’un exemplaire. Les matériaux alternatifs d’éveil ne changent jamais la finition.

## Authentification et limites

Le Codex utilise `src/game/collection.ts` pour réunir les découvertes permanentes et les exemplaires présents, sans déduire qu’un modèle recyclé doit redevenir inconnu. Le Codex global inclut toutes les finitions ; le sous-Codex holographique ne compte que les découvertes holographiques. Les modèles inconnus sont masqués dans la vue personnelle ; la consultation volontaire du catalogue reste publique.

`src/game/missions.ts` définit les objectifs et récompenses, les frontières de périodes UTC et les clés de récupération. `src/server/missions.ts` compte les cartes réellement attribuées à partir des résultats persistés de `Operation` : cinq par booster depuis la demande du 29 octobre, cinquante pour dix boosters ; les anciennes opérations gardent leur nombre historique de cartes. La récupération est recalculée sous le verrou du joueur ; progression, solde et état de récupération ne sont jamais fournis par le navigateur. Les anciennes clés `first` et `ten` sont conservées. Les succès de collection sont permanents ; les missions récurrentes utilisent une clé contenant le début de leur période.

NextAuth conserve une session JWT signée, durée maximale 24 h. Le seul provider est Discord, activé après configuration, avec scope `identify`. Le compte jeu est identifié par `providerAccountId`, jamais par une adresse ou un nom fourni par le client. Les routes privées vérifient cette session et les mutations imposent une origine identique. Le bot n’utilise aucun self-bot.

Limites : pas encore de révocation centralisée de session, rôles d’administration ou système de confidentialité. Le journal financier détaille les variations Munny ainsi que les soldes avant/après de Munny, tickets et fragments. Le JSONB par joueur convient au premier socle transactionnel ; normaliser exemplaires, ressources et découvertes avant d’envisager un inventaire très volumineux et une forte concurrence. Aucun test de charge ne valide actuellement la montée en charge.

Le guide historique `docs/ARCHITECTURE.md` décrit le socle initial ; ce document représente le travail actuel. Aucun combat PvE ou PvP n’est implémenté.
