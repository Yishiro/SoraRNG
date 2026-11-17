// @vitest-environment node
import { expect, test } from 'vitest';
import { summonOdds } from '../../src/game/boosts';
import {
  draw,
  initialPlayer,
  requireFunds,
  validateCatalog,
  rarities,
  caps,
  type Card,
} from '../../src/game/core';
const counts = [38, 43, 29, 22, 14, 4];
const fixture: Card[] = rarities.flatMap((rarity, i) =>
  Array.from({ length: counts[i] }, (_, n) => ({
    id: `test-${i}-${n}`,
    name: `Test ${n}`,
    version: 'Test uniquement',
    rarity,
    type: 'Objet',
    origin: 'Test',
    affinity: 'Neutre',
    maxLevel: caps[i],
  })),
);
test('catalogue strict, identifiants, répartition et plafonds', () => {
  expect(validateCatalog(fixture)).toHaveLength(150);
  expect(() => validateCatalog(fixture.slice(1))).toThrow();
  expect(() =>
    validateCatalog(
      fixture.map((c, i) => (i === 1 ? { ...c, id: fixture[0].id } : c)),
    ),
  ).toThrow();
  expect(() =>
    validateCatalog(
      fixture.map((c, i) => (i === 0 ? { ...c, maxLevel: 70 } : c)),
    ),
  ).toThrow();
});
test('frontières des raretés et finition indépendante', () => {
  let lower = 0;
  [9000, 560, 280, 120, 36, 4].forEach((rate, i) => {
    for (const edge of [lower, lower + rate - 1]) {
      const rolls = [edge, 0, 39];
      const result = draw(fixture, () => rolls.shift()!);
      expect(result.cardId).toBe(`test-${i}-0`);
      expect(result.holo).toBe(true);
    }
    lower += rate;
  });
  const rolls = [9999, 0, 40];
  expect(draw(fixture, () => rolls.shift()!).holo).toBe(false);
});
test('boosts de rareté et de finition appliqués au tirage, puis expirés', () => {
  const drawAt = (
    rarityRoll: number,
    foilRoll: number,
    odds: ReturnType<typeof summonOdds>,
  ) => {
    const rolls = [rarityRoll, 0, foilRoll];
    return draw(fixture, () => rolls.shift()!, odds);
  };
  const rare = { kind: 'rare', expiresAt: 100 } as const;
  const holo = { kind: 'holo', expiresAt: 100 } as const;
  expect(drawAt(8950, 40, summonOdds(rare, 99))).toEqual({
    cardId: 'test-1-0',
    holo: false,
  });
  expect(drawAt(8950, 44, summonOdds(holo, 99))).toEqual({
    cardId: 'test-0-0',
    holo: true,
  });
  expect(drawAt(8950, 45, summonOdds(holo, 99)).holo).toBe(false);
  expect(drawAt(8950, 40, summonOdds(holo, 100))).toEqual({
    cardId: 'test-0-0',
    holo: false,
  });
});
test('distribution statistique cryptographique sur 200 000 invocations', () => {
  const totals = Array(6).fill(0);
  let holo = 0;
  for (let i = 0; i < 200000; i++) {
    const result = draw(fixture);
    totals[Number(result.cardId.split('-')[1])]++;
    if (result.holo) holo++;
  }
  const probabilities = [0.9, 0.056, 0.028, 0.012, 0.0036, 0.0004];
  probabilities.forEach((p, i) =>
    expect(Math.abs(totals[i] - 200000 * p)).toBeLessThan(
      7 * Math.sqrt(200000 * p * (1 - p)),
    ),
  );
  expect(Math.abs(holo - 800)).toBeLessThan(
    7 * Math.sqrt(200000 * 0.004 * 0.996),
  );
});
test('aucun solde négatif', () => {
  const p = initialPlayer();
  expect(() => requireFunds(p, 1000)).toThrow();
  expect(p.munny).toBe(0);
});
