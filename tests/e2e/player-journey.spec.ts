import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { initialPlayer } from '../../src/game/core';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(readFileSync('data/kingdom_hearts_catalogue_150.json', 'utf8')),
  ).cards,
);
for (const width of [1280, 375]) {
  test(`guided start, notification privacy and collection clarity (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let connected = false,
      read = false;
    const state = { ...initialPlayer() };
    const copy = {
      id: 'qa-copy',
      cardId: 'KH-001',
      holo: false,
      level: 1,
      awakening: 0,
      locked: false,
      favorite: false,
    };
    await page.route('**/api/auth/providers', (r) =>
      r.fulfill({ json: { discord: { id: 'discord' } } }),
    );
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/game', (r) => {
      if (!connected)
        return r.fulfill({ status: 401, json: { error: 'Connexion requise' } });
      if (r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        if (body.kind === 'daily') {
          state.munny = 5000;
          state.finance = {
            claims: { daily: Date.now() },
            bank: { micros: '0', at: Date.now() },
            reserved: 0,
            liability: 0,
          };
        }
        if (body.kind === 'settings')
          state.auctionNotifications = body.payload.auctionNotifications;
        return r.fulfill({ json: {} });
      }
      return r.fulfill({
        json: { id: 'qa', name: 'QA', cards, state, history: [], missions: [] },
      });
    });
    await page.route('**/api/notifications', (r) => {
      if (r.request().method() === 'POST') read = true;
      return r.fulfill({
        json: {
          unread: read ? 0 : 1,
          items: [
            {
              id: '0123456789abcdef01234567',
              kind: 'sold',
              payload: { copy, amount: 2500 },
              createdAt: new Date().toISOString(),
              readAt: read ? new Date().toISOString() : null,
            },
          ],
        },
      });
    });
    await page.route('**/api/listed-cards', (r) =>
      r.fulfill({
        json: [
          {
            id: 'lot-qa',
            sellerId: 'qa',
            copy: { ...copy, id: 'listed-copy' },
            status: 'open',
            startPrice: 800,
            bid: 0,
            bidderId: null,
            endsAt: new Date(Date.now() + 3600000).toISOString(),
          },
        ],
      }),
    );
    await page.route('**/api/card-sales?**', (r) =>
      r.fulfill({ json: { stats: [], sales: [] } }),
    );
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', {
        name: 'Collection Kingdom Hearts',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('.stats-grid')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Trois étapes pour commencer.' }),
    ).toBeVisible();
    await page.screenshot({
      path: `.local/guided-home-${width}.png`,
      fullPage: true,
    });
    await expect(
      page.getByRole('button', { name: 'Réclamer mon bonus quotidien' }),
    ).toBeDisabled();
    connected = true;
    await page.goto('/collection');
    await expect(
      page.getByRole('heading', { name: 'Mes cartes aux enchères' }),
    ).toBeVisible();
    await expect(page.locator('.listed-card')).toHaveCount(1);
    await expect(
      page.locator('.listed-card .card-face[role="button"]'),
    ).toHaveCount(0);
    await page.goto('/dashboard');
    await page
      .getByRole('button', { name: 'Réclamer mon bonus quotidien' })
      .click();
    await expect(
      page.getByRole('link', { name: 'Choisir mon booster' }),
    ).toBeVisible();
    await page.goto('/settings');
    const block = page.getByRole('checkbox', {
      name: 'Bloquer les messages privés Discord',
    });
    await block.check();
    await expect(block).toBeChecked();
    await expect(block).toBeEnabled();
    expect(state.auctionNotifications).toBe(false);
    await page
      .getByRole('button', { name: /Notifications · 1 non lues/ })
      .click();
    const inbox = page.getByRole('dialog', { name: 'Vos notifications' });
    await expect(inbox.getByText('Votre carte a été vendue')).toBeVisible();
    await inbox.getByRole('button', { name: 'Tout marquer comme lu' }).click();
    await expect(
      inbox.getByText('0 non lue(s)', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(block).toBeChecked();
    state.copies = [copy];
    await page.goto('/collection');
    await page
      .getByRole('button', {
        name: 'Ouvrir Sora · Îles du Destin',
        exact: true,
      })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Exemplaire · Sora' });
    await expect(
      dialog.getByRole('button', { name: 'Recycler cet exemplaire' }),
    ).toHaveCount(0);
    await dialog.getByText('Améliorer cet exemplaire', { exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Passer au niveau suivant' }),
    ).toBeVisible();
    await expect(dialog.getByText(/ne modifient ni la rareté/)).toBeVisible();
    await page.screenshot({ path: `.local/clear-card-${width}.png` });
    await page.keyboard.press('Escape');
    if (width === 375)
      await page.getByRole('button', { name: 'Tous les menus' }).click();
    await expect(page.getByRole('link', { name: /Classements/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Événements/ })).toBeVisible();
    if (width === 375) await page.keyboard.press('Escape');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
