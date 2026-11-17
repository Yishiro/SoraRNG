// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
const raw = JSON.parse(
  readFileSync(
    new URL('../../data/kingdom_hearts_catalogue_150.json', import.meta.url),
    'utf8',
  ),
);

test('live v2 odds override reference metadata without changing the source catalogue', () => {
  const { cards } = parseSourceCatalog(raw),
    live = liveCatalog(cards);
  expect(raw.holographic_rate_percent).toBe(2);
  expect(live[0].finition_holo_pct).toBe(0.4);
  expect(
    live
      .filter((c) => c.rarity === 'Commun')
      .reduce((sum, c) => sum + c.taux_modele_pct, 0),
  ).toBeCloseTo(90, 10);
  expect(live.reduce((sum, c) => sum + c.taux_modele_pct, 0)).toBeCloseTo(
    100,
    10,
  );
  expect(live.reduce((sum, c) => sum + c.taux_holo_precis_pct, 0)).toBeCloseTo(
    0.4,
    10,
  );
  expect(cards[0].finition_holo_pct).toBe(2);
});
test('catalogue original v1.1 : 150 modèles, alias et métadonnées conservés', () => {
  const { source, cards } = parseSourceCatalog(raw);
  expect(source.catalogue_version).toBe('1.1');
  expect(cards).toHaveLength(150);
  expect(cards[0]).toMatchObject({
    id: 'KH-001',
    name: 'Sora',
    personnage: 'Sora',
    origin: 'KH1',
    rarity: 'Commun',
    type: 'Personnage',
    maxLevel: 20,
  });
  expect(cards[0].notes).toBe(raw.cards[0].notes);
  expect(cards.filter((c) => c.rarity === 'Secret')).toHaveLength(4);
});
test.each([
  'rarity',
  'holo',
  'individual',
  'precise',
  'finish',
  'duplicate',
  'type',
  'cap',
] as const)('refuse une incohérence du catalogue : %s', (kind) => {
  const invalid = structuredClone(raw);
  if (kind === 'rarity') invalid.rarity_rates_percent.Commun = 49;
  if (kind === 'holo') invalid.holographic_rate_percent = 3;
  if (kind === 'individual') invalid.cards[0].taux_modele_pct = 10;
  if (kind === 'precise') invalid.cards[0].taux_holo_precis_pct = 1;
  if (kind === 'finish') invalid.cards[0].finition_holo_pct = 0;
  if (kind === 'duplicate') invalid.cards[1].id = invalid.cards[0].id;
  if (kind === 'type') invalid.cards[0].type_carte = 'Inconnu';
  if (kind === 'cap') invalid.cards[0].niveau_max = 70;
  expect(() => parseSourceCatalog(invalid)).toThrow();
});
