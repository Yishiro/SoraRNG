// @vitest-environment node
import { expect, test } from 'vitest';
import { initialPlayer, type Card } from '../../src/game/core';
import { collectionProgress, discoveryIds } from '../../src/game/collection';
import { missionPeriods, missionStatus } from '../../src/game/missions';
const cards: Card[] = [
  {
    id: 'a',
    name: 'A',
    version: '1',
    rarity: 'Commun',
    type: 'Objet',
    affinity: 'Neutre',
    origin: 'KH1',
    maxLevel: 20,
  },
  {
    id: 'b',
    name: 'B',
    version: '1',
    rarity: 'Rare',
    type: 'Personnage',
    affinity: 'Lumière',
    origin: 'KH2',
    maxLevel: 30,
  },
];
test('découvertes permanentes, dédupliquées et indépendantes de la possession', () => {
  const p = {
    ...initialPlayer(),
    discoveries: ['a', 'a', 'unknown'],
    holoDiscoveries: ['b'],
  };
  const normal = collectionProgress(cards, p),
    holo = collectionProgress(cards, p, true);
  expect(normal.discovered).toBe(2);
  expect(holo.discovered).toBe(1);
  expect(normal.byOrigin.find((g) => g.name === 'KH1')).toMatchObject({
    discovered: 1,
    total: 1,
  });
  expect(normal.byRarity.find((g) => g.name === 'Rare')?.discovered).toBe(1);
  expect(discoveryIds(p, true).has('a')).toBe(false);
});
test('compatibilité des anciens états : exemplaires présents et holographiques', () => {
  const p = initialPlayer();
  p.copies = [
    {
      id: 'x',
      cardId: 'a',
      holo: true,
      level: 1,
      awakening: 0,
      favorite: false,
      locked: false,
    },
  ];
  expect(collectionProgress(cards, p).discovered).toBe(1);
  expect(collectionProgress(cards, p, true).discovered).toBe(1);
});
test('frontières UTC : dimanche et lundi, indépendantes du changement d’heure', () => {
  expect(
    missionPeriods(new Date('2026-10-25T23:59:59Z')).week.toISOString(),
  ).toBe('2026-10-19T00:00:00.000Z');
  const monday = missionPeriods(new Date('2026-10-26T00:00:00Z'));
  expect(monday.week.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  expect(monday.weeklyReset.toISOString()).toBe('2026-11-02T00:00:00.000Z');
});
test('récompenses de période et anciens succès restent distincts', () => {
  const p = {
    ...initialPlayer(),
    summons: 25,
    claimed: ['first', 'daily-three:2026-10-27'],
    discoveries: Array.from({ length: 10 }, (_, i) => String(i)),
  };
  const statuses = missionStatus(
    p,
    { daily: 3, weekly: 25 },
    new Date('2026-10-28T20:00:00Z'),
  );
  expect(statuses.find((m) => m.id === 'first')?.claimed).toBe(true);
  expect(statuses.find((m) => m.id === 'daily-three')).toMatchObject({
    claimKey: 'daily-three:2026-10-28',
    claimable: true,
  });
  expect(statuses.find((m) => m.id === 'collect-10')?.claimable).toBe(true);
  expect(
    missionStatus(
      p,
      { daily: 0, weekly: 0 },
      new Date('2026-10-29T00:00:00Z'),
    ).find((m) => m.id === 'daily-three')?.claimable,
  ).toBe(false);
});
