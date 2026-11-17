import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
test.use({ timezoneId: 'Europe/Paris' });
for (const width of [1280, 375]) {
  test(`collection filters, progression and opening summary (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const c = (
      id: string,
      cardId = 'KH-001',
      level = 1,
      awakening = 0,
      holo = false,
    ) => ({
      id,
      cardId,
      level,
      awakening,
      holo,
      favorite: false,
      locked: false,
    });
    const soraVariant = cards.find(
      (x) => x.name === 'Sora' && x.id !== 'KH-001',
    )!;
    const state = {
      ...initialPlayer(),
      munny: 1000,
      reducedMotion: true,
      summons: 5,
      copies: [
        c('a'),
        c('b', 'KH-001', 12, 2, true),
        c('r', 'KH-002', 20, 5),
        c('variant', soraVariant.id, 5, 1),
      ],
      discoveries: ['KH-001', 'KH-002', soraVariant.id],
    };
    const results = [
      c('draw-0'),
      c('draw-1', 'KH-001', 1, 0, true),
      c('draw-2', 'KH-005'),
      c('draw-3', 'KH-005'),
      c('draw-4', 'KH-005'),
    ];
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/game', (r) => {
      if (r.request().method() === 'POST') {
        state.copies.push(...results);
        state.munny = 0;
        return r.fulfill({ json: { copies: results } });
      }
      return r.fulfill({
        json: { id: 'qa', name: 'QA', state, cards, history: [], missions: [] },
      });
    });
    await page.route('**/api/notifications', (r) =>
      r.fulfill({ json: { items: [], unread: 0 } }),
    );
    await page.route('**/api/listed-cards', (r) => r.fulfill({ json: [] }));
    await page.route('**/api/card-sales?**', (r) =>
      r.fulfill({
        json: {
          stats: [
            { holo: false, count: 1, average: 900, minimum: 900, maximum: 900 },
            {
              holo: true,
              count: 50,
              average: 2500,
              minimum: 1000,
              maximum: 4000,
            },
          ],
          sales: [],
        },
      }),
    );
    await page.goto('/collection');
    await expect(
      page.getByText('Exemplaire accompli', { exact: true }),
    ).toBeVisible();
    await page.getByText('Plus de filtres et d’options').click();
    await page.getByRole('checkbox', { name: 'Doublons uniquement' }).check();
    await expect(page.locator('.cards-grid .game-card')).toHaveCount(2);
    await page.getByLabel('Niveau minimum', { exact: true }).fill('10');
    await page
      .getByRole('combobox', { name: 'Éveil minimum' })
      .selectOption('1');
    await expect(page.locator('.cards-grid .game-card')).toHaveCount(1);
    await expect(page.locator('.cards-grid .game-card')).toHaveAttribute(
      'data-card-id',
      'KH-001',
    );
    await page
      .getByRole('button', { name: 'Réinitialiser les filtres' })
      .click();
    await page
      .getByRole('combobox', { name: 'Affichage', exact: true })
      .selectOption('character');
    await expect(page.locator('.character-groups > section')).toHaveCount(2);
    await page
      .getByRole('button', {
        name: 'Ouvrir Sora · Îles du Destin',
        exact: true,
      })
      .first()
      .click();
    const cardDialog = page.getByRole('dialog', { name: 'Exemplaire · Sora' });
    await cardDialog
      .getByRole('button', { name: 'Mettre aux enchères', exact: true })
      .click();
    await expect(
      cardDialog.getByText('Référence unique', { exact: true }),
    ).toBeVisible();
    await expect(
      cardDialog.getByText('Historique étoffé', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/summon');
    await page.getByRole('button', { name: 'Ouvrir mon sachet' }).click();
    const reveal = page.getByRole('dialog', {
      name: 'Résultats de votre invocation',
    });
    await expect(reveal.getByLabel('Bilan de l’ouverture')).toHaveCount(0);
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
    const summary = reveal.getByLabel('Bilan de l’ouverture');
    await expect(summary).toBeVisible();
    await expect(summary.locator('.opening-summary-stats strong')).toHaveText([
      '5',
      '1',
      '4',
      '1',
    ]);
    await summary
      .getByText('Voir le détail des cartes reçues', { exact: true })
      .click();
    await page.screenshot({ path: `.local/opening-summary-${width}.png` });
    await summary
      .getByRole('link', { name: 'Gérer / vendre →', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Exemplaire · Sora' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test('admin contrast, preview, retry idempotence and local event dates', async ({
  page,
}) => {
  const state = initialPlayer();
  const player = {
    id: '900000000000000002',
    name: 'Joueur QA',
    munny: '200',
    tickets: '2',
    fragments: '10',
    copies: 4,
    moderation: null,
  };
  const event = {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Rencontre des mondes',
    description: 'Une rencontre de collectionneurs.',
    startsAt: '2026-11-10T10:00:00.000Z',
    endsAt: '2026-11-10T12:00:00.000Z',
    published: false,
    revision: 1,
  };
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/game', (r) =>
    r.fulfill({
      json: {
        id: 'owner-qa',
        name: 'Owner QA',
        staffRole: 'admin',
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
  await page.route('**/api/admin**', (r) => {
    if (r.request().method() === 'POST') {
      requests.push(r.request().postDataJSON());
      return r.fulfill({
        status: requests.length === 1 ? 503 : 200,
        json: requests.length === 1 ? { error: 'Incident temporaire' } : {},
      });
    }
    return r.fulfill({
      json: {
        role: 'admin',
        totals: { players: 1, copies: 4 },
        players: [player],
        nextCursor: null,
        events: [event],
        audit: [],
      },
    });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Gérer', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Gestion du joueur' });
  await dialog
    .getByLabel('Motif obligatoire')
    .fill('Correction de recette isolée');
  await dialog.getByLabel('Variation (positive ou négative)').fill('-201');
  await expect(
    dialog.getByRole('button', { name: 'Appliquer l’ajustement' }),
  ).toBeDisabled();
  await expect(
    dialog.getByText('Le solde ne peut pas devenir négatif.'),
  ).toBeVisible();
  await dialog.getByLabel('Variation (positive ou négative)').fill('50');
  await expect(dialog.locator('.admin-balance-preview')).toContainText('250');
  const select = dialog.getByRole('combobox', {
    name: 'Ressource',
    exact: true,
  });
  expect(
    await select.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgb(37, 37, 37)');
  expect(
    await select
      .locator('option')
      .first()
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe('rgb(238, 234, 225)');
  await page.screenshot({ path: '.local/admin-contrast-preview.png' });
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Appliquer l’ajustement' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Incident temporaire');
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: 'Appliquer l’ajustement' }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests[0].key).toBe(requests[1].key);
  await page.getByRole('button', { name: 'Événements', exact: true }).click();
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(page.getByLabel('Début (heure locale)')).toHaveValue(
    '2026-11-10T11:00',
  );
  await page
    .getByLabel('Motif de l’intervention')
    .fill('Correction du calendrier de test');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].startsAt).toBe(event.startsAt);
  expect(requests[2].endsAt).toBe(event.endsAt);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
