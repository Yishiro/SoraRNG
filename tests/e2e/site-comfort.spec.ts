import { test, expect } from '@playwright/test';
import { initialPlayer } from '../../src/game/core';

test('mobile quick navigation and drawer keep focus and restore scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  const dock = page.getByRole('navigation', { name: 'Navigation rapide' });
  await expect(
    dock.getByRole('link', { name: 'Accueil', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByLabel('Aperçu de la collection : Riku, Sora et Kairi'),
  ).toBeVisible();
  await expect(page.locator('.portal-scene')).toHaveCount(0);
  for (const [name, id] of [
    ['Riku', 'KH-002'],
    ['Sora', 'KH-001'],
    ['Kairi', 'KH-003'],
  ]) {
    const portrait = page.getByRole('img', { name, exact: true });
    await expect(portrait).toHaveAttribute('src', `/assets/cards/${id}.webp`);
    await expect
      .poll(() =>
        portrait.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }

  await dock.getByRole('button', { name: 'Tous les menus' }).click();
  await expect(page.locator('#game-navigation')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe('hidden');
  const first = page.locator('#game-navigation a').first();
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#game-navigation a').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-navigation')).toBeHidden();
  await expect(
    dock.getByRole('button', { name: 'Tous les menus' }),
  ).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .not.toBe('hidden');
  await dock.getByRole('link', { name: 'Cartes', exact: true }).click();
  await expect(page).toHaveURL(/collection$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Navigation rapide' })
      .getByRole('link', { name: 'Cartes', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('collection filters match the same copy and can be reset', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/api/catalog')).json();
  const state = {
    ...initialPlayer(),
    copies: [
      {
        id: 'holo-only',
        cardId: 'KH-001',
        holo: true,
        favorite: false,
        level: 1,
        awakening: 0,
        locked: false,
      },
      {
        id: 'favorite-only',
        cardId: 'KH-001',
        holo: false,
        favorite: true,
        level: 1,
        awakening: 0,
        locked: false,
      },
    ],
  };
  await page.route('**/api/game', (route) =>
    route.fulfill({
      json: {
        id: '900000000000000001',
        name: 'Collection QA',
        state,
        cards: catalog.cards,
        history: [],
      },
    }),
  );
  await page.goto('/collection');
  const results = page.locator('.collection-results');
  await expect(results).toContainText('1 modèle · 2 exemplaires affichés');
  await page
    .getByRole('textbox', { name: 'Rechercher une carte' })
    .fill('kh-001');
  await expect(results).toContainText('1 modèle');
  await page
    .getByRole('checkbox', { name: 'Holographiques', exact: true })
    .check();
  await page.getByRole('checkbox', { name: 'Favoris', exact: true }).check();
  await expect(
    page.getByRole('heading', { name: 'Aucune carte ne correspond' }),
  ).toBeVisible();
  await expect(results).toContainText('0 modèle · 0 exemplaire affiché');
  await page
    .getByRole('button', { name: 'Effacer les filtres', exact: true })
    .click();
  await expect(results).toContainText('1 modèle · 2 exemplaires affichés');
  await expect(
    page.getByRole('textbox', { name: 'Rechercher une carte' }),
  ).toHaveValue('');
  await expect(
    page.getByRole('checkbox', { name: 'Favoris', exact: true }),
  ).not.toBeChecked();
});
