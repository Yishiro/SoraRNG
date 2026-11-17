# Préparation de l’environnement SoraRNG

Audit et préparation : 28 octobre 2026 (Europe/Paris). Aucun jeu développé, aucun déploiement public, aucun compte connecté. Aucun logiciel existant désinstallé.

## Système et logiciels

| Outil          | Version / état                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Windows        | Windows 11 Famille x64, build 26200                                                                     |
| RAM            | Environ 16 Gio                                                                                          |
| Node.js        | 24.22.1 LTS, existant et conservé                                                                       |
| npm            | 11.19.1, existant                                                                                       |
| Git            | 2.56.0.windows.1, existant et fonctionnel                                                               |
| pnpm           | 11.25.0 installé via npm, accessible hors runtime Codex                                                 |
| VS Code        | 1.142.0 x64, existant                                                                                   |
| Docker Desktop | 4.97.0 installé via winget, signature de téléchargement vérifiée par winget                             |
| Docker CLI     | 29.9.2 installé, version vérifiée                                                                       |
| Docker Compose | 5.6.1 installé, version vérifiée                                                                        |
| WSL            | 2.7.14.0 installé, noyau 6.18.33.2                                                                      |
| PostgreSQL     | Image postgres:17-alpine configurée ; serveur NON validé                                                |
| Python         | Alias WindowsApps détecté, pas d’interpréteur utilisable confirmé ; non installé car inutile à ce socle |

Le répertoire était vide hormis .git. Aucun service PostgreSQL existant détecté, aucun serveur sur 5432/3000 détecté lors de l’audit. Git et VS Code existants ont été conservés. Les extensions Python déjà installées ne prouvent pas la présence de Python. Aucun secret existant affiché.

## Dépendances du projet

Versions résolues à l’installation, verrouillées dans pnpm-lock.yaml :

| Dépendance                | Version déclarée |
| ------------------------- | ---------------- |
| @prisma/adapter-pg        | ^7.10.1          |
| @prisma/client            | ^7.10.1          |
| discord.js                | ^14.27.0         |
| dotenv                    | ^18.0.9          |
| lucide-react              | ^1.62.0          |
| motion                    | ^14.7.1          |
| next                      | ^16.4.3          |
| next-auth                 | ^4.24.15         |
| pg                        | ^8.23.1          |
| react                     | ^19.3.1          |
| react-dom                 | ^19.3.1          |
| zod                       | ^4.6.7           |
| @playwright/test          | ^1.64.1          |
| @tailwindcss/postcss      | ^4.3.3           |
| @testing-library/jest-dom | ^7.0.1           |
| @testing-library/react    | ^16.3.3          |
| @types/node               | ^24.19.2         |
| @types/pg                 | ^8.23.1          |
| @types/react              | ^19.3.0          |
| @types/react-dom          | ^19.3.0          |
| eslint                    | ^9.39.5          |
| eslint-config-next        | ^16.4.3          |
| jsdom                     | ^30.1.3          |
| prettier                  | ^3.9.10          |
| prisma                    | 7.10.1           |
| tailwindcss               | ^4.3.3           |
| tsx                       | ^4.23.15         |
| typescript                | ^5.9.3           |
| vitest                    | ^5.0.5           |

Prisma CLI/Client/adapter sont alignés sur 7.10.1 stable : le tag npm latest du CLI pointait vers une release candidate 8, qui a été écartée. TypeScript 5.9.3 et ESLint 9.39.5 ont été choisis pour satisfaire les contraintes des plugins de Next.js. ESLint 9 est signalé comme hors support par npm : prévoir sa mise à jour lorsque les plugins React/import/accessibilité acceptent ESLint 10. Ne pas contourner ces contraintes.

Motion et CSS suffisent au socle : aucun Three.js/React Three Fiber, Redis ou moteur audio ajouté. Audio futur via APIs natives, activation volontaire et ressources originales/licenciées.

## Extensions VS Code installées

| Identifiant                     | Version | Éditeur/projet reconnu                      |
| ------------------------------- | ------- | ------------------------------------------- |
| dbaeumer.vscode-eslint          | 3.0.34  | Microsoft / ESLint                          |
| esbenp.prettier-vscode          | 12.4.0  | Prettier                                    |
| bradlc.vscode-tailwindcss       | 0.16.0  | Tailwind Labs                               |
| Prisma.prisma                   | 31.13.0 | Prisma                                      |
| ms-azuretools.vscode-containers | 2.5.3   | Microsoft, successeur de l’extension Docker |

Identifiants vérifiés sur le Marketplace officiel. Extensions existantes conservées. GitLens non ajouté : aucun besoin concret.

## Architecture et sécurité

Voir docs/ARCHITECTURE.md. App Router Next.js, code serveur dans src/server, processus bot séparé, emplacements composants/contrats/catalogue/ressources/migrations/tests préparés. Schéma Prisma sans modèle métier ; aucune migration métier artificielle. Prisma expose $transaction ; le test de connexion vérifie également une transaction SELECT 1.

.env.example contient des champs sans credentials Discord. pnpm env:init génère de vrais secrets locaux aléatoires cryptographiques, refuse d’écraser .env. .env, sorties de build, clients générés et rapports de tests sont ignorés par Git. PostgreSQL est exposé uniquement sur 127.0.0.1:5432, données dans un volume Docker. Ne jamais supprimer ce volume pour un simple arrêt.

Authentification : NextAuth stable, fournisseur officiel Discord, scope identify, sessions JWT chiffrées, durée 24 h, cookies gérés par NextAuth. Fournisseur absent sans credentials ; connexion réelle non testée. Bot : discord.js et APIs officielles, intent Guilds uniquement. Aucune commande distante enregistrée, aucun message envoyé. Préparation des notifications via API REST/discord.js documentée, aucun service métier développé.

## Intervention Windows requise

Le journal C:/ProgramData/DockerDesktop/install-log-admin.txt confirme l’activation de VirtualMachinePlatform et Microsoft-Windows-Subsystem-Linux avec redémarrage requis. Docker Desktop est installé mais son moteur Linux renvoie HTTP 500 ; journal : backend is not running. Aucun redémarrage n’a été forcé.

1. Enregistrer le travail personnel puis redémarrer Windows.
2. Ouvrir Docker Desktop et attendre que le moteur soit opérationnel ; aucun compte Docker requis pour ce développement local.
3. Rouvrir PowerShell pour prendre en compte le PATH Docker.
4. Exécuter les contrôles base ci-dessous. Si Docker signale encore WSL, exécuter wsl --update puis consulter son diagnostic.

## Commandes PowerShell

Depuis le dossier du projet :

```powershell
pnpm install --frozen-lockfile
pnpm env:init # uniquement si .env est absent ; déjà créé sur cet ordinateur
pnpm db:generate
pnpm dev # http://127.0.0.1:3000
```

Après le redémarrage et démarrage de Docker Desktop :

```powershell
docker info
pnpm db:up
pnpm db:check
# Ou : .\scripts\Start-Environment.ps1
```

Arrêt de PostgreSQL : pnpm db:down (conserve le volume).

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm check
pnpm build
pnpm start
pnpm bot:check # contrôle hors connexion
pnpm bot:dev # nécessite un vrai token bot dans .env
pnpm db:migrate --name nom_de_migration # après ajout du premier modèle
pnpm db:deploy # appliquer les migrations existantes sur un futur environnement
```

Ne pas utiliser migrate dev sur une base de production. Aucun modèle métier ni migration initiale inventée. Les migrations seront créées avec le futur schéma.

## Configuration Discord manuelle

Dans le portail développeur Discord, créer votre application et bot vous-même, puis renseigner AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN et éventuellement DISCORD_GUILD_ID dans .env. Redirect OAuth : http://localhost:3000/api/auth/callback/discord ; utiliser localhost pour le flux OAuth, cohérent avec NEXTAUTH_URL. Ne jamais fournir un token de compte utilisateur. AUTH_SECRET est déjà généré. Le bot ne se lance pas sans token. Ne pas partager .env.

## Sources officielles consultées

- https://nextjs.org/docs/pages/getting-started/installation
- https://pnpm.io/installation
- https://pnpm.io/cli/approve-builds
- https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction
- https://docs.docker.com/desktop/setup/install/windows-install/
- https://next-auth.js.org/configuration/options
- https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-containers

## Résultats des vérifications

| Vérification exécutée                      | Résultat                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Node, npm, pnpm, Git, VS Code              | Versions vérifiées, commandes fonctionnelles                                                         |
| pnpm install --frozen-lockfile             | Réussi, lockfile cohérent                                                                            |
| pnpm peers check                           | Aucun conflit restant                                                                                |
| Docker CLI / Compose / WSL                 | Versions vérifiées                                                                                   |
| docker compose config --quiet              | Réussi                                                                                               |
| docker info et docker compose up -d --wait | Échec HTTP 500 : moteur Linux indisponible avant redémarrage                                         |
| pnpm db:generate                           | Réussi, client Prisma 7.10.1 généré                                                                  |
| prisma validate                            | Schéma valide                                                                                        |
| pnpm db:check                              | Échec P1001 : 127.0.0.1:5432 inaccessible ; connexion/transaction NON validées                       |
| pnpm build                                 | Réussi : page statique et route API Auth compilées                                                   |
| pnpm typecheck                             | Réussi                                                                                               |
| pnpm lint                                  | Réussi sans avertissement après correction PostCSS                                                   |
| pnpm test                                  | 2 fichiers, 3 tests réussis                                                                          |
| pnpm bot:check                             | discord.js, commandes slash, boutons et REST disponibles                                             |
| playwright install chromium                | Chromium, headless shell et outils installés                                                         |
| pnpm test:e2e                              | 3 tests Chromium réussis : serveur Next.js, OAuth désactivé sans credentials, viewport mobile 375 px |
| git check-ignore                           | .env, .next/cache et client généré correctement ignorés                                              |

La connexion Discord réelle et le login du bot ne sont pas testés : identifiants externes non fournis. Les effets de jeu ne sont pas développés ; seule la compatibilité de Motion/Lucide est testée. La base et les migrations appliquées ne sont pas validées tant que Docker n’est pas opérationnel.

## Prochaines étapes

1. Redémarrer Windows, démarrer Docker Desktop, puis lancer pnpm db:up et pnpm db:check.
2. Configurer votre application Discord lorsque vous souhaitez tester OAuth et le bot.
3. Mettre à jour ESLint avec ses plugins dès que leurs contraintes sont compatibles.
4. Fournir le prompt de développement principal après validation de la base.

Le fichier AGENTS.md a été ajouté automatiquement par Next.js lors du démarrage et contient ses consignes de documentation. Aucun commit ni push effectué.
