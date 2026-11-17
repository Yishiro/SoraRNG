import { test, expect } from '@playwright/test';
test('personal Codex preserves past discoveries, hides unknowns and separates holographics', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/api/catalog')).json();
  await page.route('**/api/game', (route) =>
    route.fulfill({
      json: {
        id: 'qa',
        name: 'QA',
        cards: catalog.cards,
        history: [],
        missions: [],
        state: {
          munny: 0,
          tickets: 0,
          fragments: 0,
          freeAt: 0,
          daily: '',
          copies: [],
          summons: 1,
          claimed: [],
          reducedMotion: true,
          discoveries: ['KH-001'],
          holoDiscoveries: [],
        },
      },
    }),
  );
  await page.goto('/codex');
  await expect(
    page.getByText('DÉCOUVERTES PERSONNELLES', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.unknown-card')).toHaveCount(149);
  await expect(page.locator('.illustrated-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Holographiques', exact: true })
    .click();
  await expect(page.locator('.unknown-card')).toHaveCount(150);
  await page
    .getByRole('button', { name: 'Afficher le catalogue complet' })
    .click();
  await expect(page.locator('.illustrated-card.holo')).toHaveCount(150);
  await page.getByLabel('Origine du Codex').selectOption('KH1');
  await expect(page.locator('.illustrated-card')).toHaveCount(
    catalog.cards.filter((c: { origin: string }) => c.origin === 'KH1').length,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.local/card-assets/qa/codex-progress-mobile.png',
    fullPage: true,
  });
});
test('missions use server eligibility and show each reset cycle', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/api/catalog')).json();
  await page.route('**/api/game', (route) =>
    route.fulfill({
      json: {
        id: 'qa',
        name: 'QA',
        cards: catalog.cards,
        history: [],
        missions: [
          {
            id: 'daily-three',
            progress: 3,
            claimable: true,
            claimed: false,
            resetsAt: '2026-10-29T00:00:00Z',
          },
        ],
        state: {
          munny: 0,
          tickets: 0,
          fragments: 0,
          freeAt: 0,
          daily: '',
          copies: [],
          summons: 3,
          claimed: [],
          reducedMotion: true,
          discoveries: [],
          holoDiscoveries: [],
        },
      },
    }),
  );
  await page.goto('/missions');
  await expect(
    page.getByRole('heading', { name: 'Quotidiennes', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hebdomadaires', exact: true }),
  ).toBeVisible();
  const daily = page.locator('.mission-row').filter({
    has: page.getByRole('heading', { name: 'Trois portes aujourd’hui' }),
  });
  await expect(daily.getByRole('button', { name: 'Récupérer' })).toBeEnabled();
  const completed = page.getByRole('region', { name: 'Quêtes terminées' });
  await expect(
    completed.getByRole('heading', { name: 'Trois portes aujourd’hui' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Quêtes en cours' })
      .getByRole('heading', { name: 'Trois portes aujourd’hui' }),
  ).toHaveCount(0);
  const weekly = page.locator('.mission-row').filter({
    has: page.getByRole('heading', { name: 'Une semaine de rencontres' }),
  });
  await expect(
    weekly.getByRole('button', { name: 'Récupérer' }),
  ).toBeDisabled();
});
