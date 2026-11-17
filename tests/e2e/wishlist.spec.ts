import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
test('wishlist is editable, persistent after reload and fits mobile (UI fixture)', async ({
  page,
}) => {
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ json: { cards } }),
  );
  let state = initialPlayer();
  await page.route('**/api/game', async (route) => {
    if (route.request().method() === 'POST') {
      const action = route.request().postDataJSON();
      expect(action.kind).toBe('wishlist');
      state = {
        ...state,
        wishlist: action.payload.wanted ? [action.payload.cardId] : [],
      };
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({
      json: { id: 'qa', name: 'QA', state, cards, history: [], missions: [] },
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/codex');
  await page.getByLabel('Rechercher pour la wishlist').fill(cards[0].id);
  await page
    .locator('.wishlist-panel')
    .getByRole('button', { name: 'Ajouter', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: `Retirer ${cards[0].name} de la wishlist`,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator('.wishlist-panel')
      .getByRole('link', { name: 'Voir les offres' }),
  ).toHaveAttribute('href', `/trade?card=${cards[0].id}`);
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: `Retirer ${cards[0].name} de la wishlist`,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `Retirer ${cards[0].name} de la wishlist` })
    .click();
  await expect(page.locator('.wishlist-panel')).toContainText(
    'Ajoutez votre première carte',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
