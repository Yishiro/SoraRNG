import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { applyTestMigrations } from './lib/test-migrations';
import { createServer } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { request, type APIRequestContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import type { NextAuthOptions } from 'next-auth';
const require = createRequire(import.meta.url);
const schema = `sora_auth_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const secret = randomBytes(48).toString('hex');
const port = await new Promise<number>((resolve, reject) => {
  const s = createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const address = s.address();
    if (!address || typeof address === 'string')
      return reject(new Error('Test port unavailable'));
    s.close(() => resolve(address.port));
  });
});
const base = `http://127.0.0.1:${port}`;
const testUrl = new URL(process.env.DATABASE_URL!);
testUrl.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = testUrl.toString();
process.env.AUTH_SECRET = secret;
process.env.NEXTAUTH_URL = base;
// Synthetic application credentials only initialize OAuth requests. No request is followed to Discord.
process.env.AUTH_DISCORD_ID = '900000000000000099';
process.env.AUTH_DISCORD_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_DISCORD_IDS = '';
process.env.MODERATOR_DISCORD_IDS = '';
const { authOptions } = await import('../src/server/auth');
const { pool } = await import('../src/server/postgres');
const { importCatalog } = await import('../src/server/catalog-import');
type SignInArgs = Parameters<
  NonNullable<NonNullable<NextAuthOptions['callbacks']>['signIn']>
>[0];
const contexts: APIRequestContext[] = [];
let server: ChildProcess | undefined;
const checks: string[] = [];
let stage = 'schema';
const a = '900000000000000001',
  b = '900000000000000002';
process.env.ADMIN_DISCORD_IDS = a;
const pass = (name: string) => {
  checks.push(name);
  console.log(`PASS: ${name}`);
};
async function context(id?: string, maxAge = 3600, override?: string) {
  const token =
    override ??
    (id
      ? await encode({
          secret,
          token: {
            sub: id,
            discordId: id,
            name: id === a ? 'Auth A' : 'Auth B',
          },
          maxAge,
        })
      : undefined);
  const c = await request.newContext({
    baseURL: base,
    storageState: {
      cookies: token
        ? [
            {
              name: 'next-auth.session-token',
              value: token,
              domain: '127.0.0.1',
              path: '/',
              expires: Math.floor(Date.now() / 1000) + 3600,
              httpOnly: true,
              secure: false,
              sameSite: 'Lax',
            },
          ]
        : [],
      origins: [],
    },
  });
  contexts.push(c);
  return c;
}
async function mutation(
  c: APIRequestContext,
  kind: string,
  payload: Record<string, unknown> = {},
  key = randomUUID(),
) {
  return c.post('/api/game', {
    headers: { origin: base },
    data: { kind, payload, key },
  });
}
async function trade(
  c: APIRequestContext,
  action: string,
  t?: { id: string; state: { revision: number } },
  extra: Record<string, unknown> = {},
) {
  const r = await c.post('/api/trades', {
    headers: { origin: base },
    data: { action, id: t?.id, revision: t?.state.revision, ...extra },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
try {
  const originalPlayers = (
    await admin.query(
      'SELECT id,name,state FROM "Player" WHERE id=ANY($1::text[]) ORDER BY id',
      [[a, b]],
    )
  ).rows;
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await applyTestMigrations(pool);
  await importCatalog(
    pool,
    await readFile('data/kingdom_hearts_catalogue_150.json', 'utf8'),
  );
  stage = 'OAuth callbacks against isolated database';
  for (const id of [a, b])
    assert.equal(
      await authOptions.callbacks!.signIn!({
        user: { id, name: id === a ? 'Auth A' : 'Auth B' },
        account: { provider: 'discord', type: 'oauth', providerAccountId: id },
        profile: { id },
      } as SignInArgs),
      true,
    );
  await pool.query(
    "UPDATE \"Player\" SET state=jsonb_set(state,'{munny}','1234') WHERE id=$1",
    [a],
  );
  await authOptions.callbacks!.signIn!({
    user: { id: a, name: 'Auth A renamed' },
    account: { provider: 'discord', type: 'oauth', providerAccountId: a },
    profile: { id: a },
  } as SignInArgs);
  assert.equal(
    (await pool.query('SELECT state FROM "Player" WHERE id=$1', [a])).rows[0]
      .state.munny,
    1234,
  );
  assert.equal(
    (await pool.query('SELECT COUNT(*)::int AS count FROM "Player"')).rows[0]
      .count,
    2,
  );
  pass(
    'synthetic OAuth callback creates one profile per Discord id; reconnect retains state',
  );
  stage = 'isolated HTTP server startup (run pnpm build first)';
  server = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: 'ignore',
      windowsHide: true,
    },
  );
  const anonymous = await context();
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null)
      throw new Error('Isolated auth server exited');
    try {
      if (
        (await anonymous.get('/api/auth/providers', { timeout: 1000 })).ok()
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready);
  stage = 'OAuth protections without Discord network exchange';
  assert.equal(
    (authOptions.providers[0] as { options?: { issuer?: string } }).options
      ?.issuer,
    'https://discord.com',
  );
  const providers = await (await anonymous.get('/api/auth/providers')).json();
  assert.equal(
    providers.discord.callbackUrl,
    base + '/api/auth/callback/discord',
  );
  const csrfResponse = await anonymous.get('/api/auth/csrf');
  const csrf = (await csrfResponse.json()).csrfToken;
  const cookieHeaders = csrfResponse
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
    .join(';');
  assert.match(cookieHeaders, /HttpOnly/i);
  assert.match(cookieHeaders, /SameSite=Lax/i);
  const deniedStart = await anonymous.post('/api/auth/signin/discord', {
    form: { callbackUrl: '/dashboard', json: 'true' },
    maxRedirects: 0,
  });
  const deniedUrl = deniedStart
    .headers()
    ['content-type']?.includes('application/json')
    ? (await deniedStart.json()).url
    : deniedStart.headers().location;
  assert.ok(deniedUrl && new URL(deniedUrl, base).origin === base);
  assert.ok(
    !(deniedStart.headers().location ?? '').startsWith('https://discord.com'),
  );
  const start = await anonymous.post('/api/auth/signin/discord', {
    form: {
      csrfToken: csrf,
      callbackUrl: 'https://outside.invalid',
      json: 'true',
    },
    maxRedirects: 0,
  });
  const authUrl = new URL((await start.json()).url);
  assert.equal(authUrl.hostname, 'discord.com');
  assert.equal(
    authUrl.searchParams.get('redirect_uri'),
    base + '/api/auth/callback/discord',
  );
  assert.equal(authUrl.searchParams.get('scope'), 'identify');
  assert.ok(authUrl.searchParams.get('state'));
  const stateCookie = start
    .headersArray()
    .find(
      (h) =>
        h.name.toLowerCase() === 'set-cookie' &&
        h.value.startsWith('next-auth.state='),
    );
  assert.ok(stateCookie);
  assert.match(stateCookie.value, /HttpOnly/i);
  assert.match(stateCookie.value, /SameSite=Lax/i);
  const wrongIssuer = await anonymous.get(
    '/api/auth/callback/discord?' +
      new URLSearchParams({
        code: 'synthetic-only',
        state: authUrl.searchParams.get('state')!,
        iss: 'https://wrong-issuer.invalid',
      }),
    { maxRedirects: 0 },
  );
  assert.ok([302, 303].includes(wrongIssuer.status()));
  assert.equal((await anonymous.get('/api/game')).status(), 401);
  const callbackCookie = (await anonymous.storageState()).cookies.find(
    (c) => c.name === 'next-auth.callback-url',
  );
  assert.ok(callbackCookie);
  assert.equal(new URL(decodeURIComponent(callbackCookie.value)).origin, base);
  const callback = await anonymous.get(
    '/api/auth/callback/discord?code=synthetic-only&state=invalid',
    { maxRedirects: 0 },
  );
  assert.ok([302, 303].includes(callback.status()));
  assert.ok(new URL(callback.headers().location, base).origin === base);
  const refused = await anonymous.get(
    '/api/auth/callback/discord?error=access_denied',
    { maxRedirects: 0 },
  );
  assert.ok([302, 303].includes(refused.status()));
  assert.equal((await anonymous.get('/api/game')).status(), 401);
  const expiredState = await request.newContext({
    baseURL: base,
    storageState: {
      cookies: [
        {
          name: 'next-auth.state',
          value: await encode({
            secret,
            salt: 'next-auth.state',
            token: {
              value: authUrl.searchParams.get('state'),
              provider: 'discord',
            },
            maxAge: -60,
          }),
          domain: '127.0.0.1',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  });
  contexts.push(expiredState);
  const expiredCallback = await expiredState.get(
    '/api/auth/callback/discord?' +
      new URLSearchParams({
        code: 'synthetic-only',
        state: authUrl.searchParams.get('state')!,
      }),
    { maxRedirects: 0 },
  );
  assert.ok([302, 303].includes(expiredCallback.status()));
  assert.equal((await expiredState.get('/api/game')).status(), 401);
  pass(
    'CSRF, state, minimal scope, callback URL, cookies, denial and external redirect protections',
  );
  stage =
    'HTTP sessions and game isolation using locally generated test JWE cookies';
  assert.equal((await anonymous.post('/api/summon-preview')).status(), 410);
  pass('removed public preview returns HTTP 410');
  const ca = await context(a),
    cb = await context(b);
  stage = 'session A endpoint identity';
  const sessionResponse = await ca.get('/api/auth/session');
  assert.equal((await sessionResponse.json()).user.id, a);
  const sessionCookie = sessionResponse
    .headersArray()
    .find(
      (h) =>
        h.name.toLowerCase() === 'set-cookie' &&
        h.value.startsWith('next-auth.session-token='),
    );
  assert.ok(sessionCookie);
  assert.match(sessionCookie.value, /HttpOnly/i);
  assert.match(sessionCookie.value, /SameSite=Lax/i);
  assert.match(sessionCookie.value, /Path=\//i);
  const persisted = (await ca.storageState()).cookies.find(
    (c) => c.name === 'next-auth.session-token',
  );
  assert.ok(persisted && persisted.expires > Date.now() / 1000 + 29 * 86400);
  const reopened = await request.newContext({
    baseURL: base,
    storageState: await ca.storageState(),
  });
  contexts.push(reopened);
  assert.equal(
    (await (await reopened.get('/api/auth/session')).json()).user.id,
    a,
  );
  pass(
    'persistent 30-day session cookie survives a new browser context and retains the verified identity',
  );
  stage = 'session B endpoint identity';
  assert.equal((await (await cb.get('/api/auth/session')).json()).user.id, b);
  stage = 'private financial audit HTTP permissions';
  assert.equal((await cb.get('/api/admin/wallet-logs')).status(), 403);
  const walletAuditResponse = await ca.get(
    `/api/admin/wallet-logs?player=${b}`,
  );
  assert.equal(walletAuditResponse.status(), 200);
  assert.match(walletAuditResponse.headers()['cache-control'], /no-store/);
  assert.ok(
    (await walletAuditResponse.json()).entries.every(
      (entry: { playerId: string }) => entry.playerId === b,
    ),
  );
  pass(
    'financial audit endpoint restricted to staff with private responses and player filter',
  );
  stage = 'player B initial balance';
  assert.match(
    (await cb.get('/api/game')).headers()['cache-control'],
    /no-store/,
  );
  assert.equal((await (await cb.get('/api/game')).json()).state.munny, 0);
  stage =
    'HTTP staff denial, authenticated directory and published-only calendar';
  assert.equal((await anonymous.get('/api/admin')).status(), 401);
  assert.equal((await cb.get('/api/admin')).status(), 403);
  assert.equal(
    (
      await cb.post('/api/admin', {
        headers: { Origin: base },
        data: {
          action: 'resources.adjust',
          target: b,
          resource: 'munny',
          delta: 999,
          key: randomUUID(),
          reason: 'Unauthorized test',
        },
      })
    ).status(),
    403,
  );
  assert.equal((await anonymous.get('/api/players?q=HTTP')).status(), 401);
  const directory = await cb.get(`/api/players?q=${a}`);
  assert.equal(directory.status(), 200);
  assert.equal((await directory.json())[0].id, a);
  assert.match(directory.headers()['cache-control'], /no-store/);
  assert.equal((await ca.get('/api/admin')).status(), 200);
  for (const published of [true, false]) {
    const response = await ca.post('/api/admin', {
      headers: { Origin: base },
      data: {
        action: 'event.save',
        key: randomUUID(),
        reason: 'Recette HTTP isolée',
        title: published ? 'Visible' : 'Draft',
        description: 'Isolated HTTP calendar test',
        startsAt: '2026-10-29T00:00:00Z',
        endsAt: '2026-10-30T00:00:00Z',
        published,
      },
    });
    assert.equal(response.status(), 200);
  }
  const publicEvents = await (await anonymous.get('/api/events')).json();
  assert.equal(publicEvents.length, 1);
  assert.equal(publicEvents[0].title, 'Visible');
  pass(
    'HTTP staff access denied for regular players, authorized admin calendar creation, private directory and drafts excluded from public API',
  );
  stage = 'authenticated daily claim';
  const dailyResponse = await mutation(ca, 'daily');
  stage = `authenticated daily claim (HTTP ${dailyResponse.status()})`;
  if (dailyResponse.status() !== 200)
    throw new Error(`Daily status ${dailyResponse.status()}`);
  assert.equal((await (await cb.get('/api/game')).json()).state.munny, 0);
  const summonKey = randomUUID();
  stage = 'authenticated concurrent summon';
  const pair = await Promise.all([
    mutation(ca, 'summon', { mode: 'single' }, summonKey),
    mutation(ca, 'summon', { mode: 'single' }, summonKey),
  ]);
  assert.ok(pair.every((r) => r.status() === 200));
  const acquisition = await pair[0].json();
  stage = 'persisted copies and cross-account ownership';
  const copy = acquisition.copies[0];
  assert.equal(
    (await (await ca.get('/api/game')).json()).state.copies.length,
    5,
  );
  assert.equal(
    (await mutation(cb, 'recycle', { copyId: copy.id })).status(),
    400,
  );
  let t = await trade(ca, 'invite', undefined, { target: b });
  t = await trade(cb, 'accept', t);
  t = await trade(ca, 'offer', t, { copies: [copy.id] });
  t = await trade(ca, 'lock', t);
  t = await trade(cb, 'lock', t);
  t = await trade(ca, 'confirm', t);
  t = await trade(cb, 'confirm', t);
  assert.equal(t.state.status, 'completed');
  const reconnected = await context(a);
  assert.equal(
    (await (await reconnected.get('/api/game')).json()).state.copies.length,
    4,
  );
  assert.equal(
    (await (await cb.get('/api/game')).json()).state.copies[0].id,
    copy.id,
  );
  pass(
    'encrypted HTTP sessions, two-player isolation, authenticated summon, concurrent replay, transfer and reconnect persistence (synthetic identities only)',
  );
  stage = 'expired, tampered and logged-out HTTP sessions';
  const beforeRemoved = (await (await cb.get('/api/game')).json()).state;
  for (const mode of ['free', 'trial'])
    assert.equal((await mutation(cb, 'summon', { mode })).status(), 400);
  assert.deepEqual(
    (await (await cb.get('/api/game')).json()).state,
    beforeRemoved,
  );
  assert.equal(
    (await mutation(anonymous, 'summon', { mode: 'trial' })).status(),
    401,
  );
  pass(
    'authenticated free/trial openings rejected without state changes; anonymous summon remains protected',
  );
  await pool.query(
    'UPDATE "Player" SET state=jsonb_set(state,\'{moderation}\',$2::jsonb) WHERE id=$1',
    [
      b,
      JSON.stringify({
        suspended: true,
        reason: 'Isolated test',
        actor: a,
        updatedAt: new Date().toISOString(),
      }),
    ],
  );
  assert.equal((await cb.get('/api/game')).status(), 403);
  assert.equal((await anonymous.get(`/profile/${b}`)).status(), 404);
  assert.equal((await cb.get('/api/economy')).status(), 403);
  assert.equal((await mutation(cb, 'daily')).status(), 403);
  assert.equal((await cb.get('/api/trades')).status(), 403);
  assert.equal((await cb.get('/api/players?q=HTTP')).status(), 403);
  await pool.query(
    'UPDATE "Player" SET state=state-\'moderation\' WHERE id=$1',
    [b],
  );
  assert.equal((await cb.get('/api/game')).status(), 200);
  assert.equal(
    (
      await mutation(cb, 'wishlist', { cardId: 'KH-001', wanted: true })
    ).status(),
    200,
  );
  assert.deepEqual((await (await cb.get('/api/game')).json()).state.wishlist, [
    'KH-001',
  ]);
  const publicProfile = await anonymous.get(`/profile/${b}`);
  assert.equal(publicProfile.status(), 200);
  const profileHtml = await publicProfile.text();
  assert.ok(
    profileHtml.includes('Wishlist') &&
      profileHtml.includes('/cards/KH-001') &&
      profileHtml.includes('Cartes favorites'),
  );
  pass(
    'wishlist persisted through authenticated HTTP and visible on public collector profile; suspended profile returns 404',
  );
  const showcaseState = (
    await pool.query('SELECT state FROM "Player" WHERE id=$1', [b])
  ).rows[0].state;
  assert.ok(showcaseState.copies.length > 0);
  showcaseState.copies[0] = {
    ...showcaseState.copies[0],
    favorite: true,
    level: 7,
    awakening: 2,
  };
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    b,
    JSON.stringify(showcaseState),
  ]);
  const showcaseHtml = await (await anonymous.get(`/profile/${b}`)).text();
  const showcaseText = showcaseHtml.replace(/<[^>]*>/g, '');
  assert.match(showcaseText, /Nv\.\s*7/);
  assert.match(showcaseText, /Éveil\s*2\/5/);
  pass('public showcase renders the actual owned level and awakening');
  pass(
    'suspension enforced against existing HTTP sessions on game, mutations, trades and player directory; restored access after lifting',
  );
  const expired = await context(a, -60),
    tampered = await context(undefined, 3600, 'invalid.token'),
    invalidIdentity = await context('not-a-discord-id');
  for (const c of [expired, tampered, invalidIdentity]) {
    assert.equal((await c.get('/api/game')).status(), 401);
    assert.equal((await mutation(c, 'daily')).status(), 401);
    assert.equal((await c.get('/api/trades')).status(), 401);
    assert.equal((await c.get('/api/economy')).status(), 401);
  }
  assert.equal((await anonymous.get('/api/economy')).status(), 401);
  const economyKey = randomUUID();
  const claim = { key: economyKey, kind: 'bonus', payload: { type: 'hourly' } };
  assert.equal(
    (
      await cb.post('/api/economy', {
        data: claim,
        headers: { Origin: 'https://foreign.invalid' },
      })
    ).status(),
    403,
  );
  const walletBefore = (await (await cb.get('/api/economy')).json()).wallet;
  const claimResults = await Promise.all(
    Array.from({ length: 4 }, () =>
      cb.post('/api/economy', { data: claim, headers: { Origin: base } }),
    ),
  );
  claimResults.forEach((response) => assert.equal(response.status(), 200));
  assert.equal(
    (await (await cb.get('/api/economy')).json()).wallet,
    walletBefore + 1000,
  );
  assert.equal(
    (await (await cb.get('/api/game')).json()).state.munny,
    walletBefore + 1000,
  );
  pass(
    'authenticated economy HTTP: shared wallet, same-origin rejection, concurrent claim replay, anonymous and suspended access denied',
  );
  assert.equal((await mutation(anonymous, 'daily')).status(), 401);
  const logoutCsrf = (await (await ca.get('/api/auth/csrf')).json()).csrfToken;
  await ca.post('/api/auth/signout', {
    form: { csrfToken: logoutCsrf, callbackUrl: '/dashboard', json: 'true' },
  });
  assert.equal((await ca.get('/api/game')).status(), 401);
  pass(
    'expired/tampered tokens, unauthenticated mutations and sign-out rejected by actual HTTP handlers',
  );
  stage = 'no synthetic profiles introduced into application schema';
  assert.deepEqual(
    (
      await admin.query(
        'SELECT id,name,state FROM "Player" WHERE id=ANY($1::text[]) ORDER BY id',
        [[a, b]],
      )
    ).rows,
    originalPlayers,
  );
  await writeFile(
    'docs/AUTH_AUTOMATED_RESULTS.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        method:
          'isolated HTTP server + temporary PostgreSQL schema + synthetic callbacks and encrypted test cookies',
        realDiscordLoginTested: false,
        realDiscordAccountsUsed: 0,
        checks,
        productionPlayersModified: 0,
        gameplayRulesModified: false,
      },
      null,
      2,
    ) + '\n',
  );
} catch {
  // Never dump response headers, cookies, OAuth URLs, tokens or server output.
  throw new Error(
    `Authentication test failed at stage: ${stage}. No sensitive diagnostics printed.`,
  );
} finally {
  for (const c of contexts) await c.dispose();
  if (server?.pid) {
    if (process.platform === 'win32')
      await new Promise<void>((resolve) => {
        const killer = spawn(
          'taskkill',
          ['/PID', String(server!.pid), '/T', '/F'],
          { stdio: 'ignore', windowsHide: true },
        );
        killer.on('close', () => resolve());
        killer.on('error', () => resolve());
      });
    else {
      server.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (server!.exitCode !== null) resolve();
        else server!.once('exit', () => resolve());
      });
    }
  }
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
