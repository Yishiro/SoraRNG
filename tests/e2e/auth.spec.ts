import { test, expect } from '@playwright/test';
for (const status of [401, 403])
  test(`rejected action ${status} clears private UI data`, async ({
    page,
    request,
  }) => {
    const catalog = await (await request.get('/api/catalog')).json();
    await page.route('**/api/game', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status,
            json: {
              error:
                status === 403
                  ? 'Ce compte est suspendu.'
                  : 'Connexion Discord requise',
            },
          })
        : route.fulfill({
            json: {
              id: '900000000000000001',
              name: 'Auth UI fixture',
              cards: catalog.cards,
              history: [],
              missions: [],
              state: {
                munny: 0,
                tickets: 0,
                fragments: 0,
                freeAt: 0,
                daily: '',
                copies: [],
                summons: 0,
                claimed: [],
                reducedMotion: true,
                discoveries: [],
                holoDiscoveries: [],
              },
            },
          }),
    );
    await page.goto('/dashboard');
    const claim = page.getByRole('button', {
      name: 'Réclamer mon bonus quotidien',
      exact: true,
    });
    await expect(claim).toBeEnabled();
    await claim.click();
    await expect(page.getByRole('status')).toContainText(
      status === 403
        ? 'Ce compte est suspendu.'
        : 'Votre session est absente ou a expiré',
    );
    // Sans session, le bouton reste visible mais inactif.
    await expect(claim).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Connexion Discord', exact: true }),
    ).toBeVisible();
  });
test('auth errors are understandable and never echo arbitrary query content', async ({
  page,
}) => {
  await page.goto('/auth/error?error=OAuthCallback');
  await expect(page.locator('p[role="alert"]')).toContainText(
    'Le retour de Discord',
  );
  await page.goto('/auth/error?error=PRIVATE_QUERY_CONTENT');
  await expect(page.locator('p[role="alert"]')).toContainText(
    'La connexion a échoué',
  );
  await expect(page.locator('main')).not.toContainText('PRIVATE_QUERY_CONTENT');
  await page.goto('/auth/error?error=__proto__');
  await expect(
    page.getByRole('heading', { name: 'Retrouver votre royaume' }),
  ).toBeVisible();
});
test('missing and tampered sessions are rejected on actual private API routes', async ({
  request,
  baseURL,
}) => {
  const providers = await (await request.get('/api/auth/providers')).json();
  const headers = {
    origin: providers.discord
      ? new URL(providers.discord.signinUrl).origin
      : new URL(baseURL!.replace('127.0.0.1', 'localhost')).origin,
    cookie: 'next-auth.session-token=invalid.token',
  };
  expect((await request.get('/api/game', { headers })).status()).toBe(401);
  expect((await request.get('/api/trades', { headers })).status()).toBe(401);
  expect((await request.get('/api/auctions', { headers })).status()).toBe(401);
  expect((await request.get('/api/notifications', { headers })).status()).toBe(
    401,
  );
  expect((await request.get('/api/listed-cards', { headers })).status()).toBe(
    401,
  );
  expect(
    (
      await request.post('/api/notifications', { headers, data: { all: true } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/notifications', {
        headers: { origin: 'https://foreign.invalid' },
        data: { all: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/auctions', {
        headers,
        data: { action: 'sync', key: 'invalid' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/auctions', {
        headers: { origin: 'https://foreign.invalid' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/game', {
        headers,
        data: { kind: 'daily', key: 'not-important' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/trades', { headers, data: { action: 'invite' } })
    ).status(),
  ).toBe(401);
});
test('local auth CSRF cookie retains HttpOnly and SameSite protection', async ({
  request,
}) => {
  const response = await request.get('/api/auth/csrf');
  expect(response.ok()).toBeTruthy();
  const cookies = response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
    .join(';');
  expect(cookies).toMatch(/HttpOnly/i);
  expect(cookies).toMatch(/SameSite=Lax/i);
});
