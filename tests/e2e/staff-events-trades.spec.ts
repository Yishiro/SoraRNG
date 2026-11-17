import { test, expect } from '@playwright/test';
import { initialPlayer } from '../../src/game/core';
const a = '900000000000000001',
  b = '900000000000000002';
test('staff UI submits reasoned adjustments and moderator cannot see finance actions', async ({
  page,
  request,
}) => {
  const catalog = await (await request.get('/api/catalog')).json();
  await page.route('**/api/game', (r) =>
    r.fulfill({
      json: {
        id: a,
        name: 'QA staff',
        staffRole: 'admin',
        cards: catalog.cards,
        history: [],
        missions: [],
        state: initialPlayer(),
      },
    }),
  );
  const data = {
    role: 'admin',
    totals: { players: 1, copies: 0 },
    players: [
      {
        id: b,
        name: 'Joueur de recette',
        munny: '0',
        tickets: '0',
        fragments: '0',
        copies: 0,
        moderation: null,
      },
    ],
    nextCursor: null,
    events: [],
    audit: [],
  };
  let last: Record<string, unknown> = {};
  await page.route('**/api/admin**', (r) => {
    if (r.request().method() === 'POST') {
      last = r.request().postDataJSON();
      return r.fulfill({
        json: { before: { munny: 0 }, after: { munny: 100 } },
      });
    }
    return r.fulfill({ json: data });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Gérer', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Gestion du joueur' });
  await dialog
    .getByLabel('Motif obligatoire')
    .fill('Correction de recette locale');
  await dialog.getByLabel('Variation (positive ou négative)').fill('100');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Appliquer l’ajustement' }).click();
  await expect.poll(() => last.action).toBe('resources.adjust');
  expect(last).toMatchObject({
    target: b,
    resource: 'munny',
    delta: 100,
    reason: 'Correction de recette locale',
  });
  expect(last.key).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.getByRole('status')).toContainText('Action enregistrée');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Navigation', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Navigation', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Fermer la navigation' }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.screenshot({
    path: '.local/card-assets/qa/admin-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  data.role = 'moderator';
  await page.reload();
  await page.getByRole('button', { name: 'Gérer', exact: true }).click();
  await expect(page.getByLabel('Ressource', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Suspendre le compte' }),
  ).toBeVisible();
});
test('rankings and events show construction screens without loading feature APIs', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (
      /^\/api\/(trades|leaderboards|events)(?:[/?]|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      calls.push(request.url());
  });
  for (const section of ['leaderboards', 'events']) {
    await page.goto(`/${section}`);
    await expect(
      page.getByRole('heading', { name: 'En construction', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Retour à l’Accueil' }),
    ).toHaveAttribute('href', '/dashboard');
    await expect(
      page.getByRole('button', { name: 'Accepter', exact: true }),
    ).toHaveCount(0);
  }
  expect(calls).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('protected administration still fails closed', async ({ page }) => {
  await page.route('**/api/admin', (r) =>
    r.fulfill({ status: 403, json: { error: 'Accès interdit' } }),
  );
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Administration protégée' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Appliquer l’ajustement' }),
  ).toHaveCount(0);
});

test('authenticated adventure journal appears on the home page only', async ({
  page,
}) => {
  await page.route('**/api/game', (route) =>
    route.fulfill({
      json: {
        id: a,
        name: 'Journal QA',
        state: initialPlayer(),
        cards: [],
        missions: [],
        history: [
          {
            kind: 'daily',
            delta: 2000,
            createdAt: '2026-10-29T12:00:00Z',
            result: {},
          },
        ],
      },
    }),
  );
  for (const section of [
    'dashboard',
    'summon',
    'collection',
    'codex',
    'upgrade',
    'shop',
    'missions',
    'settings',
    'trade',
    'leaderboards',
    'events',
  ]) {
    await page.goto(`/${section}`);
    await expect(
      page.getByRole('button', { name: 'Déconnexion', exact: true }),
    ).toBeVisible();
    const journal = page.getByRole('heading', {
      name: 'Journal de votre aventure',
      exact: true,
    });
    if (section === 'dashboard') await expect(journal).toBeVisible();
    else await expect(journal).toHaveCount(0);
  }
});
