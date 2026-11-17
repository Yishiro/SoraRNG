# Exécution et préparation du déploiement

## Déploiement VPS demandé le 29 octobre 2026

Mise à jour illustrations : après une nouvelle demande explicite du propriétaire, 135 images et leurs miniatures sont copiées dans les ressources publiques. Leurs droits restent non vérifiés dans le manifeste ; cette décision remplace la restriction initiale aux aperçus locaux. `.local` et les secrets restent exclus des images Docker, et l’API des aperçus privés reste fermée en production.

Adresse configurée : `https://sorarng.54-37-13-70.sslip.io`. Le propriétaire a autorisé la mise en ligne et fourni l’accès SSH au VPS. Cette procédure remplace les restrictions historiques de publication ci-dessous. Voir `docs/DEPLOYMENT_RESULT.json` pour les vérifications effectivement terminées.

Application installée dans `/home/ubuntu/sorarng`, avec un projet Docker Compose distinct nommé `sorarng`. Le service Node de production écoute uniquement sur `127.0.0.1:3010`, derrière le Nginx déjà présent. PostgreSQL 17 dispose de son propre volume Docker, sans port public ni connexion aux bases des autres applications. Les services ont une politique de redémarrage `unless-stopped`.

Les images Linux sont construites avec `Dockerfile` : cible `production` minimale exécutée par l’utilisateur `node`, cible `tools` séparée pour les migrations et l’import. Next.js génère la sortie standalone uniquement lorsque `SORA_STANDALONE=1`. Les secrets et médias privés sont exclus du contexte Docker. Aucun contenu de `.local` ni `.env` local n’est publié.

Configuration sensible : `/home/ubuntu/sorarng/.env.production`, permissions `0600`, créée sur le VPS avec de nouveaux secrets. Ne jamais afficher ce fichier dans les journaux. Le fichier d’exemple sans secrets est `deploy/production.env.example`. Ne pas remplacer une configuration existante à chaque mise à jour.

Commandes sur le VPS :

```sh
cd /home/ubuntu/sorarng
sudo docker compose --env-file .env.production -f compose.production.yaml ps
sudo docker compose --env-file .env.production -f compose.production.yaml up -d
sh backup-vps.sh
```

`initialize` attend la base, applique les quatre migrations puis importe le catalogue de 150 cartes sans créer de joueurs. L’application attend la réussite de cette initialisation. L’import est idempotent et ne touche pas aux inventaires. Le catalogue original garde son empreinte validée.

Le certificat est obtenu par Certbot avec le challenge webroot `/var/www/sorarng-acme`. Le minuteur Certbot du VPS renouvelle les certificats ; un hook valide et recharge Nginx après renouvellement. Les fichiers `deploy/nginx-http.conf` et `deploy/nginx-https.conf` ne concernent que SoraRNG. Les journaux d’accès omettent les paramètres de requête et la journalisation OAuth est désactivée dans sa location dédiée.

### Connexion Discord publique

La consultation du site ne demande pas de connexion. Les invocations et échanges exigent Discord et restent indisponibles tant que les identifiants de l’application ne sont pas configurés. Renseigner `AUTH_DISCORD_ID` et `AUTH_DISCORD_SECRET` dans le fichier privé du VPS et déclarer cette redirection dans le portail Discord :

```text
https://sorarng.54-37-13-70.sslip.io/api/auth/callback/discord
```

Relancer ensuite `docker compose ... up -d` avec les options de configuration ci-dessus pour recréer le service avec son environnement actualisé. Les listes administrateur/modérateur restent vides par défaut. Aucun compte de test n’est créé dans la base publique.

### Sauvegardes et mises à jour

`deploy/backup-vps.sh`, copié sur le VPS, écrit des dumps privés dans `backups/`, vérifie leur structure puis les renomme. Les fichiers incomplets conservent le suffixe `.partial`. Ne pas utiliser `docker compose down -v`, qui supprimerait les volumes de cette installation. Depuis le 17 novembre 2026, `deploy/sorarng-backup.timer` lance ce script chaque jour à 4 h (heure de Paris), via `deploy/sorarng-backup.service`. Après validation du nouveau dump, le script supprime les dumps de plus de deux jours (`SORA_BACKUP_KEEP_DAYS`) et garde toujours les deux plus récents, même si des passages ont été manqués. Les 33 dumps antérieurs à cette mise en place ont été déplacés dans `backups/archive-avant-retention/`, que la rotation ne touche pas.

```sh
systemctl list-timers sorarng-backup.timer
sudo journalctl -u sorarng-backup.service -n 20
sudo systemctl start sorarng-backup.service   # sauvegarde immédiate
```

Installation ou mise à jour : copier `backup-vps.sh` dans `/home/ubuntu/sorarng`, puis les deux unités dans `/etc/systemd/system/`, puis `sudo systemctl daemon-reload && sudo systemctl enable --now sorarng-backup.timer`. Les sauvegardes restent sur le même VPS : une copie externe reste à configurer.

Construire les deux images avec un nouveau tag de version, les transférer et les charger sur le VPS ; modifier ensuite uniquement `SORA_IMAGE_TAG` dans la configuration privée et exécuter `up -d`. Sauvegarder avant toute migration. Un retour arrière applicatif peut reprendre le tag précédent si son schéma reste compatible ; aucune annulation automatique des migrations n’est fournie.

Le nom `sslip.io` est une adresse DNS pratique liée à l’IP du VPS, sans domaine acheté. Un futur domaine personnalisé nécessitera un enregistrement DNS, un nouveau certificat, la mise à jour de `PUBLIC_ORIGIN` et celle de la redirection Discord. Les 135 illustrations sélectionnées sont désormais publiques sur demande du propriétaire, sans droits vérifiés ; seules les 15 cartes sans image conservent un cadre neutre.

## Local

```powershell
pnpm db:up
pnpm db:deploy
pnpm db:generate
pnpm dev
```

Base : PostgreSQL Docker, uniquement exposée sur `127.0.0.1:5432`. Site : [localhost:3000](http://localhost:3000). Les valeurs sensibles restent dans `.env`, déjà ignoré par Git.

Vérifier le catalogue et configurer Discord selon README. La connexion OAuth et le bot réels restent à valider avec vos identifiants. Le serveur `next dev` reste réservé au PC ; seule la version de production est publiée selon la procédure VPS ci-dessus.

## Build local de production

Arrêter le serveur de développement qui utilise le port 3000 avant de démarrer :

```powershell
pnpm build
pnpm start
```

Le build n’importe pas de cartes et ne lance pas le bot. `pnpm db:deploy` applique les migrations déjà créées ; ne pas utiliser `db push` pour remplacer le schéma.

## Sauvegarde et restauration manuelles

Avec Docker Desktop actif, ces commandes passent par le conteneur pour éviter les transformations de flux binaires PowerShell :

```powershell
docker compose exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/sora-backup.dump'
docker compose cp postgres:/tmp/sora-backup.dump ./sora-backup.dump
```

Conserver les sauvegardes hors du dépôt, chiffrées si elles contiennent des joueurs réels. Restaurer d’abord dans une base séparée et vide, puis vérifier inventaires, soldes et journaux. Aucune restauration n’a été exécutée pendant cette session. L’automatisation des sauvegardes et un exercice de restauration restent à faire.

## État historique avant la demande de publication

L’accord de publication a été donné le 29 octobre 2026. Rôles, audit et limitation de débit ont été ajoutés avant cette mise en ligne. Les parcours avec deux vrais comptes Discord restent à valider après configuration OAuth. Ne publier que des illustrations et sons autorisés.
