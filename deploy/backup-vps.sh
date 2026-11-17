#!/bin/sh
# Run on the VPS as ubuntu with sudo; the dump never passes through chat.
set -eu
umask 077
cd /home/ubuntu/sorarng
mkdir -p backups
chmod 700 backups
backup="backups/sorarng-$(date -u +%Y%m%dT%H%M%SZ).dump"
sudo -n docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_dump -U sorarng -d sorarng -Fc > "$backup.partial"
sudo -n docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_restore --list < "$backup.partial" > /dev/null
mv "$backup.partial" "$backup"
printf '%s\n' "$backup"
