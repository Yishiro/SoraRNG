# Administration locale et calendrier

Les écrans `/admin`, `/events` et `/trade` utilisent les données PostgreSQL du projet. Aucun déploiement public n’a été effectué. Le calendrier est informatif : il ne change ni les probabilités, ni les coûts, ni les récompenses du jeu.

## Accès

Les rôles sont recalculés côté serveur depuis `ADMIN_DISCORD_IDS` et `MODERATOR_DISCORD_IDS`, listes d’identifiants **utilisateur** Discord séparés par des virgules. Les valeurs par défaut sont vides : personne n’obtient de rôle automatiquement. Ne pas utiliser le Client ID de l’application à la place de l’identifiant utilisateur. Après configuration locale, redémarrer le serveur.

Une connexion Discord vérifiée reste nécessaire. Modifier la réponse de l’interface, son cookie non signé ou un identifiant envoyé au serveur n’accorde aucun accès. Un modérateur peut consulter les joueurs, le journal et les événements et suspendre/réactiver un joueur. Seul un administrateur peut ajuster les ressources et enregistrer/publier les événements. L’outil refuse de suspendre un compte appartenant aux listes de l’équipe ; retirer préalablement ses accès si cela est nécessaire.

## Traçabilité et transactions

Chaque intervention exige un motif de 8 à 500 caractères et une clé unique. Les états avant/après, l’acteur et le motif sont conservés dans `AdminAudit`. Un ajustement de ressources écrit aussi une `Operation` pour l’historique du joueur. Le verrouillage des lignes et une clé d’idempotence empêchent un même ajustement d’être payé deux fois. Une clé réutilisée avec des paramètres différents est refusée. Les soldes négatifs sont refusés ; une erreur annule l’intervention et son journal.

Les suspensions sont persistées dans le profil. Elles bloquent les nouvelles connexions, les routes privées d’une session existante, les mutations et la finalisation d’un échange impliquant le compte. La levée de suspension conserve le profil et les ressources. Les sessions expirées ou suspendues effacent les données privées affichées après une action refusée.

La migration `202610290001_administration` ajoute `AdminAudit` et `Event`. Elle a été appliquée en local ; aucune attribution de rôle, création d’événement ou correction de solde n’a été effectuée dans les tables habituelles pendant la recette.

## Calendrier

Les brouillons restent réservés à l’administration. `/api/events` ne renvoie que les événements publiés ; l’affichage distingue en cours, à venir et archives. Le formulaire d’administration saisit les dates en UTC ; le calendrier les présente dans le fuseau du navigateur. Les modifications utilisent une révision : une édition obsolète doit être rechargée. Aucun événement fictif n’est ajouté automatiquement.

## Échanges

La sélection regroupe les exemplaires par modèle, finition, niveau, éveil et statut favori. Les exemplaires verrouillés sont exclus. Les quantités correspondent à des identifiants d’exemplaires précis, dans la limite existante de 50 par offre. Le serveur conserve la validation finale de propriété et de disponibilité. La recherche de joueurs est authentifiée, limitée à 20 résultats et exclut les comptes suspendus. Les échanges sont actualisés toutes les dix secondes ; le bouton Actualiser permet une mise à jour immédiate.

## Vérification et limites

- `pnpm test:admin` : base PostgreSQL temporaire ; rôles, révocation, idempotence concurrente, audit atomique, refus de solde négatif, suspension, persistance et révisions d’événements. Vérifie également qu’une suspension empêche un transfert préalablement confirmé.
- `pnpm test:auth` après `pnpm build` : routes HTTP réelles, sessions JWE de test, autorisation/refus d’administration, publication distincte des brouillons, annuaire et suspension d’une session existante.
- `pnpm test:e2e` : quantités, acceptation d’échange sans champ destinataire parasite, formulaires administrateur/modérateur, calendrier et navigation mobile. Les données des écrans connectés sont des fixtures UI.

Ces tests ne prouvent pas une connexion avec Discord : les identifiants OAuth sont absents. La recette avec deux vrais comptes reste décrite dans [AUTH_RECIPE.md](AUTH_RECIPE.md). Les nouvelles fonctions restent à essayer avec les rôles de comptes réels une fois OAuth configuré. Les journaux actuels sont stockés dans la même base ; l’archivage externe et une garantie d’inaltérabilité ne sont pas implémentés.
