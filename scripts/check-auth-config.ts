import 'dotenv/config';
import { discordId } from '../src/server/auth-policy';
const id = Boolean(process.env.AUTH_DISCORD_ID),
  clientSecret = Boolean(process.env.AUTH_DISCORD_SECRET),
  sessionSecret = (process.env.AUTH_SECRET?.length ?? 0) >= 32;
let canonicalLocal = false;
try {
  const url = new URL(process.env.NEXTAUTH_URL ?? '');
  canonicalLocal = url.href === 'http://localhost:3000/';
} catch {}
console.log(
  JSON.stringify(
    {
      discordClientIdPresent: id,
      discordClientIdFormatValid: discordId(process.env.AUTH_DISCORD_ID),
      discordClientSecretPresent: clientSecret,
      sessionSecretAtLeast32Characters: sessionSecret,
      expectedLocalOrigin: canonicalLocal,
      expectedCallback: 'http://localhost:3000/api/auth/callback/discord',
      readyForRealLocalLogin:
        discordId(process.env.AUTH_DISCORD_ID) &&
        clientSecret &&
        sessionSecret &&
        canonicalLocal,
      secretValuesPrinted: false,
    },
    null,
    2,
  ),
);
