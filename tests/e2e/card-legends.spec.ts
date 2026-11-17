import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const legends: Record<string, string> = JSON.parse(
  readFileSync(
    new URL('../../data/card-legends.fr.json', import.meta.url),
    'utf8',
  ),
);
test('card detail pages display the matching original legend for hero, object and enemy', async ({
  page,
}) => {
  for (const id of ['KH-001', 'KH-128', 'KH-150']) {
    await page.goto(`/cards/${id}`);
    const legend = page.getByRole('region', {
      name: 'La légende de cette carte',
    });
    await expect(legend.locator('blockquote')).toHaveText(legends[id]);
    await expect(legend).toContainText('Texte d’ambiance original · SoraRNG');
  }
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
