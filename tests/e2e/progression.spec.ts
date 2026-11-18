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
    await dialog.getByRole('tab', { name: /Fusion/ }).click();
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

test('atelier : plusieurs niveaux d’un coup et recyclage groupé confirmé', async ({
  page,
}) => {
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
    fragments: 50,
    copies: [
      { ...base, id: 'best', level: 4, locked: true },
      { ...base, id: 'spare-1' },
      { ...base, id: 'spare-2' },
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
        quests: [],
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
  await page.goto('/collection');
  await page.getByText('Atelier de recyclage').click();
  await expect(page.getByText('+10 fragments')).toBeVisible();
  const recycle = page.getByRole('button', { name: 'Recycler la sélection' });
  await recycle.click();
  expect(posts.find((p) => p.kind === 'recycle-many')).toBeUndefined();
  await page
    .getByRole('button', { name: 'Confirmer : détruire 2 exemplaires' })
    .click();
  await expect
    .poll(() => posts.find((p) => p.kind === 'recycle-many')?.payload)
    .toEqual({ copyIds: ['spare-1', 'spare-2'] });

  await page.locator('.cards-grid .card-face').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Un niveau de plus' }).click();
  await dialog.getByRole('button', { name: 'Un niveau de plus' }).click();
  await dialog.getByRole('button', { name: 'Monter au niveau 7' }).click();
  await expect
    .poll(() => posts.find((p) => p.kind === 'upgrade')?.payload)
    .toEqual({ copyId: 'best', levels: 3 });
});

test('série de connexion, guilde et annonce payante confirmée', async ({
  page,
}) => {
  const player: Player = { ...initialPlayer(), munny: 20000 };
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
        quests: [],
      },
    });
  });
  await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
  await page.route('**/api/notifications', (r) =>
    r.fulfill({ json: { items: [], unread: 0 } }),
  );
  await page.route('**/api/recent-drops', (r) =>
    r.fulfill({ json: { drops: [] } }),
  );
  await page.route('**/api/guilds', (r) =>
    r.fulfill({ json: { guilds: [], mine: null } }),
  );
  await page.route('**/api/announcements', (r) =>
    r.fulfill({ json: { announcements: [] } }),
  );
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Réclamer 500 Munny' }).click();
  await expect.poll(() => posts.some((p) => p.kind === 'streak')).toBe(true);

  await page.goto('/guild');
  await page.getByLabel('Nom de la guilde').fill('Les Gardiens');
  await page.getByRole('button', { name: 'Fonder pour 10 000 Munny' }).click();
  await expect
    .poll(() => posts.find((p) => p.kind === 'guild-create')?.payload)
    .toEqual({ name: 'Les Gardiens' });

  await page.goto('/board');
  await page.getByLabel('Texte de l’annonce').fill('Je cherche Sora holo');
  await page.getByRole('button', { name: 'Publier l’annonce' }).click();
  expect(posts.some((p) => p.kind === 'announce')).toBe(false);
  await page
    .getByRole('button', { name: 'Confirmer : payer 500 Munny' })
    .click();
  await expect
    .poll(() => posts.find((p) => p.kind === 'announce')?.payload)
    .toEqual({ kind: 'seek', text: 'Je cherche Sora holo', cardIds: [] });
});
