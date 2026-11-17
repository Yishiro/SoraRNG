import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
const id = '900000000000000001',
  target = '900000000000000002';
for (const width of [1280, 375])
  test(`staff wallet audit and session renewal (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let sessionReads = 0;
    await page.route('**/api/auth/session', (r) => {
      sessionReads++;
      return r.fulfill({
        json: { user: { id, name: 'Staff' }, expires: '2099-01-01' },
      });
    });
    await page.route('**/api/game', (r) =>
      r.fulfill({
        json: {
          id,
          name: 'Staff',
          staffRole: 'admin',
          state: initialPlayer(),
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
    await page.route('**/api/admin', (r) =>
      r.fulfill({
        json: {
          role: 'admin',
          totals: { players: 1, copies: 0 },
          players: [
            {
              id: target,
              name: 'Alice',
              munny: '0',
              tickets: '0',
              fragments: '0',
              copies: 0,
              moderation: null,
            },
          ],
          events: [],
          audit: [],
          nextCursor: null,
        },
      }),
    );
    let params = new URLSearchParams();
    const amounts = {
      wallet: 0,
      bankMicros: '43500000000',
      reserved: 15000,
      liability: 0,
    };
    await page.route('**/api/admin/wallet-logs?**', (r) => {
      params = new URL(r.request().url()).searchParams;
      return r.fulfill({
        json: {
          player: { id: target, name: 'Alice', amounts },
          entries: [
            {
              id: '1',
              playerId: target,
              playerName: 'Alice',
              source: 'economy',
              kind: 'deposit',
              actorId: target,
              reference: 'deposit-123',
              before: { ...amounts, wallet: 43500, bankMicros: '0' },
              after: amounts,
              createdAt: '2026-11-03T12:08:31Z',
            },
          ],
          nextCursor: params.has('cursor') ? null : 'older',
        },
      });
    });
    await page.goto('/admin');
    await expect.poll(() => sessionReads).toBeGreaterThanOrEqual(1);
    await page
      .locator('.admin-player-row')
      .getByRole('button', { name: 'Logs Munny' })
      .click();
    const panel = page.locator('.wallet-log-panel');
    await expect(
      panel.getByRole('heading', { name: 'Alice · Situation actuelle' }),
    ).toBeVisible();
    await expect(panel.getByLabel('Joueur', { exact: true })).toHaveValue(
      target,
    );
    await panel.locator('summary').click();
    await expect(panel).toContainText('Dépôt en banque');
    await expect(panel).toContainText('43 500');
    await panel.getByLabel('Mouvement du portefeuille').selectOption('debit');
    await panel
      .getByRole('button', { name: 'Rechercher', exact: true })
      .click();
    await expect.poll(() => params.get('direction')).toBe('debit');
    await panel
      .getByRole('button', { name: 'Mouvements plus anciens' })
      .click();
    await expect.poll(() => params.get('cursor')).toBe('older');
    await panel
      .getByRole('combobox', { name: 'Journal', exact: true })
      .selectOption('legacy');
    await panel
      .getByRole('button', { name: 'Rechercher', exact: true })
      .click();
    await expect(panel).toContainText('parfois reconstitués');
    await page.screenshot({
      path: `.local/wallet-logs-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
test('wallet logs API rejects unauthenticated access', async ({ request }) => {
  const response = await request.get('/api/admin/wallet-logs');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
});
