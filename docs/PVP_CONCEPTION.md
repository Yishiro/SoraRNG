# Combats PvP — conception

État au 19 novembre 2026. Le moteur de combat est écrit et testé (`src/game/battle/`), mais il n'est encore branché ni au site, ni au bot, ni à la base. Rien n'est déployé.

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

## Décisions à prendre par le propriétaire

- **Mises des duels** : minimum et maximum, commission éventuelle, et ce qu'il advient de la mise en cas d'abandon ou de délai dépassé.
- **Classement** : points gagnés ou perdus par combat (type Elo), nombre d'attaques d'arène par jour, récompenses mensuelles du top 3 ou par ligue.
- **Ligues** : nombre et seuils de puissance (par exemple Bronze < 700, Argent < 900, Or < 1 100, Platine ≥ 1 100).
- **Composition** : peut-on aligner deux exemplaires du même modèle ? Les cartes en vitrine ou mises aux enchères peuvent-elles combattre ?
- **Duels directs** : délai par tour (par exemple 60 secondes) et conséquence d'un délai dépassé (action automatique de l'IA ou défaite).
