import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer, type Player } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
import { emptyActivity, questStatus } from '../../src/game/quests';

const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);

for (const width of [1280, 375]) {
  test(`quêtes réclamables et fusion d'un doublon (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const busy = { ...emptyActivity(), boosters: 99, cards: 999 };
    const quests = questStatus([], busy, emptyActivity());
    const base = {
      cardId: cards[0].id,
      holo: false,
      level: 1,
      awakening: 0,
      locked: false,
      favorite: false,
    };
    const player: Player = {
      ...initialPlayer(),
      munny: 10000,
      copies: [
        { ...base, id: 'target', level: 5 },
        { ...base, id: 'duplicate' },
      ],
    };
    const posts: { kind: string; payload: Record<string, unknown> }[] = [];
    await page.route('**/api/game', (route) => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON());
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({
        json: {
          id: '100000000000000001',
          name: 'Test',
          state: player,
          cards,
          history: [],
          missions: [],
          quests,
        },
      });
    });
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/notifications', (r) =>
      r.fulfill({ json: { items: [], unread: 0 } }),
    );
    await page.route('**/api/listed-cards', (r) => r.fulfill({ json: [] }));
    await page.route('**/api/recent-drops', (r) =>
      r.fulfill({ json: { drops: [] } }),
    );

    await page.goto('/missions');
    await expect(page.getByRole('heading', { name: 'Quêtes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Journalières/ })).toBeVisible();
    const claim = page.getByRole('button', { name: 'Réclamer' }).first();
    await claim.click();
    await expect
      .poll(() => posts.find((p) => p.kind === 'quest')?.payload)
      .toMatchObject({ cycle: 'daily' });
    await page.getByRole('tab', { name: /Hebdomadaires/ }).click();
    await expect(page.locator('.quest-list li')).not.toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Succès' })).toBeVisible();

    await page.goto('/collection');
    await page.locator('.cards-grid .card-face').first().click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { name: 'Statistiques de combat' }),
    ).toBeVisible();
    await dialog
      .getByRole('button', { name: 'Fusionner pour 500 Munny' })
      .click();
    await expect
      .poll(() => posts.find((p) => p.kind === 'fuse')?.payload)
      .toEqual({ copyId: 'target', duplicateId: 'duplicate' });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
