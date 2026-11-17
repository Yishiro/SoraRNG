import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) throw new Error('.env already exists; preserved');
const password = randomBytes(32).toString('hex');
writeFileSync(
  '.env',
  [
    'POSTGRES_USER=sora',
    'POSTGRES_DB=sora_dev',
    'POSTGRES_PASSWORD=' + password,
    'DATABASE_URL=postgresql://sora:' +
      password +
      '@127.0.0.1:5432/sora_dev?schema=public',
    'AUTH_SECRET=' + randomBytes(32).toString('hex'),
    'NEXTAUTH_URL=http://localhost:3000',
    'AUTH_DISCORD_ID=',
    'AUTH_DISCORD_SECRET=',
    'DISCORD_BOT_TOKEN=',
    'DISCORD_APPLICATION_ID=',
    'DISCORD_GUILD_ID=',
    '',
  ].join('\n'),
  { flag: 'wx', mode: 0o600 },
);
console.log('.env created with cryptographically random local secrets.');
