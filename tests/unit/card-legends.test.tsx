import { test, expect } from 'vitest';
import catalog from '../../data/kingdom_hearts_catalogue_150.json';
import legends from '../../data/card-legends.fr.json';
import { getCardLegend } from '../../src/game/card-legends';
test('all 150 card versions have a distinct nonempty legend and no foreign id', () => {
  expect(Object.keys(legends).sort()).toEqual(
    catalog.cards.map((card) => card.id).sort(),
  );
  const texts = catalog.cards.map((card) => getCardLegend(card.id));
  expect(texts).toHaveLength(150);
  expect(new Set(texts).size).toBe(150);
  for (const text of texts) {
    expect(typeof text).toBe('string');
    expect(text!.trim().length).toBeGreaterThan(60);
    expect(text!.length).toBeLessThan(300);
  }
});
test('legend lookup keeps versions separate and never invents an unknown card', () => {
  expect(getCardLegend('KH-001')).not.toBe(getCardLegend('KH-019'));
  expect(getCardLegend('KH-001')).toContain('rivage');
  expect(getCardLegend('KH-128')).toContain('fruit en étoile');
  expect(getCardLegend('KH-150')).toContain('Néo-Ombre');
  expect(getCardLegend('unknown')).toBeNull();
});
