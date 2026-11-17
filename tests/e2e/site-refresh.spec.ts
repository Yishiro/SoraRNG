import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
for (const width of [1280, 375])
  test(`compact member home and collection legends (${width})`, async ({
    page,
  }) => {
    const state = {
      ...initialPlayer(),
      munny: 25000,
      summons: 5,
      discoveries: ['KH-001'],
      copies: cards.slice(0, 6).map((c, i) => ({
        id: `compact-${i}`,
        cardId: c.id,
        holo: i === 0,
        level: 7,
        awakening: 2,
        locked: false,
        favorite: true,
      })),
    };
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/game', (r) =>
      r.fulfill({
        json: {
          id: 'compact-user',
          name: 'Collectionneur',
          state,
          cards,
          history: [],
          missions: [],
        },
      }),
    );
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/recent-drops', (r) =>
      r.fulfill({ json: { drops: [] } }),
    );
    await page.route('**/api/notifications', (r) =>
      r.fulfill({ json: { items: [], unread: 0 } }),
    );
    await page.route('**/api/listed-cards', (r) => r.fulfill({ json: [] }));
    await page.goto('/dashboard');
    await expect(page.locator('.member-home')).toBeVisible();
    await expect(page.locator('.hero')).toHaveCount(0);
    expect(
      await page
        .locator('#wallet')
        .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(800);
    await page.screenshot({
      path: `.local/refreshed-home-${width}.png`,
      fullPage: true,
    });
    await page.goto('/collection');
    await expect(page.locator('.cards-grid .game-card')).toHaveCount(6);
    await expect(page.locator('.cards-grid .card-legend-preview')).toHaveCount(
      0,
    );
    await page.screenshot({
      path: `.local/refreshed-collection-${width}.png`,
      fullPage: true,
    });
    await page.getByText('Plus de filtres et d’options').click();
    await page
      .getByRole('checkbox', { name: 'Afficher les légendes dans la grille' })
      .check();
    await expect(page.locator('.cards-grid .card-legend-preview')).toHaveCount(
      6,
    );
    await page.reload();
    await page.getByText('Plus de filtres et d’options').click();
    await expect(
      page.getByRole('checkbox', {
        name: 'Afficher les légendes dans la grille',
      }),
    ).toBeChecked();
    await page
      .getByRole('checkbox', { name: 'Afficher les légendes dans la grille' })
      .uncheck();
    await page.locator('.cards-grid .card-face').first().click();
    await expect(
      page.locator('.collection-detail .detail-legend'),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
test('a pending action belongs to its original player only', async ({
  page,
}) => {
  let user = 'first-user',
    writes = 0;
  await page.route('**/api/game', (r) => {
    if (r.request().method() === 'POST') {
      writes++;
      return r.abort('failed');
    }
    return r.fulfill({
      json: {
        id: user,
        name: user,
        state: { ...initialPlayer(), munny: 10000, reducedMotion: true },
        cards,
        history: [],
        missions: [],
      },
    });
  });
  await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
  await page.route('**/api/notifications', (r) =>
    r.fulfill({ json: { items: [], unread: 0 } }),
  );
  await page.goto('/summon');
  await page
    .getByRole('button', { name: 'Ouvrir mon sachet', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reprendre l’opération' }),
  ).toBeVisible();
  user = 'second-user';
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Ouvrir mon sachet', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Reprendre l’opération' }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
  user = 'first-user';
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Reprendre l’opération' }),
  ).toBeVisible();
  expect(writes).toBe(1);
});
