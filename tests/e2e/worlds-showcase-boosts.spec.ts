import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer, type Player } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
import { worlds } from '../../src/game/worlds';

const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
const playerId = '100000000000000001';
const otherId = '100000000000000002';

test('carnet, vitrine ordonnée et boost holographique sur mobile', async ({
  page,
}) => {
  const player: Player = {
    ...initialPlayer(),
    munny: 5000,
    discoveries: [...worlds[0].cards],
    copies: cards.slice(0, 2).map((card, index) => ({
      id: `copy-${index}`,
      cardId: card.id,
      holo: index === 1,
      level: 1,
      awakening: 0,
      locked: false,
      favorite: false,
    })),
  };
  await page.setViewportSize({ width: 375, height: 900 });
  await page.route('**/api/game', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (body.kind === 'showcase') player.showcase = body.payload.copies;
      if (body.kind === 'shop' && body.payload.item === 'boost-holo') {
        player.munny -= 1000;
        player.boost = { kind: 'holo', expiresAt: Date.now() + 30 * 60000 };
      }
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({
      json: {
        id: playerId,
        name: 'Test',
        state: player,
        cards,
        history: [],
        missions: [],
      },
    });
  });
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ json: { cards } }),
  );
  await page.route('**/api/notifications', (route) =>
    route.fulfill({ json: { items: [], unread: 0 } }),
  );
  await page.route('**/api/listed-cards', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/worlds');
  await expect(
    page.getByText(/Îles du Destin · 7\/7 · Insigne obtenu/),
  ).toBeVisible();
  await page.goto('/collection');
  await page.getByText('Personnaliser ma vitrine', { exact: true }).click();
  const editor = page.locator('.showcase-editor');
  for (const id of ['copy-0', 'copy-1']) {
    await editor.getByLabel('Exemplaire à exposer').selectOption(id);
    await editor.getByRole('button', { name: 'Ajouter à la vitrine' }).click();
  }
  await editor.getByRole('button', { name: 'Monter la carte 2' }).click();
  await editor.getByRole('button', { name: 'Enregistrer la vitrine' }).click();
  await expect.poll(() => player.showcase).toEqual(['copy-1', 'copy-0']);
  await page.reload();
  await page.getByText('Personnaliser ma vitrine', { exact: true }).click();
  await expect(editor.locator('li').first()).toContainText(
    `Vedette · ${cards[1].name}`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto('/shop');
  const holo = page.getByRole('button', { name: 'Activer pour 1 000 Munny' });
  await holo.click();
  await expect(holo).toBeDisabled();
  await expect(
    page.getByText(/Reflet holographique actif encore/),
  ).toBeVisible();
  await page.goto('/summon');
  await expect(
    page.getByText(/0,45 % de finition holographique/),
  ).toBeVisible();
});

test('échange direct depuis une invitation avec révision et deux lots', async ({
  page,
}) => {
  const copy = {
    id: 'trade-copy',
    cardId: 'KH-001',
    holo: false,
    level: 1,
    awakening: 0,
    locked: false,
    favorite: false,
  };
  const otherCopy = { ...copy, id: 'other-copy', cardId: 'KH-002', holo: true };
  const trade = {
    id: '10000000-0000-4000-8000-000000000001',
    a: otherId,
    b: playerId,
    aName: 'Ami',
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    state: {
      status: 'invited',
      revision: 0,
      offers: { [otherId]: [otherCopy], [playerId]: [] as (typeof copy)[] },
      locked: [] as string[],
      confirmed: [] as string[],
    },
  };
  await page.route('**/api/game', (route) =>
    route.fulfill({
      json: {
        id: playerId,
        name: 'Test',
        state: { ...initialPlayer(), copies: [copy] },
        cards,
        history: [],
        missions: [],
      },
    }),
  );
  await page.route('**/api/catalog', (route) =>
    route.fulfill({ json: { cards } }),
  );
  await page.route('**/api/notifications', (route) =>
    route.fulfill({ json: { items: [], unread: 0 } }),
  );
  await page.route('**/api/trades', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.revision).toBe(trade.state.revision);
      if (body.action === 'accept') trade.state.status = 'open';
      if (body.action === 'offer') {
        expect(body.copies).toEqual([copy.id]);
        trade.state.offers[playerId] = [copy];
      }
      if (body.action === 'lock') trade.state.locked = [playerId];
      trade.state.revision++;
      return route.fulfill({ json: trade });
    }
    return route.fulfill({ json: [trade] });
  });
  await page.goto('/exchanges');
  await page.getByRole('button', { name: 'Accepter', exact: true }).click();
  await page
    .getByRole('spinbutton', { name: /Quantité Sora standard/ })
    .fill('1');
  await page.getByRole('button', { name: 'Proposer la sélection (1)' }).click();
  await expect(
    page.getByText(/Votre offre.*Sora.*Îles du Destin/),
  ).toBeVisible();
  await expect(
    page.getByText(/Offre reçue.*Riku.*Holographique/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Verrouiller l’offre' }).click();
  await expect(
    page.getByRole('button', { name: 'Confirmer le transfert' }),
  ).toBeDisabled();
});
