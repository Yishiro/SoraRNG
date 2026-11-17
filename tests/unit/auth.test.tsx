// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import type { NextAuthOptions } from 'next-auth';
import { encode, decode } from 'next-auth/jwt';
import { randomBytes } from 'node:crypto';
const persist = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../src/server/players', () => ({ ensurePlayer: persist }));
import { authOptions } from '../../src/server/auth';
import {
  AuthenticationRequired,
  discordId,
  safeAuthRedirect,
  sameAuthOrigin,
} from '../../src/server/auth-policy';
import { authApiError } from '../../src/server/auth-api-errors';
import { authMessage } from '../../src/game/auth-messages';
type Callbacks = NonNullable<NextAuthOptions['callbacks']>;
type SignInArgs = Parameters<NonNullable<Callbacks['signIn']>>[0];
type JwtArgs = Parameters<NonNullable<Callbacks['jwt']>>[0];
type SessionArgs = Parameters<NonNullable<Callbacks['session']>>[0];
const a = '900000000000000001',
  b = '900000000000000002';
afterEach(() => {
  vi.restoreAllMocks();
  persist.mockClear();
});
test('association OAuth uniquement Discord, id Discord identique dans compte et profil', async () => {
  const input = {
    user: { id: a, name: 'Voyageur' },
    account: { provider: 'discord', type: 'oauth', providerAccountId: a },
    profile: { id: a },
  } as SignInArgs;
  expect(await authOptions.callbacks!.signIn!(input)).toBe(true);
  expect(persist).toHaveBeenCalledWith(a, 'Voyageur');
  expect(
    await authOptions.callbacks!.signIn!({
      ...input,
      profile: { id: b },
    } as SignInArgs),
  ).toBe(false);
  expect(
    await authOptions.callbacks!.signIn!({
      ...input,
      account: { ...input.account, provider: 'other' },
    } as SignInArgs),
  ).toBe(false);
  expect(persist).toHaveBeenCalledTimes(1);
});
test('échec de création du joueur bloque la connexion sans exposer la cause SQL', async () => {
  persist.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_DETAIL'));
  await expect(
    authOptions.callbacks!.signIn!({
      user: { id: a, name: 'A' },
      account: { provider: 'discord', type: 'oauth', providerAccountId: a },
      profile: { id: a },
    } as SignInArgs),
  ).rejects.toThrow('PROFILE_CREATION_FAILED');
});
test('identité de session immuable lors des mises à jour client', async () => {
  const token = await authOptions.callbacks!.jwt!({
    token: { discordId: a },
    user: { id: a },
    account: null,
    trigger: 'update',
    session: { user: { id: b } },
  } as JwtArgs);
  expect(token.discordId).toBe(a);
  const session = await authOptions.callbacks!.session!({
    session: { user: { name: 'A' }, expires: '2099-01-01' },
    token,
  } as SessionArgs);
  expect((session.user as { id?: string }).id).toBe(a);
  expect(session).not.toHaveProperty('access_token');
  await expect(
    authOptions.callbacks!.jwt!({
      token: {},
      account: { provider: 'other', providerAccountId: a },
    } as JwtArgs),
  ).rejects.toThrow('INVALID_DISCORD_IDENTITY');
});
test('JWE : expiration, altération et mauvais secret sont rejetés', async () => {
  const secret = randomBytes(32).toString('hex');
  const token = await encode({ secret, token: { discordId: a }, maxAge: 3600 });
  expect((await decode({ secret, token }))?.discordId).toBe(a);
  await expect(
    decode({ secret: randomBytes(32).toString('hex'), token }),
  ).rejects.toThrow();
  await expect(
    decode({ secret, token: token.slice(0, -8) + 'aaaaaaaa' }),
  ).rejects.toThrow();
  const expired = await encode({
    secret,
    token: { discordId: a },
    maxAge: -60,
  });
  await expect(decode({ secret, token: expired })).rejects.toThrow();
});
test('redirections bornées à l’origine et identifiants stricts', () => {
  const base = 'http://localhost:3000';
  expect(safeAuthRedirect('/dashboard', base)).toBe(base + '/dashboard');
  for (const url of [
    'https://evil.example',
    '//evil.example',
    'javascript:alert(1)',
    'http://localhost:3000.evil.example',
  ])
    expect([base, base + '/']).toContain(safeAuthRedirect(url, base));
  expect(discordId(a)).toBe(true);
  expect(discordId('test-user')).toBe(false);
  expect(discordId(900000000000000001)).toBe(false);
});
test('origine canonique OAuth prise en compte même si Next reconstruit une URL interne', () => {
  const url = 'http://localhost:3100/api/game',
    canonical = 'http://127.0.0.1:3100';
  expect(
    sameAuthOrigin(
      new Request(url, { headers: { origin: canonical } }),
      canonical,
    ),
  ).toBe(true);
  for (const origin of [
    'https://evil.example',
    'null',
    'http://127.0.0.1:3101',
    canonical + '/unexpected',
  ])
    expect(
      sameAuthOrigin(new Request(url, { headers: { origin } }), canonical),
    ).toBe(false);
  expect(sameAuthOrigin(new Request(url), canonical)).toBe(false);
});
test('journal OAuth expurgé et erreurs API différenciées', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  authOptions.logger!.error!('OAUTH_CALLBACK_ERROR', {
    error: new Error('PRIVATE_METADATA'),
    secret: 'PRIVATE_TOKEN',
  });
  expect(log).toHaveBeenCalledWith('[auth]', 'OAUTH_CALLBACK_ERROR');
  expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_TOKEN');
  expect(authApiError(new AuthenticationRequired()).status).toBe(401);
  const error = authApiError(
    Object.assign(new Error('PRIVATE_SQL'), { code: 'ECONNREFUSED' }),
  );
  expect(error.status).toBe(503);
  expect(await error.text()).not.toContain('PRIVATE_SQL');
  expect(authMessage('untrusted-url-or-secret')).not.toContain(
    'untrusted-url-or-secret',
  );
  expect(typeof authMessage('__proto__')).toBe('string');
});
