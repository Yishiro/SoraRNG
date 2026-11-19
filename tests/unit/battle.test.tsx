// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
import type { Card, Copy } from '../../src/game/core';
import {
  effectiveness,
  elementOf,
  elements,
} from '../../src/game/battle/elements';
import { movesFor } from '../../src/game/battle/moves';
import {
  activeFighter,
  buildFighter,
  cardCanFight,
  createBattle,
  damageFor,
  needsReplacement,
  replace,
  resolveTurn,
  type BattleState,
  type Fighter,
} from '../../src/game/battle/engine';
import { chooseAction, chooseReplacement } from '../../src/game/battle/ai';

const source = JSON.parse(
  readFileSync(
    new URL('../../data/kingdom_hearts_catalogue_150.json', import.meta.url),
    'utf8',
  ),
);
const cards = liveCatalog(parseSourceCatalog(source).cards);
const copy = (card: Card, over: Partial<Copy> = {}): Copy => ({
  id: `${card.id}-${over.level ?? 10}`,
  cardId: card.id,
  holo: false,
  level: 10,
  awakening: 0,
  locked: false,
  favorite: false,
  ...over,
});
const fighter = (card: Card, over: Partial<Copy> = {}) =>
  buildFighter(card, copy(card, over));
const fighters = cards.filter(cardCanFight);

function play(state: BattleState) {
  while (!state.winner) {
    for (const side of ['a', 'b'] as const)
      if (needsReplacement(state, side))
        replace(state, side, chooseReplacement(state, side)!);
    if (state.winner) break;
    resolveTurn(state, {
      a: chooseAction(state, 'a'),
      b: chooseAction(state, 'b'),
    });
  }
  return state;
}

describe('éléments', () => {
  it('rattache chaque affinité du catalogue à un élément', () => {
    const affinities = new Set(
      source.cards.map((c: { affinite: string }) => c.affinite),
    );
    for (const affinity of affinities) {
      const element = elementOf(affinity as string);
      expect(elements).toContain(element);
      if (affinity !== 'Neutre') expect(element).not.toBe('Neutre');
    }
  });
  it('donne à chaque élément (hors Neutre) une force et une faiblesse', () => {
    for (const e of elements.filter((x) => x !== 'Neutre')) {
      expect(elements.some((d) => effectiveness(e, d) === 2)).toBe(true);
      expect(elements.some((a) => effectiveness(a, e) === 2)).toBe(true);
    }
    expect(elements.every((d) => effectiveness('Neutre', d) === 1)).toBe(true);
  });
});

describe('attaques', () => {
  it('donne 4 attaques à chaque carte combattante, aucune aux objets', () => {
    expect(fighters.length).toBeGreaterThan(120);
    expect(cards.filter((c) => !cardCanFight(c)).length).toBe(21);
    for (const card of fighters) {
      const f = fighter(card);
      expect(f.moves).toHaveLength(4);
      expect(f.moves.some((m) => m.power > 0)).toBe(true);
    }
    expect(movesFor('Feu', 'Agile').some((m) => m.priority > 0)).toBe(true);
  });
});

describe('moteur', () => {
  const light = fighters.find((c) => elementOf(c.affinity) === 'Lumière')!;
  const dark = fighters.find((c) => elementOf(c.affinity) === 'Ténèbres')!;
  const neutral = fighters.find((c) => elementOf(c.affinity) === 'Neutre')!;

  it('double les dégâts sur une faiblesse d’élément', () => {
    const atk = fighter(light);
    const move = atk.moves[0];
    const onDark = damageFor(atk, { ...fighter(dark), def: 50 }, move);
    const onNeutral = damageFor(atk, { ...fighter(neutral), def: 50 }, move);
    expect(onDark.effectiveness).toBe(2);
    expect(onDark.damage / onNeutral.damage).toBeCloseTo(2, 0);
  });

  it('est déterministe : même graine, même combat', () => {
    const team = (seed: number) =>
      fighters.slice(seed, seed + 3).map((c) => fighter(c));
    const run = (seed: string) =>
      JSON.stringify(play(createBattle(team(0), team(10), seed)).teams);
    expect(run('combat-1')).toBe(run('combat-1'));
  });

  it('fait agir la priorité avant la Vitesse', () => {
    const agile = fighters.find(
      (c) => (c as { role?: string }).role === 'Agile',
    )!;
    const slow: Fighter = { ...fighter(neutral), spd: 999 };
    const quick: Fighter = { ...fighter(agile), spd: 1 };
    const state = createBattle([quick], [slow], 'priorite');
    const priority = quick.moves.findIndex((m) => m.priority > 0);
    const events = resolveTurn(state, {
      a: { type: 'move', index: priority },
      b: { type: 'move', index: 0 },
    });
    expect(events[0]).toMatchObject({ type: 'move', side: 'a' });
  });

  it('impose le remplacement d’une carte K.O. et remet les stats à zéro au changement', () => {
    const weakling: Fighter = { ...fighter(neutral), hp: 1 };
    const state = createBattle(
      [weakling, fighter(light)],
      [fighter(dark)],
      'ko',
    );
    resolveTurn(state, {
      a: { type: 'move', index: 3 },
      b: { type: 'move', index: 0 },
    });
    expect(needsReplacement(state, 'a')).toBe(true);
    expect(() =>
      resolveTurn(state, {
        a: { type: 'move', index: 0 },
        b: { type: 'move', index: 0 },
      }),
    ).toThrow(/remplacée/);
    replace(state, 'a', 1);
    expect(activeFighter(state, 'a').name).toBe(light.name);
  });

  it('termine toujours les combats IA contre IA, sans dépasser la limite de tours', () => {
    for (let i = 0; i < 40; i++) {
      const a = fighters.slice(i, i + 3).map((c) => fighter(c));
      const b = fighters.slice(i + 40, i + 43).map((c) => fighter(c));
      const state = play(createBattle(a, b, `s-${i}`));
      expect(state.winner).not.toBeNull();
      expect(state.turn).toBeLessThanOrEqual(60);
    }
  });

  it('équilibre un combat miroir (même équipe des deux côtés)', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) {
      const team = fighters
        .slice(i % 100, (i % 100) + 3)
        .map((c) => fighter(c));
      if (play(createBattle(team, team, `miroir-${i}`)).winner === 'a') a++;
    }
    expect(a).toBeGreaterThan(70);
    expect(a).toBeLessThan(130);
  });

  it('garde un rythme de duel stable quelle que soit la rareté', () => {
    // Combat miroir niveau 1 : nombre de coups pour un K.O. avec la meilleure
    // attaque. Les écarts entre cartes (robustes ou fragiles) sont voulus,
    // mais la médiane de chaque rareté reste entre 3,5 et 7 coups.
    for (const rarity of [
      'Commun',
      'Rare',
      'Épique',
      'Légendaire',
      'Mythique',
      'Secret',
    ]) {
      const hits = fighters
        .filter((c) => c.rarity === rarity)
        .map((card) => {
          const f = fighter(card, { level: 1 });
          const best = Math.max(
            ...f.moves
              .filter((m) => m.power > 0)
              .map(
                (m) => (damageFor(f, f, m, 0.925).damage * m.accuracy) / 100,
              ),
          );
          return f.maxHp / best;
        })
        .sort((x, y) => x - y);
      const median = hits[Math.floor(hits.length / 2)];
      expect(median, rarity).toBeGreaterThanOrEqual(3.5);
      expect(median, rarity).toBeLessThanOrEqual(7);
      expect(hits[0], rarity).toBeGreaterThanOrEqual(2);
      expect(hits.at(-1)!, rarity).toBeLessThanOrEqual(12);
    }
  });
});
