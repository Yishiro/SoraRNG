# État des lieux SoraRNG — 17 novembre 2026

Branche de travail `refonte/etat-des-lieux`. Aucune donnée de joueur, règle économique, probabilité ou entrée du catalogue n'est modifiée. Rien n'est déployé.

## Méthode

- Lecture de `CLAUDE.md`, `HANDOFF_CLAUDE.md`, `AGENTS.md` et du code serveur (`src/server/game.ts`, `trades.ts`, `finance.ts`, `auctions.ts`).
- `pnpm check` et `pnpm audit`.
- Captures des 14 sections à 1280 px et 375 px avec des réponses d'API simulées (script local dans `.local/audit/`, non versionné). Le PostgreSQL local n'était pas disponible (Docker Desktop arrêté), donc les intégrations n'ont pas été rejouées.

## Ce qui va bien

- Le serveur est solide : verrou `FOR UPDATE` sur le joueur, clés d'idempotence vérifiées avec comparaison de la requête, journal dans la même transaction, cartes séquestrées retirées de l'inventaire pendant les enchères, échanges revérifiés au transfert.
- 91 tests unitaires, TypeScript, ESLint et Prettier au vert.
- Aucune page ne déborde horizontalement à 375 px. Aucune erreur JavaScript avec des données valides.

## Défauts classés du plus important au moins important

| #   | Domaine         | Constat                                                                                                                                                                                                                  | Correction                                                                                                                                                                              |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sécurité        | Next.js 16.4.3 touché par deux avis (fuite de cache entre paramètres racine, GHSA-mfr8-8qww-v76h et GHSA-vc7v-qv4w-wrv8).                                                                                                | Passage à 16.4.5, version corrigée publiée il y a deux semaines.                                                                                                                        |
| 2   | Lisibilité      | Plus de 230 déclarations de police entre 5 et 9 px et 77 à 11 px. Boutons secondaires en 10-11 px, sous le seuil confortable.                                                                                            | Plancher typographique : 11 px pour l'interface, 12-13 px pour les boutons, 10 px dans les cartes. Les inscriptions décoratives du sachet ne changent pas.                              |
| 3   | Cartes visibles | Sur Ma collection et Progression, la première carte apparaît à environ 860 px de haut sur ordinateur et après deux écrans sur mobile : en-tête, accroche, quatre compteurs, deux rangées de filtres et une note.         | En-tête resserré, compteurs compacts, filtres avancés repliés par défaut.                                                                                                               |
| 4   | Navigation      | La barre latérale ne défile pas : sous environ 920 px de hauteur de fenêtre, son pied de page sort du panneau.                                                                                                           | Défilement vertical interne.                                                                                                                                                            |
| 5   | Navigation      | Icônes en double : Marché et Échanges directs partagent la même icône, Ma collection et Carnet des mondes aussi.                                                                                                         | Icônes distinctes (marteau d'enchère, poignée de main, carte du monde).                                                                                                                 |
| 6   | Journal         | Le journal d'aventure affiche les codes techniques (`summon`, `daily`, `admin.adjust`) et des montants non formatés (`-1000 Munny`).                                                                                     | Libellés français partagés avec le journal staff et format `−1 000 Munny`.                                                                                                              |
| 7   | Robustesse      | Les widgets lisent la réponse d'API sans contrôler sa forme. Une réponse inattendue de `/api/recent-drops` fait planter toute la page. Même risque sur les classements et les événements.                                | Garde sur le type tableau avant l'affichage.                                                                                                                                            |
| 8   | Hiérarchie      | Chaque page répète un fil d'Ariane, un sur-titre « COLLECTION / … » et la mention « 150 CARTES / ÉDITION 01 ». L'accueil empile deux grands titres (« Votre collection. » puis « Prêt pour la prochaine découverte ? »). | Sur-titre et mention répétitive retirés. Sur l'accueil et Boosters, un seul titre de page. Titres en Arial au lieu de Georgia.                                                          |
| 9   | Boutons         | Trois styles de bouton côte à côte sur l'accueil (argent plein, contour, lien) avec des tailles de texte différentes.                                                                                                    | Une seule échelle de boutons.                                                                                                                                                           |
| 10  | Boutique        | Les boosts temporaires sont de simples lignes de texte alors que tickets et fragments sont des cartes.                                                                                                                   | Une seule grille de tuiles pour tickets, fragments et boosts. Les prix affichés viennent de `src/game/config.ts` au lieu d'être recopiés en dur, et les achats impossibles sont grisés. |

Écarté après vérification : le sachet de booster semblait presque invisible sur une première capture prise pendant son animation d'entrée. Une fois l'animation terminée, il est bien lisible.

## Vérifications après corrections

- `pnpm check` : TypeScript, ESLint, Prettier et 94 tests unitaires au vert (3 nouveaux pour les libellés du journal).
- Playwright complet sur le serveur de développement : 39 réussis, 14 en échec. Les 14 mêmes échouent sur le code d'origine, car ils exigent PostgreSQL et le catalogue importé (authentification réelle, catalogue, ouverture de sachets). Aucune régression.
- Captures des 14 sections à 1280 et 375 px : aucun débordement horizontal, aucune erreur JavaScript.
- `pnpm build` : build de production réussi.
- Non vérifié : intégrations PostgreSQL (`pnpm test:integration`) et bot Discord.

## Deuxième passe (même jour)

- Sauvegarde quotidienne à 4 h (Paris) par `sorarng-backup.timer`. Rétention de deux jours, toujours au moins les deux derniers dumps. Les 33 dumps antérieurs sont déplacés dans `backups/archive-avant-retention/`.
- Classement public : les joueurs suspendus en sont exclus.
- CI GitHub (`.github/workflows/ci.yml`) : contrôles, build, intégrations PostgreSQL et Playwright. Elle ne tournera qu'une fois la branche poussée sur GitHub.
- 196 règles CSS mortes supprimées (environ 1 000 lignes). Les captures des 28 écrans sont identiques avant et après, au pixel près, hors horodatages et animations.
- `game.tsx` passe de 1 476 à environ 1 240 lignes. Six sections deviennent des composants.
- Accueil : les cinq dernières cartes obtenues. Collection mobile : barre de filtres compacte et collée sous l'en-tête.
- Constantes des boosters gratuits retirées. `minimatch` corrigé par une surcharge pnpm vers 11.0.4.
- VPS : 22 scripts `update-*.py` et 9 archives `.tar.gz` rangés dans `archive/`, rien n'est supprimé.

## Points qui restent à décider par le propriétaire

- Rotation des secrets Discord partagés dans un ancien chat.
- Droits des illustrations encore non vérifiés dans `card-assets.json`.
- `picomatch` reste signalé par `pnpm audit` : aucune version corrigée n'existe encore. Il ne sert qu'aux outils de développement (Vite, ESLint).
- Next.js 16.4.6 : à adopter après le 23 novembre, quand elle aura deux semaines. La 16.4.5 couvre déjà les avis connus.
- Copie externe des sauvegardes : elles restent sur le même VPS.
- Anciennes images Docker SoraRNG (environ 8 Go) : conservées pour un retour arrière, à supprimer sur demande.
