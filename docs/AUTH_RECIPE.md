# Phase 1 — Authentification Discord et recette multijoueur

Date de recette : **29 octobre 2026**. Périmètre strict : authentification, sessions et vérifications associées. Aucun déploiement public. RNG, probabilités, finition, coûts et catalogue inchangés.

## Conclusion

La recette automatique des mécanismes locaux est disponible et passe. **La connexion Discord réelle n’a pas été effectuée : `AUTH_DISCORD_ID` et `AUTH_DISCORD_SECRET` sont absents.** Aucun compte Discord réel n’est utilisé et aucune validation multijoueur avec deux vrais comptes n’est revendiquée.

`AUTH_SECRET` est présent et fait au moins 32 caractères. `NEXTAUTH_URL` correspond à `http://localhost:3000`. Le résultat de `pnpm auth:check` n’affiche que des indicateurs, jamais les secrets. La présence des identifiants ne suffira pas à prouver leur validité auprès de Discord.

## Audit et corrections

- NextAuth **v4**, conservé ; aucune migration vers Auth.js v5. Route App Router `/api/auth/[...nextauth]` avec GET/POST.
- Scope OAuth limité à `identify`, vérifié dans l’URL d’autorisation produite par le serveur de recette. Aucun scope email, guilds ou bot demandé pour la connexion.
- Contrôle OAuth `state` explicite. Cookie d’état chiffré et durée native de 15 minutes conservés. Absence, altération et expiration conduisent au refus local du callback. Aucun échange de code réel avec Discord effectué.
- Issuer Discord fixé à `https://discord.com` : la documentation actuelle indique un paramètre `iss` dans les réponses et le client installé compare ce paramètre à l’issuer configuré. Un issuer étranger est rejeté par la recette HTTP avant échange du code.
- Sessions JWT/JWE natives chiffrées, durée de 24 h avec renouvellement natif de session. Pas de token d’accès ou de refresh token ajouté à la session client. Les mises à jour de session client ne remplacent pas l’identité Discord vérifiée.
- Cookies natifs conservés : HttpOnly, SameSite=Lax, Path=/ ; Secure automatiquement activé sur une origine HTTPS. Les essais HTTP locaux vérifient HttpOnly/SameSite ; aucun test HTTPS public n’a été effectué.
- Redirections limitées à l’origine du site. Les demandes de retour vers une autre origine sont refusées.
- Création/upsert du joueur dans le callback de connexion réussi : fournisseur Discord exigé, identifiant numérique en chaîne, correspondance entre profil, compte OAuth et utilisateur. Le nom est actualisé sans réinitialiser l’état du joueur.
- Pool PostgreSQL et création des joueurs extraits dans des modules partagés afin d’éviter une dépendance circulaire entre authentification et moteur du jeu.
- Compatibilité CommonJS/ESM du provider Discord corrigée : l’activation du provider révélait un export enveloppé lors des exécutions Node/tsx.
- **Bug réel détecté par HTTP** : une session valide recevait 403 sur les mutations, car l’URL reconstruite par Next pouvait différer de l’origine navigateur. Le contrôle utilise désormais l’origine canonique `NEXTAUTH_URL` et continue de refuser une origine absente, étrangère, malformée ou d’un autre port.
- Les API privées distinguent 401 (identité absente/invalide) et 503 (indisponibilité de service). Les détails SQL ne sont plus exposés pour les erreurs de base portant un code. Les réponses de données privées et résultats sensibles portent `Cache-Control: private, no-store` et `Vary: Cookie`.
- Pages `/auth/signin` et `/auth/error` : messages contrôlés pour refus, retour OAuth invalide, expiration et indisponibilité. Les valeurs arbitraires de la query ne sont pas affichées comme messages. Une expiration lors d’une action efface l’état privé affiché et invite à se reconnecter.
- Logger NextAuth limité aux codes d’erreur autorisés, debug silencieux ; métadonnées d’erreur ignorées. Les logs de requêtes de développement ignorent `/api/auth/*` afin de ne pas imprimer les paramètres code/state.

## Vérifications automatiques et leur portée

| Parcours                                                          | Automatique                                                               | Discord réel                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Création du profil au premier sign-in                             | Callback invoqué avec identité synthétique dans un schéma temporaire      | Bloqué                                               |
| Reconnexion, unicité du compte, conservation des ressources       | Upsert du callback testé et état comparé                                  | Bloqué                                               |
| Émission de l’URL OAuth, scope, redirection et cookies CSRF/state | Serveur HTTP isolé ; URL analysée sans navigation vers Discord            | Aucun consentement réel                              |
| Refus et callback avec état invalide/expiré                       | Requêtes de callback simulées, aucune session créée                       | Refus du dialogue Discord non testé                  |
| Sessions expirées, altérées, identité invalide et déconnexion     | Vrais handlers HTTP, cookies JWE fabriqués uniquement par le banc de test | Expiration d’une session issue de Discord non testée |
| Isolation de deux joueurs                                         | Deux contextes HTTP indépendants, cookies de test distincts               | Bloqué avec deux comptes réels                       |
| Invocation authentifiée et requêtes simultanées                   | API réelle, PostgreSQL temporaire, RNG réel, même clé idempotente         | Bloqué                                               |
| Inventaires et transfert de cartes                                | Offres/verrouillages/confirmations via API réelle ; propriété revérifiée  | Bloqué                                               |
| Reconnexion après transaction                                     | Nouveau contexte HTTP et lecture des données persistées                   | Bloqué                                               |
| Messages et nettoyage de l’interface à l’expiration               | Playwright ; état connecté fourni par fixture UI                          | Ce n’est pas une preuve OAuth                        |

Les comptes synthétiques sont limités à un **schéma PostgreSQL temporaire** créé puis supprimé par le script. Le serveur de recette est un processus distinct sur un port loopback éphémère, utilisant un secret aléatoire propre au test. Il exécute le build local, mais ne pointe jamais sur les tables de joueurs de l’application. Un contrôle avant/après vérifie que les identifiants synthétiques n’ont pas été introduits dans le schéma habituel. Aucun provider fictif ni route de connexion de test n’est ajouté à l’application.

La recette n’effectue aucun échange de code/token avec Discord. Elle ne transforme donc pas ses résultats en « connexion Discord réelle réussie ». Les cookies et secrets de test ne sont ni imprimés ni enregistrés dans le rapport.

Résultats reproductibles : `docs/AUTH_AUTOMATED_RESULTS.json`. Les autres tests métier existants restent des tests automatiques isolés, jamais une preuve de comptes Discord réels.

Bilan final exécuté : **33 tests unitaires**, **16 tests Chromium**, suite métier PostgreSQL et recette HTTP d’authentification passent. TypeScript, ESLint, Prettier et build de production passent. Le dernier serveur de recette a été arrêté et son schéma supprimé. Les identifiants et la configuration du portail Discord demeurent les seuls prérequis externes à cette recette ; les étapes avec deux comptes réels restent non exécutées.

```powershell
pnpm auth:check
pnpm check
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm test:auth
```

`test:auth` exige un build à jour, PostgreSQL disponible et le droit de créer un schéma temporaire. Il arrête son serveur et supprime son schéma en fin d’exécution. Ne pas lancer ce banc contre une infrastructure publique ; l’exécution prévue est le projet local.

## Actions manuelles nécessaires

1. Dans [Discord Developer Portal](https://discord.com/developers/applications), créer ou choisir l’application destinée à SoraRNG.
2. Dans OAuth2, enregistrer **exactement** `http://localhost:3000/api/auth/callback/discord` comme redirect URI, puis sauvegarder. Ce réglage externe n’a pas été vérifié depuis cette session.
3. Dans le `.env` local déjà existant, renseigner `AUTH_DISCORD_ID` avec le Client ID et `AUTH_DISCORD_SECRET` avec le Client Secret. Aucun secret ne doit être envoyé dans le chat, ajouté au dépôt ou collé dans un rapport.
4. Conserver `NEXTAUTH_URL=http://localhost:3000` et le `AUTH_SECRET` aléatoire existant. Ne pas utiliser le token du bot à la place du secret OAuth. Modifier le secret de session invaliderait les sessions existantes.
5. Redémarrer `pnpm dev`, puis exécuter `pnpm auth:check`. Utiliser **http://localhost:3000** dans les deux navigateurs ; ne pas alterner avec 127.0.0.1, car les cookies et origines diffèrent.
6. Prévoir deux comptes Discord réels et deux profils de navigateur séparés (ou un profil normal et un privé). Aucun serveur Discord particulier n’est à rejoindre.

## Recette manuelle à compléter après configuration

Chaque ligne suivante reste **NON EXÉCUTÉE** à cette date.

1. **Compte A — première connexion** : autoriser l’application sur Discord. Vérifier le retour au site, l’identifiant Discord du profil et la création d’un unique joueur. Ne pas transmettre l’URL de callback contenant un code OAuth.
2. **Compte A — ressources et invocation** : récupérer une récompense disponible, effectuer une invocation gratuite et une invocation payante si le solde le permet. Vérifier le débit prévu, l’exemplaire enregistré et l’historique. Aucune rareté ni finition précise n’est garantie.
3. **Compte A — reconnexion** : se déconnecter puis se reconnecter avec le même compte Discord. Vérifier le même identifiant joueur, les soldes et les exemplaires conservés.
4. **Compte B — isolation** : se connecter dans l’autre profil de navigateur, vérifier un autre identifiant et un inventaire indépendant. Effectuer une invocation disponible sans altérer A.
5. **Échange réel** : A invite B par son identifiant Discord ; B accepte. Proposer des exemplaires non verrouillés, actualiser l’écran de chaque côté, verrouiller les offres puis confirmer des deux côtés. Vérifier les transferts et les historiques. Une modification d’offre doit annuler les validations précédentes.
6. **Reconnexion après échange** : déconnecter/reconnecter A et B ; vérifier qu’aucun exemplaire n’est dupliqué et que la propriété correspond au transfert validé.
7. **Refus et expiration** : lancer une nouvelle connexion dans un contexte déconnecté, refuser le consentement et vérifier le message. Tester ensuite l’expiration d’une session ou la suppression de son cookie : les opérations doivent demander une reconnexion et ne rien débiter.
8. **Simultanéité** : depuis deux onglets d’un compte, solliciter l’invocation gratuite simultanément et vérifier une seule attribution. Lancer un échange d’un exemplaire rendu indisponible ailleurs : le transfert doit échouer sans perte ni duplication. Les scénarios de forte concurrence sont déjà couverts automatiquement, mais ne sont pas pour autant exécutés ici avec Discord réel.

Noter pour chaque cas la date, le résultat et les éventuels messages génériques, sans cookie, token, code OAuth, secret ou identifiant personnel inutile dans les captures partagées.

## Références consultées

- Code installé NextAuth v4 : provider Discord, cookies, callbacks, contrôles OAuth et encode/decode JWE.
- Guides Next.js locaux : Route Handlers et configuration des logs.
- [Options NextAuth v4](https://next-auth.js.org/configuration/options).
- [API REST NextAuth](https://next-auth.js.org/getting-started/rest-api).
- [Documentation OAuth2 officielle Discord](https://github.com/discord/discord-api-docs/blob/main/developers/topics/oauth2.mdx).

La phase s’arrête à ce blocage externe précis. Aucune fonctionnalité d’administration, événement ou évolution de gameplay n’est engagée dans cette recette.
