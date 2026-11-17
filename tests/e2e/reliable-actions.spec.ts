import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
for (const failure of ['network', '503'])
  test(`opening resumes after ${failure} and reload without paying twice`, async ({
    page,
  }) => {
    const state = { ...initialPlayer(), munny: 10000, reducedMotion: true };
    const copies = cards.slice(0, 5).map((c, i) => ({
      id: 'retry-copy-' + i,
      cardId: c.id,
      holo: false,
      level: 1,
      awakening: 0,
      locked: false,
      favorite: false,
    }));
    const requests: { key: string }[] = [];
    let committed = false;
    await page.route('**/api/game', (r) => {
      if (r.request().method() === 'POST') {
        requests.push(r.request().postDataJSON());
        if (!committed) {
          committed = true;
          state.munny -= 1000;
          state.copies = copies;
          state.discoveries = copies.map((c) => c.cardId);
          return failure === 'network'
            ? r.abort('failed')
            : r.fulfill({
                status: 503,
                json: { error: 'Réponse interrompue' },
              });
        }
        return r.fulfill({ json: { copies } });
      }
      return r.fulfill({
        json: {
          id: 'retry-user',
          name: 'Test',
          state,
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
    await expect(
      page.getByText('✧ 0,4 % de finition holographique'),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Ouvrir mon sachet', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Reprendre l’opération', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ouvrir mon sachet', exact: true }),
    ).toBeDisabled();
    await page.reload();
    await page
      .getByRole('button', { name: 'Reprendre l’opération', exact: true })
      .click();
    const reveal = page.getByRole('dialog', {
      name: 'Résultats de votre invocation',
    });
    await expect(reveal).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0].key).toBe(requests[1].key);
    expect(state.munny).toBe(9000);
    for (let i = 0; i < 5; i++) {
      await reveal
        .getByRole('button', {
          name: `Retourner la carte ${i + 1}`,
          exact: true,
        })
        .click();
      if (i < 4)
        await reveal
          .getByRole('button', { name: 'Suivante', exact: true })
          .click();
    }
    await expect(reveal.locator('.opening-summary-stats strong')).toHaveText([
      '5',
      '5',
      '0',
      '0',
    ]);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('sorarng.pending-action.v1:retry-user'),
      ),
    ).toBeNull();
  });
test('bank retry preserves its original amount, key and account after reload', async ({
  page,
}) => {
  const state = {
    ...initialPlayer(),
    munny: 10000,
    summons: 5,
    finance: {
      claims: { hourly: Date.now() },
      bank: { micros: '0', at: Date.now() },
      reserved: 0,
      liability: 0,
    },
  };
  const requests: { key: string; payload: unknown }[] = [];
  await page.route('**/api/game', (r) =>
    r.fulfill({
      json: {
        id: 'bank-user',
        name: 'Test',
        state,
        cards,
        history: [],
        missions: [],
      },
    }),
  );
  await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
  await page.route('**/api/notifications', (r) =>
    r.fulfill({ json: { items: [], unread: 0 } }),
  );
  await page.route('**/api/economy', (r) => {
    requests.push(r.request().postDataJSON());
    if (requests.length === 1) {
      state.munny = 9000;
      state.finance.bank.micros = '1000000000';
      return r.fulfill({ status: 503, json: { error: 'Résultat incertain' } });
    }
    return r.fulfill({ json: { amount: 1000, wallet: 9000, bank: '1000' } });
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/dashboard');
  expect(
    await page
      .locator('#wallet')
      .evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(1000);
  await expect(page.locator('.finance-bonuses')).not.toContainText(/\d{5} j/);
  await page.getByLabel('Montant bancaire').fill('1000');
  await page.getByRole('button', { name: 'Déposer', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reprendre l’opération', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Reprendre l’opération', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('1 000 Munny déposés');
  expect(requests[0]).toEqual(requests[1]);
  expect(state.munny).toBe(9000);
  await page.screenshot({
    path: '.local/reliability-home-375.png',
    fullPage: true,
  });
});
