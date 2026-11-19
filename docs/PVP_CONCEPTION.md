# Combats PvP — conception

État au 19 novembre 2026. Le moteur de combat (`src/game/battle/`) et l'arène asynchrone (page `/arena`, `src/server/arena.ts`, `app/api/arena`) sont écrits et testés. Restent les duels en direct avec mise et les commandes du bot.

## Décisions du propriétaire

| Sujet       | Choix                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Format      | Tour par tour à la manière des jeux de monstres : chaque carte a ses attaques et un élément, avec forces et faiblesses |
| Adversaires | Arène asynchrone (on attaque l'équipe de défense d'un absent) et duels directs entre deux joueurs présents             |
| Récompenses | Classement sans mise en arène, plus mise facultative en Munny sur les duels directs                                    |
| Équilibrage | Ligues par puissance d'équipe, sans limite de composition                                                              |

Le système reprend ces mécaniques de genre, avec un univers propre : éléments tirés des affinités du catalogue, noms d'attaques originaux, aucune reprise de noms, de table ou de visuels d'un jeu existant.

## Éléments

Les 17 affinités du catalogue sont regroupées en 9 éléments (`elements.ts`).

| Élément  | Affinités                                  | Très efficace contre (×2) | Peu efficace contre (×0,5) |
| -------- | ------------------------------------------ | ------------------------- | -------------------------- |
| Lumière  | Lumière                                    | Ténèbres, Néant           | Lumière                    |
| Ténèbres | Ténèbres                                   | Lumière, Arcane           | Ténèbres                   |
| Néant    | Néant                                      | Neutre, Foudre            | Lumière, Néant             |
| Feu      | Feu                                        | Nature                    | Eau, Feu                   |
| Eau      | Eau, Glace                                 | Feu                       | Nature, Eau                |
| Foudre   | Foudre                                     | Eau                       | Nature, Foudre             |
| Nature   | Terre, Vent, Fleur                         | Eau, Foudre               | Feu                        |
| Arcane   | Magie, Rêve, Illusion, Temps, Espace, Lune | Néant, Feu                | Arcane                     |
| Neutre   | Neutre                                     | —                         | —                          |

Chaque élément sauf Neutre a au moins une force et une faiblesse (vérifié par test).

## Attaques

Chaque carte combattante reçoit 4 attaques, déduites de son élément et de son rôle (`moves.ts`) :

1. attaque élémentaire (puissance 80, précision 100 %) ;
2. attaque de rôle : élémentaire lourde 95/85 % (Attaquant, Mage), Riposte (Défenseur), Coup éclair prioritaire (Agile), Assaut (Polyvalent, Collection), Soin 50 % (Soutien) ;
3. soutien de rôle : Concentration, Aura, Garde, Hâte, Préparation (boosts), Entrave, Intimidation (baisse adverse) ;
4. Frappe (Neutre, 50, 100 %).

Les 21 objets (rôle « Objet ») ne combattent pas. 129 cartes peuvent combattre.

## Règles du combat (`engine.ts`)

- Équipes de 1 à 3 cartes, une active de chaque côté.
- À chaque tour, chaque joueur choisit une attaque ou un changement de carte.
- Ordre : changements d'abord, puis priorité de l'attaque, puis Vitesse (égalité tranchée au hasard).
- Dégâts : puissance × 0,25 × (Attaque / Défense) × échelle de rareté du défenseur × efficacité × 1,25 si l'attaque est de l'élément de la carte × aléa 0,85–1 × 1,5 en cas de coup critique (1 chance sur 16). Minimum 1.
- Modificateurs de stats de −3 à +3, remis à zéro quand la carte quitte le terrain.
- Une carte K.O. est remplacée avant le tour suivant, sans perdre de tour.
- Victoire quand l'autre équipe n'a plus de carte debout ; au-delà de 60 tours, la part de PV restante départage.
- Les statistiques viennent de `copyStats` : rareté, niveau, éveil, finition holographique et points de fusion.
- Le moteur est pur et déterministe : une graine par combat et un compteur de tirages. Le serveur peut rejouer et vérifier chaque tour, et le replay est exact.

L'IA de défense (`ai.ts`) achève l'adversaire si possible, se soigne sous 40 % de PV, change de carte face à un net désavantage d'élément et se renforce une fois en début de duel.

## Mesures (simulations IA contre IA, niveau 10)

| Mesure                                           | Résultat                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Coups pour un K.O. en miroir, médiane par rareté | Commun 4,6 · Rare 4,8 · Épique 5,5 · Légendaire 5,9 · Mythique 6,0 · Secret 4,8       |
| Combat miroir, même équipe des deux côtés        | 50 % / 50 % (aucun biais de côté)                                                     |
| Durée moyenne d'un combat entre communs          | 16 tours                                                                              |
| Rare contre Commun                               | 98 % pour Rare                                                                        |
| Puissance d'équipe (3 cartes, niveau 10)         | Commun 627 · Rare 757 · Épique 887 · Légendaire 1 052 · Mythique 1 182 · Secret 1 316 |

L'écart entre raretés est net, parce que les statistiques de base des cartes rares sont plus élevées. Les ligues par puissance en tiennent compte : on n'affronte en arène que des équipes de puissance proche.

À surveiller : les équipes riches en cartes Soutien infligent moins de dégâts et gagnent moins souvent. C'est à équilibrer une fois le jeu en main.

## Reste à construire

1. **Base de données** : équipe de défense par joueur, combats (état, actions, graine), classement (points, ligue), mises bloquées en séquestre.
2. **Serveur** : actions de combat dans la transaction habituelle (verrou, idempotence), arène (choix d'un adversaire de puissance proche, IA côté défense), duels directs (invitation, choix simultané des actions à chaque tour, délai par tour, abandon).
3. **Interface** : composition d'équipe, écran de combat (choix d'attaque, barres de PV, journal), replay, classement et ligues.
4. **Bot** : `/arene`, `/duel-cartes`, `/equipe`, classement.
5. **Tests** : intégrations PostgreSQL (mises, abandon, double action, concurrence), tests navigateur.

## Règles fixées le 19 novembre (`rules.ts`)

| Sujet           | Règle                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mises des duels | 100 à 10 000 Munny, identiques des deux côtés, en séquestre ; le gagnant reçoit les deux mises, sans commission ; match nul : chacun récupère la sienne                                                     |
| Ligues          | Bronze < 700 · Argent 700–899 · Or 900–1 099 · Platine ≥ 1 100 (puissance de l'équipe) ; l'arène propose des adversaires de la même ligue                                                                   |
| Classement      | Elo, départ 1 000, K = 40 (± 20 points entre égaux), plancher 100 ; l'attaquant et le défenseur bougent tous les deux                                                                                       |
| Arène           | 10 attaques par jour ; défendre ne coûte rien                                                                                                                                                               |
| Duels en direct | 60 s par tour ; délai dépassé : l'IA joue à la place du joueur ; au 3e délai, défaite par abandon                                                                                                           |
| Abandon         | Abandonner ou dépasser 3 fois le délai donne la victoire et les deux mises à l'adversaire ; invitation non acceptée sous 10 min : annulée, mise rendue                                                      |
| Récompenses     | Chaque mois, dans chacune des 4 ligues : 15 000 / 10 000 / 5 000 Munny au top 3 (120 000 Munny au plus par mois)                                                                                            |
| Équipes         | 1 à 3 cartes ; plusieurs exemplaires du même modèle autorisés ; une carte aux enchères (hors de l'inventaire) ou proposée dans un échange en cours ne peut pas combattre ; les cartes en vitrine le peuvent |

## Prochaines étapes de construction

1. Migration : `PvpTeam` (équipe de défense), `PvpRating` (Elo, ligue, attaques du jour), `PvpBattle` (graine, état, actions, mise, statut, délais), réglement mensuel comme pour la saison.
2. Serveur : composer et enregistrer son équipe, attaquer en arène (adversaire de la même ligue, IA en défense, Elo), duels directs (invitation, mise en séquestre, choix simultanés, délais, abandon, versement), récompenses mensuelles par ligue ; tout dans la transaction habituelle avec idempotence.
3. Interface : page Arène (équipe, adversaires, combat, replay, classement par ligue) et duels directs.
4. Bot : `/arene`, `/duel-cartes`, `/equipe`.
5. Tests unitaires, intégrations PostgreSQL (séquestre, abandon, délais, concurrence, Elo) et navigateur.

## Arène (construite le 19 novembre)

- Tables `PvpTeam`, `PvpRating`, `PvpBattle`, `PvpSettlement` (migration `20261119010000_pvp_arena`).
- L'équipe enregistrée sert à l'attaque et à la défense. Le serveur revalide les cartes à chaque attaque : une carte vendue ou proposée dans un échange impose d'enregistrer l'équipe à nouveau ; côté défense, elle est simplement retirée.
- Attaque : identifiant de combat choisi par le navigateur (idempotence), un seul combat actif, 10 par jour (jour de Paris), adversaire de la même ligue. La graine du combat n'est jamais envoyée au navigateur.
- Tour : le numéro de tour attendu rend un double clic sans effet (réponse 409, le combat est rechargé).
- Un combat laissé plus de 30 min sans action est perdu par abandon.
- Récompenses : le 1er du mois, top 3 de chaque ligue parmi les joueurs ayant livré au moins un combat dans le mois (hypothèse à confirmer), une opération par mois et par ligue, première période novembre 2026.
- Tests : `scripts/test-arena.ts` (PostgreSQL), `tests/e2e/arena.spec.ts`, `tests/unit/pvp-rules.test.tsx`.
