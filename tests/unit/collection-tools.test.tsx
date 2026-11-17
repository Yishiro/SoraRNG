// @vitest-environment node
import { expect, test } from 'vitest';
import type { Copy } from '../../src/game/core';
import {
  collectionCopies,
  openingSummary,
  revealBaseline,
} from '../../src/game/collection-tools';
const copy = (id: string, cardId = 'a', extra: Partial<Copy> = {}): Copy => ({
  id,
  cardId,
  holo: false,
  favorite: false,
  locked: false,
  level: 1,
  awakening: 0,
  ...extra,
});
test('duplicate, level and awakening filters act on copies without changing the inventory', () => {
  const source = [
    copy('a1'),
    copy('a2', 'a', { level: 12, awakening: 2, holo: true }),
    copy('b1', 'b', { level: 20, awakening: 5 }),
  ];
  expect(
    collectionCopies(source, {
      holo: false,
      favorites: false,
      duplicates: true,
      minLevel: 10,
      minAwakening: 1,
    }).map((c) => c.id),
  ).toEqual(['a2']);
  expect(source).toHaveLength(3);
  expect(
    collectionCopies(source, {
      holo: true,
      favorites: false,
      duplicates: true,
      minLevel: 1,
      minAwakening: 0,
    }).map((c) => c.id),
  ).toEqual(['a2']);
});
test('opening summary separates historical discoveries, reacquired cards and duplicates within the booster', () => {
  const baseline = revealBaseline([copy('owned')], ['a', 'sold-before']);
  const result = openingSummary(
    [
      copy('new-a'),
      copy('new-b', 'b'),
      copy('repeat-b', 'b', { holo: true }),
      copy('back', 'sold-before'),
    ],
    baseline,
  );
  expect(result.newModels).toEqual(['b']);
  expect(result.duplicateIds).toEqual(['new-a', 'repeat-b']);
  expect(result.holographics).toBe(1);
  expect(result.total).toBe(4);
  expect(baseline.owned).toEqual({ a: 1 });
});
test('two copies of a previously unknown model count as one discovery and one duplicate', () => {
  const result = openingSummary([copy('one'), copy('two')], {
    discoveries: [],
    owned: {},
  });
  expect(result.newModels).toEqual(['a']);
  expect(result.duplicateIds).toEqual(['two']);
});
