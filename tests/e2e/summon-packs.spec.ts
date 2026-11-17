import { test, expect } from '@playwright/test';
import { initialPlayer } from '../../src/game/core';
test('physical packs open saved results once and fit mobile', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const catalog = await (await request.get('/api/catalog')).json();
  const copies = Array.from({ length: 5 }, (_, i) => ({
    id: `pack-result-${i}`,
    cardId: 'KH-001',
    holo: false,
    level: 1,
    awakening: 0,
    locked: false,
    favorite: false,
  }));
  const state = { ...initialPlayer(), munny: 1000, tickets: 0 };
  let mutations = 0;
  await page.route('**/api/game', (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      expect(payload.kind).toBe('summon');
      expect(payload.payload.mode).toBe('single');
      mutations++;
      state.munny = 0;
      state.copies = copies;
      return route.fulfill({ json: { copies } });
    }
    return route.fulfill({
      json: {
        id: '900000000000000001',
        name: 'Pack QA',
        cards: catalog.cards,
        history: [],
        missions: [],
        state,
      },
    });
  });
  await page.goto('/summon');
  await expect(page.locator('.pack-side,.pack-ring,.pack-halo')).toHaveCount(0);
  await page.getByRole('button', { name: /10 boosters/ }).click();
  await expect(page.locator('.pack-main .booster-count')).toContainText(
    '5 CARTES',
  );
  await expect(
    page.getByText('50 cartes · 10 boosters de 5 cartes'),
  ).toBeVisible();
  await page.getByRole('button', { name: /Un booster/ }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.local/card-assets/qa/summon-packs-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Ouvrir mon sachet' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Résultats de votre invocation',
  });
  await expect(
    dialog.getByRole('button', { name: 'Déchirer le sachet' }),
  ).toBeVisible();
  expect(mutations).toBe(1);
  await expect(
    dialog.locator('.theatre-orbits,.theatre-card-stack,.reveal-rayfield'),
  ).toHaveCount(0);
  expect(
    await dialog
      .locator('.theatre-modal')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe('rgb(30, 30, 32)');
  await expect(
    dialog.getByRole('button', { name: 'Activer le son' }),
  ).toHaveAttribute('aria-pressed', 'false');
  const pack = await dialog
    .getByRole('button', { name: 'Déchirer le sachet' })
    .boundingBox();
  if (!pack) throw new Error('Missing pack');
  for (const x of [
    pack.x + 5,
    pack.x + pack.width - 5,
    pack.x + pack.width / 2,
  ]) {
    await page.mouse.move(x, pack.y + pack.height / 2);
    await expect(dialog.locator('.atelier-deck')).toBeHidden();
  }
  await expect(
    dialog.getByText('Cliquez sur le paquet pour l’ouvrir'),
  ).toBeVisible();
  await page.mouse.move(pack.x + 25, pack.y + 45);
  await page.mouse.down();
  await page.mouse.move(pack.x + pack.width + 70, pack.y + 45, { steps: 8 });
  await page.mouse.up();
  await expect(dialog.locator('.physical-opening')).toHaveClass(
    /opening-sealed/,
  );
  await dialog.getByRole('button', { name: 'Déchirer le sachet' }).click();
  await expect(dialog.locator('.physical-opening')).toHaveClass(
    /opening-tearing|opening-unfold|opening-fan/,
  );
  await expect
    .poll(() =>
      dialog
        .locator('.atelier-strip')
        .evaluate((element) =>
          parseFloat(
            getComputedStyle(element).getPropertyValue('--peel-progress'),
          ),
        ),
    )
    .toBeGreaterThan(0.3);
  await expect(dialog.locator('.atelier-deck')).toBeHidden();
  await page.screenshot({
    path: '.local/card-assets/qa/foil-tearing-mobile.png',
    animations: 'allow',
  });
  await expect(dialog.locator('.physical-opening')).toHaveClass(/opening-fan/);
  await expect(dialog.locator('.atelier-card')).toHaveCount(5);
  const emergence = await dialog.evaluate((element) => {
    const card = element
      .querySelector('.atelier-card')!
      .getBoundingClientRect();
    const body = element
      .querySelector('.atelier-body')!
      .getBoundingClientRect();
    return body.top - card.top;
  });
  expect(emergence).toBeGreaterThan(80);
  await page.screenshot({
    path: '.local/card-assets/qa/foil-fan-mobile.png',
    animations: 'allow',
  });
  await expect(
    dialog.getByRole('button', { name: 'Retourner la carte 1', exact: true }),
  ).toBeVisible();
  const finish = dialog.getByRole('button', { name: 'Continuer l’aventure' });
  for (let i = 1; i <= 5; i++) {
    await expect(finish).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    const back = dialog.getByRole('button', {
      name: `Retourner la carte ${i}`,
      exact: true,
    });
    if (i === 1) {
      const box = await back.boundingBox();
      if (!box) throw new Error('Missing card back');
      await page.mouse.move(box.x + 40, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 130, box.y + 100, { steps: 8 });
      await page.mouse.up();
      await expect(dialog.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '1',
      );
    } else await back.click();
    if (i === 3) {
      await expect(
        dialog.getByRole('button', { name: 'Suivante' }),
      ).toBeEnabled();
      expect((await dialog.boundingBox())?.y).toBe(0);
      await page.screenshot({
        path: '.local/card-assets/qa/card-theatre-mobile.png',
        fullPage: false,
      });
    }
    if (i < 5) {
      await dialog
        .getByRole('button', { name: `Passer à la carte ${i + 1}` })
        .click();
    }
  }
  await expect(finish).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: '.local/card-assets/qa/card-theatre-desktop.png',
    fullPage: false,
  });
  expect(mutations).toBe(1);
  await dialog.getByRole('button', { name: 'Continuer l’aventure' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Ouvrir mon sachet' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /Avec un ticket/ }).click();
  await expect(
    page.getByText('Vous n’avez aucun ticket disponible.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ouvrir mon sachet' }),
  ).toBeDisabled();
});
