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
  test(`collection listing and collector auction market (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const copy = {
      id: 'fixture-copy',
      cardId: 'KH-001',
      holo: true,
      level: 7,
      awakening: 2,
      favorite: false,
      locked: false,
    };
    await page.route('**/api/game', (r) =>
      r.fulfill({
        json: {
          id: 'qa',
          name: 'QA',
          cards,
          history: [],
          missions: [],
          state: { ...initialPlayer(), munny: 10000, copies: [copy] },
        },
      }),
    );
    await page.route('**/api/catalog', (r) => r.fulfill({ json: { cards } }));
    await page.route('**/api/listed-cards', (r) => r.fulfill({ json: [] }));
    await page.route('**/api/notifications', (r) =>
      r.fulfill({ json: { items: [], unread: 0 } }),
    );
    await page.route('**/api/card-sales?**', (r) =>
      r.fulfill({
        json: {
          stats: [
            {
              holo: false,
              count: 2,
              average: 1000,
              minimum: 500,
              maximum: 1500,
            },
            {
              holo: true,
              count: 1,
              average: 2500,
              minimum: 2500,
              maximum: 2500,
            },
          ],
          sales: [
            {
              id: 'sale-1',
              price: 2500,
              holo: true,
              level: 1,
              awakening: 0,
              endedAt: new Date().toISOString(),
            },
          ],
        },
      }),
    );
    let last: Record<string, unknown> = {};
    const models = [
      cards[0],
      cards.find((c) => c.rarity === 'Légendaire')!,
      cards.find((c) => c.rarity === 'Mythique')!,
      cards.find((c) => c.rarity === 'Rare')!,
      cards.find((c) => c.rarity === 'Épique')!,
      cards.find((c) => c.rarity === 'Secret')!,
    ];
    await page.route(/\/api\/auctions(?:\?|$)/, (r) => {
      if (r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        if (body.action !== 'sync') last = body;
        return r.fulfill({ json: { ok: true } });
      }
      const rows = models.map((model, i) => ({
        id: `10000000-0000-4000-8000-00000000000${i + 1}`,
        sellerId: i === 2 ? 'qa' : 'other',
        sellerName: i === 2 ? 'QA' : 'Collectionneur',
        copy: {
          ...copy,
          id: `market-copy-${i}`,
          cardId: model.id,
          holo: i % 2 === 0,
        },
        startPrice: 1000,
        bid: 1200 + i * 500,
        bidderId: i === 1 ? 'qa' : 'third',
        bidderName: 'Autre joueur',
        hasBid: i === 0 || i === 1,
        status: 'open',
        endsAt: new Date(Date.now() + 1000000 + i * 3600000).toISOString(),
      }));
      const query = new URL(r.request().url()).searchParams;
      const filtered = rows.filter(
        (row, index) =>
          (query.get('view') !== 'sales' || row.sellerId === 'qa') &&
          (query.get('view') !== 'offers' ||
            row.hasBid ||
            row.bidderId === 'qa') &&
          (!query.has('card') || row.copy.cardId === query.get('card')) &&
          (!query.has('rarity') ||
            query.get('rarity') === 'Toutes' ||
            models[index].rarity === query.get('rarity')) &&
          (!query.has('finish') ||
            query.get('finish') === 'all' ||
            row.copy.holo === (query.get('finish') === 'holo')) &&
          (!query.has('search') ||
            `${models[index].name} ${models[index].version} ${row.copy.cardId} ${row.sellerName}`
              .toLowerCase()
              .includes(query.get('search')!.toLowerCase())),
      );
      const pageNumber = Number(query.get('page') ?? 1);
      return r.fulfill({
        json: {
          auctions: filtered.slice((pageNumber - 1) * 24, pageNumber * 24),
          hasNext: filtered.length > pageNumber * 24,
          detail: rows.find((row) => row.id === query.get('auction')) ?? null,
        },
      });
    });
    await page.goto('/collection');
    await page
      .getByRole('button', {
        name: 'Ouvrir Sora · Îles du Destin',
        exact: true,
      })
      .click();
    const collectionDialog = page.getByRole('dialog', {
      name: 'Exemplaire · Sora',
    });
    await expect(collectionDialog).toBeVisible();
    await collectionDialog
      .getByRole('button', { name: 'Mettre aux enchères', exact: true })
      .click();
    await collectionDialog.getByLabel('Prix de départ en Munny').fill('800');
    await page.screenshot({ path: `.local/collection-sale-${width}.png` });
    await collectionDialog
      .getByRole('button', { name: 'Confirmer la mise aux enchères' })
      .click();
    await expect(collectionDialog).toHaveCount(0);
    expect(last).toMatchObject({
      action: 'create',
      copyId: 'fixture-copy',
      amount: 800,
    });
    await page.goto('/trade');
    await expect(
      page.getByRole('heading', { name: 'Marché aux enchères' }),
    ).toBeVisible();
    await expect(page.locator('.market-lot')).toHaveCount(6);
    await expect(page.getByLabel('Prix de départ en Munny')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Vendre depuis ma collection' }),
    ).toHaveAttribute('href', '/collection');
    await page
      .getByRole('combobox', { name: 'Rareté', exact: true })
      .selectOption('Légendaire');
    await expect(page.locator('.market-lot')).toHaveCount(1);
    await page
      .getByRole('combobox', { name: 'Rareté', exact: true })
      .selectOption('Toutes');
    await page
      .getByRole('combobox', { name: 'Finition', exact: true })
      .selectOption('holo');
    await expect(page.locator('.market-lot')).toHaveCount(3);
    await page
      .getByRole('combobox', { name: 'Finition', exact: true })
      .selectOption('all');
    await page.getByRole('button', { name: /Mes offres/ }).click();
    await expect(page.locator('.market-lot')).toHaveCount(2);
    await expect(page.locator('.market-lot').first()).toContainText(
      'Vous avez été surenchéri',
    );
    await page.getByRole('button', { name: /Mes ventes/ }).click();
    await expect(page.locator('.market-lot')).toHaveCount(1);
    await page.getByRole('button', { name: /Toutes les enchères/ }).click();
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/collector-market-${width}.png`,
      fullPage: true,
    });
    await page.locator('.market-card-button').first().click();
    const bidDialog = page.getByRole('dialog', { name: 'Enchère · Sora' });
    await expect(
      bidDialog.getByRole('heading', { name: 'Prix de revente' }),
    ).toBeVisible();
    await expect(bidDialog.locator('.sale-averages')).toContainText(
      'Moyenne · 2 ventes',
    );
    await bidDialog.getByLabel('Votre mise en Munny').fill('1400');
    await bidDialog
      .getByRole('button', { name: 'Enchérir', exact: true })
      .click();
    expect(last.action).toBe('create');
    await expect(bidDialog).toContainText('Confirmer une mise');
    await page.screenshot({ path: `.local/collector-bid-${width}.png` });
    await bidDialog
      .getByRole('button', { name: 'Confirmer mon enchère' })
      .click();
    await expect(bidDialog).toHaveCount(0);
    expect(last).toMatchObject({ action: 'bid', amount: 1400 });
    await page.locator('.market-card-button').first().click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto(
      '/trade?card=KH-001&auction=10000000-0000-4000-8000-000000000001',
    );
    await expect(bidDialog).toBeVisible();
    await expect(page.locator('.market-lot')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\?card=KH-001$/);
    await page.goto('/upgrade');
    await page
      .getByRole('button', {
        name: 'Ouvrir Sora · Îles du Destin',
        exact: true,
      })
      .click();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('button', { name: 'Mettre aux enchères', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
}
