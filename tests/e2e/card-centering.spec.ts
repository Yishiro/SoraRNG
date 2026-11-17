import { test, expect } from '@playwright/test';
import { initialPlayer, type Card } from '../../src/game/core';
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 375, height: 812 },
  { width: 375, height: 667 },
]) {
  test(`revealed portraits and wide characters are centered at ${viewport.width}x${viewport.height}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const catalog = await (await request.get('/api/catalog')).json();
    const models = [
      catalog.cards.find((c: Card) => c.name.includes('Picsou')),
      catalog.cards.find((c: Card) => /wyvern/i.test(c.name)),
      catalog.cards.find((c: Card) => c.id === 'KH-001'),
    ];
    const copies = models.map((c: Card, i) => ({
      id: `centering-${i}`,
      cardId: c.id,
      holo: false,
      level: 1,
      awakening: 0,
      locked: false,
      favorite: false,
    }));
    await page.route('**/api/game', (r) =>
      r.request().method() === 'POST'
        ? r.fulfill({ json: { copies } })
        : r.fulfill({
            json: {
              id: 'centering-fixture',
              name: 'QA',
              cards: catalog.cards,
              history: [],
              missions: [],
              state: { ...initialPlayer(), munny: 1000, reducedMotion: true },
            },
          }),
    );
    await page.goto('/summon');
    await page
      .getByRole('button', { name: 'Ouvrir mon sachet', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: 'Résultats de votre invocation',
    });
    for (let i = 0; i < copies.length; i++) {
      await dialog
        .getByRole('button', {
          name: `Retourner la carte ${i + 1}`,
          exact: true,
        })
        .click();
      const image = dialog.locator('.flip-card-front img');
      await expect(image).toHaveCount(1);
      await image.evaluate((img: HTMLImageElement) => img.decode());
      const geometry = await dialog
        .locator('.flip-card-front .illustrated-card')
        .evaluate((card) => {
          const face = card.querySelector('.card-face')!,
            art = card.querySelector('.game-card-art')!,
            footer = card.querySelector('.card-bottom')!,
            image = card.querySelector('img')!;
          const c = card.getBoundingClientRect(),
            f = face.getBoundingClientRect(),
            a = art.getBoundingClientRect(),
            b = footer.getBoundingClientRect(),
            im = image.getBoundingClientRect();
          return {
            cardWidth: c.width,
            faceWidth: f.width,
            artWidth: a.width,
            centerDelta: Math.abs(a.x + a.width / 2 - (c.x + c.width / 2)),
            imageCenterDelta: Math.abs(
              im.x + im.width / 2 - (a.x + a.width / 2),
            ),
            footerGap: b.top - a.bottom,
            bottomGap: c.bottom - b.bottom,
            objectFit: getComputedStyle(image).objectFit,
            objectPosition: getComputedStyle(image).objectPosition,
            artHeight: a.height,
          };
        });
      expect(geometry.centerDelta).toBeLessThan(1);
      expect(geometry.imageCenterDelta).toBeLessThan(1);
      expect(Math.abs(geometry.artWidth - geometry.faceWidth)).toBeLessThan(1);
      expect(geometry.footerGap).toBeGreaterThanOrEqual(-1);
      expect(geometry.bottomGap).toBeLessThan(13);
      expect(geometry.artHeight).toBeGreaterThan(100);
      expect(geometry.objectFit).toBe('contain');
      expect(geometry.objectPosition).toBe('50% 50%');
      await page.screenshot({
        path: `.local/card-assets/qa/centered-${viewport.width}-${viewport.height}-${i}.png`,
      });
      if (i < copies.length - 1)
        await dialog.getByRole('button', { name: 'Suivante' }).click();
    }
    await expect(
      dialog.getByRole('button', { name: 'Continuer l’aventure' }),
    ).toBeEnabled();
  });
}
