import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
for (const width of [1280, 375])
  test(`recent drops accessible card feed (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/game', (r) =>
      r.fulfill({ status: 401, json: { error: 'Connexion requise' } }),
    );
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/recent-drops', (r) =>
      r.fulfill({
        json: {
          drops: [
            {
              id: 'opening:1',
              playerName: 'Alice',
              card: cards.find((c) => c.rarity === 'Secret'),
              holo: true,
              openedAt: '2026-11-03T20:42:00.000Z',
            },
          ],
        },
      }),
    );
    await page.goto('/codex');
    const feed = page.getByRole('region', { name: 'Derniers gros drops' });
    await expect(feed).toBeVisible();
    await expect(
      feed.getByRole('button').filter({ hasText: 'Alice' }),
    ).toHaveCount(1);
    await expect(feed).toContainText('03/11/2026 21:42');
    await feed.hover();
    await feed.getByRole('button').filter({ hasText: 'Alice' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Carte découverte' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Fermer la fiche' }).click();
    if (width > 700) {
      await feed
        .getByRole('button', { name: 'Suspendre le défilement' })
        .click();
      await expect(feed).toHaveClass(/is-paused/);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
