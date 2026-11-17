#!/bin/sh
# Sauvegarde PostgreSQL de SoraRNG, lancée chaque jour par sorarng-backup.timer
# ou à la main avant une migration. Le dump ne transite jamais par le chat.
#
# Rétention : les dumps de plus de SORA_BACKUP_KEEP_DAYS jours (2 par défaut)
# sont supprimés, uniquement après la validation du nouveau dump. Les deux dumps
# les plus récents sont toujours gardés, même si la planification a sauté des jours.
set -eu
umask 077
cd /home/ubuntu/sorarng
mkdir -p backups
chmod 700 backups

exec 9> backups/.lock
if ! flock -n 9; then
  echo "Une sauvegarde est déjà en cours." >&2
  exit 1
fi

keep_days="${SORA_BACKUP_KEEP_DAYS:-2}"
keep_min=2
compose="sudo -n docker compose --env-file .env.production -f compose.production.yaml"
backup="backups/sorarng-$(date -u +%Y%m%dT%H%M%SZ).dump"

trap 'rm -f "$backup.partial"' EXIT
$compose exec -T postgres pg_dump -U sorarng -d sorarng -Fc > "$backup.partial"
if [ ! -s "$backup.partial" ]; then
  echo "Dump vide, sauvegarde abandonnée." >&2
  exit 1
fi
$compose exec -T postgres pg_restore --list < "$backup.partial" > /dev/null
mv "$backup.partial" "$backup"
trap - EXIT
printf 'Sauvegarde validée : %s (%s octets)\n' "$backup" "$(wc -c < "$backup")"

# Rotation : jamais avant qu'un nouveau dump soit validé.
recent=$(ls -1t backups/sorarng-*.dump | head -n "$keep_min")
find backups -maxdepth 1 -name 'sorarng-*.dump' -mmin +"$((keep_days * 1440))" |
  while read -r old; do
    case "
$recent
" in
      *"
$old
"*) continue ;;
    esac
    rm -f -- "$old"
    printf 'Ancienne sauvegarde supprimée : %s\n' "$old"
  done
find backups -maxdepth 1 -name 'sorarng-*.dump.partial' -mmin +1440 -delete
