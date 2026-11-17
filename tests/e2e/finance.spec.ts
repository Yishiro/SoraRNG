import { test, expect } from '@playwright/test';
import { initialPlayer } from '../../src/game/core';
for (const width of [1440, 375]) {
  test(`shared finance panel works at ${width}px (UI fixture)`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const catalog = await (await request.get('/api/catalog')).json();
    let player = { ...initialPlayer(), munny: 5000 };
    await page.route('**/api/game', (route) =>
      route.fulfill({
        json: {
          id: 'qa',
          name: 'QA',
          cards: catalog.cards,
          history: [],
          missions: [],
          state: player,
        },
      }),
    );
    await page.route('**/api/economy', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.kind).toBe('deposit');
      expect(body.payload.amount).toBe('1000');
      player = {
        ...player,
        munny: 4000,
        finance: {
          claims: {},
          bank: { micros: '1000000000', at: Date.now() },
          reserved: 0,
          liability: 0,
        },
      };
      await route.fulfill({
        json: { kind: 'deposit', wallet: 4000, amount: 1000, bank: '1000' },
      });
    });
    await page.goto('/dashboard');
    const panel = page.locator('.finance-panel');
    await expect(panel.getByRole('button', { name: /Réclamer/ })).toHaveCount(
      4,
    );
    await panel.getByLabel('Montant bancaire').fill('1000');
    await panel.getByRole('button', { name: 'Déposer', exact: true }).click();
    await expect(
      panel.locator('.finance-balances > div').first().locator('strong'),
    ).toHaveText(/4\s000 Munny/);
    await expect(
      panel.locator('.finance-balances > div').nth(1).locator('strong'),
    ).toHaveText(/1\s000 Munny/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/finance-${width}.png`,
      fullPage: true,
    });
  });
}
