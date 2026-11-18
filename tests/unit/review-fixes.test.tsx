// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Copy } from '../../src/game/core';
import { fusionFodder } from '../../src/game/stats';
import { awakeningFodder } from '../../src/game/workshop';
import { sameTradeCopy } from '../../src/game/trade-stacks';

const copy = (over: Partial<Copy> = {}): Copy => ({
  id: 'a',
  cardId: 'KH-001',
  holo: false,
  level: 1,
  awakening: 0,
  locked: false,
  favorite: false,
  ...over,
});

describe('échanges : une carte modifiée n’est plus la même offre', () => {
  it('détecte les points de statistiques répartis après la proposition', () => {
    const offered = copy({ fusion: 1 });
    expect(sameTradeCopy(copy({ fusion: 1 }), offered)).toBe(true);
    expect(sameTradeCopy(copy({ fusion: 1, bonus: { atk: 1 } }), offered)).toBe(
      false,
    );
    // Un bonus explicite à zéro équivaut à l'absence de bonus.
    expect(sameTradeCopy(copy({ bonus: { hp: 0 } }), copy())).toBe(true);
  });
  it('détecte aussi niveau, éveil, fusion et finition', () => {
    const base = copy();
    for (const change of [
      { level: 2 },
      { awakening: 1 },
      { fusion: 1 },
      { holo: true },
      { cardId: 'KH-002' },
    ])
      expect(sameTradeCopy(copy(change), base)).toBe(false);
  });
});

describe('vitrine : jamais consommée par une fusion ou un éveil', () => {
  const target = copy({ id: 'target' });
  const shown = copy({ id: 'shown' });
  it('refuse un doublon exposé', () => {
    expect(fusionFodder(shown, target, [])).toBe(true);
    expect(fusionFodder(shown, target, ['shown'])).toBe(false);
    expect(awakeningFodder(shown, target, [])).toBe(true);
    expect(awakeningFodder(shown, target, ['shown'])).toBe(false);
  });
});
