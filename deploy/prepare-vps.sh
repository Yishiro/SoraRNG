#!/bin/sh
set -eu
cd /home/ubuntu/sorarng
python3 - <<'PY'
import os, secrets
filename='.env.production'
if not os.path.exists(filename):
    values={
        'PUBLIC_ORIGIN':'https://sorarng.54-37-13-70.sslip.io',
        'APP_PORT':'3010',
        'SORA_IMAGE_TAG':'20261029',
        'POSTGRES_PASSWORD':secrets.token_hex(32),
        'AUTH_SECRET':secrets.token_hex(48),
        'AUTH_DISCORD_ID':'',
        'AUTH_DISCORD_SECRET':'',
        'ADMIN_DISCORD_IDS':'',
        'MODERATOR_DISCORD_IDS':'',
    }
    fd=os.open(filename,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as file:
        file.write(''.join(f'{key}={value}\n' for key,value in values.items()))
    print('Production secrets created on VPS; values not displayed.')
else:
    print('Existing production configuration preserved.')
PY
