# Socle technique

- app/: site et routes serveur Next.js.
- src/server/: accès base et authentification, à conserver côté serveur.
- bot/: processus Discord indépendant.
- src/components/: composants responsive réutilisables à venir.
- src/shared/: schémas Zod et contrats partagés à venir.
- data/catalog/: futur catalogue ; aucune donnée de jeu ajoutée.
- prisma/migrations/: migrations futures, aucun modèle métier créé.
- public/images et public/audio: ressources originales ou licenciées uniquement. Audio via HTMLAudioElement/Web Audio, déclenché après interaction et désactivable.
- tests/: Vitest et Playwright.

Motion, CSS (perspective, gradients, ombres et transforms) et prefers-reduced-motion couvrent le socle graphique. Aucun Three.js, Redis ou moteur audio ajouté sans besoin établi.

Notifications site/bot : utiliser ultérieurement les canaux officiels discord.js/REST côté serveur ; aucun token dans le navigateur. Aucun transport applicatif ni commande métier développé à ce stade.

Transactions : createDatabase expose Prisma et son API $transaction. Valider les requêtes avec Zod avant toute mutation ; les règles de concurrence seront définies avec le modèle métier.

VPS Linux : Node 24, pnpm install --frozen-lockfile, pnpm db:generate, pnpm build et pnpm db:deploy. Prévoir HTTPS et gestionnaire de processus pour le site et le bot. Ne pas publier cette configuration de développement directement.
