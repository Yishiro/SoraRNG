import { test, expect } from '@playwright/test';
for (const [name, width, height] of [
  ['desktop', 1440, 1100],
  ['mobile', 375, 812],
] as const) {
  test(`collection frames and protected references on ${name}`, async ({
    page,
    request,
  }) => {
    const catalog = await (await request.get('/api/catalog')).json();
    const copies = [
      {
        id: 'qa-copy-1',
        cardId: 'KH-001',
        holo: false,
        level: 1,
        awakening: 0,
        locked: false,
        favorite: false,
      },
      {
        id: 'qa-copy-2',
        cardId: 'KH-001',
        holo: false,
        level: 1,
        awakening: 0,
        locked: false,
        favorite: false,
      },
      {
        id: 'qa-copy-3',
        cardId: 'KH-001',
        holo: true,
        level: 1,
        awakening: 0,
        locked: false,
        favorite: false,
      },
      {
        id: 'qa-copy-4',
        cardId: 'KH-001',
        holo: false,
        level: 20,
        awakening: 0,
        locked: false,
        favorite: false,
      },
    ];
    // UI-only fixture: real catalogue, synthetic copies. No session bypass or DB mutation.
    await page.route('**/api/game', (route) =>
      route.fulfill({
        json: {
          id: 'qa',
          name: 'QA',
          cards: catalog.cards,
          history: [],
          state: {
            munny: 0,
            tickets: 0,
            fragments: 0,
            freeAt: 0,
            daily: '',
            copies,
            summons: 4,
            claimed: [],
            reducedMotion: true,
            discoveries: ['KH-001'],
            holoDiscoveries: ['KH-001'],
          },
        },
      }),
    );
    const externalImages: string[] = [];
    page.on('request', (r) => {
      if (
        r.resourceType() === 'image' &&
        !new URL(r.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)
      )
        externalImages.push(r.url());
    });
    await page.setViewportSize({ width, height });
    await page.goto('/collection');
    await expect(page.locator('.illustrated-card')).toHaveCount(3);
    await expect(page.locator('.illustrated-card.holo')).toHaveCount(1);
    await expect(page.locator('.illustrated-card img')).toHaveCount(3);
    await expect
      .poll(() =>
        page
          .locator('.illustrated-card img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await expect(page.getByText(/×2 · Éveil 0/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(externalImages).toEqual([]);
    await page.screenshot({
      path: `docs/assets/collection-${name}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Gérer un exemplaire' })
      .first()
      .click();
    await expect(page.getByText('Exemplaire qa-copy-1')).toBeVisible();
  });
}
