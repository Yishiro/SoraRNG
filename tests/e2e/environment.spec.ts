import { test, expect } from '@playwright/test';
test('game sanctuary responds', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Collection Kingdom Hearts',
  );
});

test('Discord stays disabled until configured', async ({ request }) => {
  const response = await request.get('/api/auth/providers');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({});
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
  await expect(page.getByText('0,2 %', { exact: true })).toBeVisible();
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
  ).toContainText('1,315789');
});
