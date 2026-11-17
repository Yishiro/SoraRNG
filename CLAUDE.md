# Reprise de SoraRNG par Claude

Lis `HANDOFF_CLAUDE.md`, puis `AGENTS.md` avant toute intervention. Cette passation est préparée le 17 novembre 2026 à partir du code local et des vérifications du 5 novembre. Vérifie l'état réel du VPS avant de présenter une version comme actuellement déployée.

## Consignes du propriétaire

- Continuer le projet existant et conserver les données des joueurs.
- Communiquer en français. Direction artistique gris charbon, cartes bien visibles, navigation latérale avec icônes.
- Aucune illustration générée par IA. Garder les sources et statuts de droits du manifeste sans inventer d'autorisation.
- Ne modifier probabilités, coûts, bonus ou catalogue que sur demande explicite.
- Ne publier aucun secret, fichier d'environnement réel, clé SSH, sauvegarde SQL ou donnée privée de joueur.
- Ne jamais afficher les secrets dans les outils ou journaux. Des secrets Discord ont été partagés dans un ancien chat. Leur rotation reste à vérifier avec le propriétaire.
- Lire les guides pertinents dans `node_modules/next/dist/docs/` avant de modifier Next.js, conformément à `AGENTS.md`.
- Respecter les transactions, verrous de joueurs, clés d'idempotence et validations serveur existants. Une réponse réseau perdue ne doit pas provoquer un second débit.
- Les fixtures navigateur et identités synthétiques ne prouvent pas une connexion OAuth Discord réelle.
- Sur le VPS, intervenir uniquement sur SoraRNG. Préserver les autres projets, notamment `yishi-staff-hub`.

## Première intervention

Lire la passation, examiner `git status`, installer les dépendances verrouillées et examiner les sources de la fonctionnalité demandée. Une reprise de contexte seule ne constitue pas une demande de nouvelle fonctionnalité ou de déploiement.
