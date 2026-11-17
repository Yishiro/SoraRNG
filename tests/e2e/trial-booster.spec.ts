import { test, expect } from '@playwright/test';
import { initialPlayer } from '../../src/game/core';
for (const connected of [false, true]) {
  test(`free boosters removed (${connected ? 'connected fixture' : 'anonymous'})`, async ({
    page,
    request,
  }) => {
    if (connected) {
      const catalog = await (await request.get('/api/catalog')).json();
      await page.route('**/api/game', (route) =>
        route.fulfill({
          json: {
            id: 'qa',
            name: 'QA',
            cards: catalog.cards,
            history: [],
            missions: [],
            state: { ...initialPlayer(), munny: 1000, tickets: 1 },
          },
        }),
      );
    }
    await page.goto('/summon');
    await expect(page.locator('.pack-mode')).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: /booster de test|sachet offert/i }),
    ).toHaveCount(0);
    await expect(page.locator('.trial-booster-banner')).toHaveCount(0);
    expect((await request.post('/api/summon-preview')).status()).toBe(410);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/no-free-boosters-${connected}.png`,
      fullPage: true,
    });
  });
}
