// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { initialPlayer, type Card, type Copy } from '../../src/game/core';
import {
  affordableLevels,
  awakeningFodder,
  recyclable,
  suggestedRecycling,
  upgradeCost,
} from '../../src/game/workshop';

const card = { id: 'KH-001', rarity: 'Commun', maxLevel: 20 } as Card;
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

describe('atelier', () => {
  it('additionne exactement les coûts niveau par niveau', () => {
    expect(upgradeCost(1, 1)).toEqual({ munny: 100, fragments: 2 });
    expect(upgradeCost(3, 3)).toEqual({ munny: 300 + 400 + 500, fragments: 6 });
  });
  it('calcule les niveaux finançables sans dépasser le plafond', () => {
    expect(affordableLevels(copy(), card, 600, 100)).toBe(3);
    expect(affordableLevels(copy(), card, 10 ** 9, 3)).toBe(1);
    expect(affordableLevels(copy({ level: 19 }), card, 10 ** 9, 100)).toBe(1);
    expect(affordableLevels(copy({ level: 20 }), card, 10 ** 9, 100)).toBe(0);
  });
  it('ne consomme jamais un exemplaire fusionné ou protégé pour un éveil', () => {
    const target = copy({ id: 't' });
    expect(awakeningFodder(copy({ id: 'b' }), target)).toBe(true);
    expect(awakeningFodder(copy({ id: 'b', fusion: 1 }), target)).toBe(false);
    expect(awakeningFodder(copy({ id: 'b', favorite: true }), target)).toBe(
      false,
    );
  });
  it('propose les doublons standards et garde le meilleur exemplaire', () => {
    const player = {
      ...initialPlayer(),
      showcase: ['shown'],
      copies: [
        copy({ id: 'best', level: 8 }),
        copy({ id: 'spare-1' }),
        copy({ id: 'spare-2' }),
        copy({ id: 'holo', holo: true }),
        copy({ id: 'locked', locked: true }),
        copy({ id: 'shown' }),
        copy({ id: 'single', cardId: 'KH-002' }),
      ],
    };
    expect(suggestedRecycling(player).map((c) => c.id)).toEqual([
      'spare-1',
      'spare-2',
    ]);
    expect(recyclable(copy({ id: 'shown' }), player)).toBe(false);
  });
});
