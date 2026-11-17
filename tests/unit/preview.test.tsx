// @vitest-environment node
import { test, expect } from 'vitest';
import source from '../../data/kingdom_hearts_catalogue_150.json';
import { parseSourceCatalog } from '../../src/game/catalog';
import { previewBooster } from '../../src/server/preview';
test('unlimited preview returns fresh five-card results without changing catalogue data', () => {
  const { cards } = parseSourceCatalog(source);
  const original = JSON.stringify(cards);
  const first = previewBooster(cards),
    second = previewBooster(cards);
  expect(first.demo).toBe(true);
  expect(first.copies).toHaveLength(5);
  expect(second.copies).toHaveLength(5);
  expect(
    new Set([...first.copies, ...second.copies].map((c) => c.id)).size,
  ).toBe(10);
  expect(
    first.copies.every((c) => cards.some((model) => model.id === c.cardId)),
  ).toBe(true);
  expect(JSON.stringify(cards)).toBe(original);
  expect(() => previewBooster([])).toThrow('Catalogue indisponible');
});
