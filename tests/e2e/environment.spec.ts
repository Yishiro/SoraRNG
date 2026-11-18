import { test, expect } from '@playwright/test';
import { holoRate, rates } from '../../src/game/config';

const percent = (value: number, digits = 2) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })} %`;
test('game sanctuary responds', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Collection Kingdom Hearts',
  );
});

test('Discord stays disabled until configured', async ({ request }) => {
  const response = await request.get('/api/auth/providers');
  expect(response.ok()).toBeTruthy();
  // Le fournisseur n'apparaît que si des identifiants Discord sont configurés
  // (la CI en définit des factices ; un poste vierge n'en a pas).
  const configured = Boolean(
    process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET,
  );
  const providers = await response.json();
  if (configured) expect(Object.keys(providers)).toEqual(['discord']);
  else expect(providers).toEqual({});
});
test('landing page fits a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('summon requires login and rates are transparent', async ({ page }) => {
  await page.goto('/summon');
  await expect(
    page.getByRole('button', { name: 'Ouvrir mon sachet' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /10 boosters/ }).click();
  await expect(
    page.getByRole('button', { name: 'Ouvrir mes 10 boosters' }),
  ).toBeDisabled();
  // Taux affichés = configuration actuelle (finition holographique incluse).
  await expect(
    page.getByText(`${percent(holoRate / 100)} de finition holographique`, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText(/catalogue de référence/)).toHaveCount(0);
  await expect(page.getByText('38 cartes éligibles')).toBeVisible();
});
test('API requires identity and same origin', async ({ request }) => {
  expect((await request.get('/api/game')).status()).toBe(401);
  expect(
    (await request.post('/api/game', { data: { kind: 'daily' } })).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/trades', { data: { action: 'invite' } })
    ).status(),
  ).toBe(403);
});
test('navigation and collection empty state', async ({ page }) => {
  await page.goto('/collection');
  await expect(
    page.getByRole('heading', { name: 'Retrouvez votre collection' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Boutique', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Le comptoir des voyageurs' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '10 fragments' }),
  ).toBeDisabled();
});

test('real catalogue and card details are available', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/catalog');
  expect(response.ok()).toBeTruthy();
  const catalog = await response.json();
  expect(catalog.cards).toHaveLength(150);
  expect(new Set(catalog.cards.map((c: { id: string }) => c.id)).size).toBe(
    150,
  );
  expect(catalog.holoRate).toBe(0.004);
  expect(
    catalog.probabilities.reduce(
      (sum: number, c: { probability: number }) => sum + c.probability,
      0,
    ),
  ).toBeCloseTo(1, 10);
  await page.goto('/codex');
  await expect(
    page.getByRole('heading', { name: 'Sora', exact: true }).first(),
  ).toBeVisible();
  await page.goto('/cards/KH-001');
  await expect(
    page.getByRole('heading', { name: 'Sora', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/Probabilité individuelle standard/),
  ).toContainText(
    // Sora est Commun : taux Commun réparti sur les 38 cartes communes.
    (rates[0] / 100 / 38).toLocaleString('fr-FR', {
      maximumFractionDigits: 6,
    }),
  );
});
