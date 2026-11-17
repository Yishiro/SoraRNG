// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { liveCatalog, parseSourceCatalog } from '../../src/game/catalog';
import { initialPlayer, type Copy } from '../../src/game/core';
import {
  copyStats,
  fusion,
  fusionCost,
  fusionFodder,
  unspentPoints,
} from '../../src/game/stats';
import {
  activeQuests,
  activityFrom,
  dailyPool,
  emptyActivity,
  pruneQuestClaims,
  questClaimKey,
  questStatus,
  weeklyPool,
} from '../../src/game/quests';
import {
  previousSeason,
  rankStandings,
  seasonBounds,
  seasonPoints,
} from '../../src/game/seasons';
import { achievements } from '../../src/game/achievements';

const cards = liveCatalog(
  parseSourceCatalog(
    JSON.parse(
      readFileSync(
        new URL(
          '../../data/kingdom_hearts_catalogue_150.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  ).cards,
);
const copy = (over: Partial<Copy> = {}): Copy => ({
  id: 'a',
  cardId: cards[0].id,
  holo: false,
  level: 1,
  awakening: 0,
  locked: false,
  favorite: false,
  ...over,
});

describe('fusion et statistiques', () => {
  it('donne des stats stables, plus hautes avec le niveau et la rareté', () => {
    const base = copyStats(cards[0], copy());
    expect(copyStats(cards[0], copy())).toEqual(base);
    const leveled = copyStats(cards[0], copy({ level: 20, awakening: 3 }));
    expect(leveled.atk).toBeGreaterThan(base.atk);
    const secret = cards.find((c) => c.rarity === 'Secret')!;
    const common = cards.find((c) => c.rarity === 'Commun')!;
    const sum = (s: Record<string, number>) =>
      Object.values(s).reduce((x, y) => x + y, 0);
    expect(sum(copyStats(secret, copy({ cardId: secret.id })))).toBeGreaterThan(
      sum(copyStats(common, copy({ cardId: common.id }))),
    );
  });
  it('applique les points répartis', () => {
    const before = copyStats(cards[0], copy({ fusion: 1 }));
    const after = copyStats(cards[0], copy({ fusion: 1, bonus: { hp: 2 } }));
    expect(after.hp - before.hp).toBe(2 * fusion.pointValue.hp);
    expect(unspentPoints({ fusion: 1, bonus: { hp: 2 } })).toBe(1);
  });
  it('coûte 500 Munny par rang visé et refuse les doublons protégés', () => {
    expect(fusionCost({})).toBe(500);
    expect(fusionCost({ fusion: 4 })).toBe(2500);
    const target = copy();
    expect(fusionFodder(copy({ id: 'b' }), target)).toBe(true);
    expect(fusionFodder(copy({ id: 'b', locked: true }), target)).toBe(false);
    expect(fusionFodder(copy({ id: 'b', holo: true }), target)).toBe(false);
    expect(fusionFodder(copy({ id: 'b', level: 2 }), target)).toBe(false);
    expect(fusionFodder(copy({ id: 'b', cardId: cards[1].id }), target)).toBe(
      false,
    );
    expect(fusionFodder(target, target)).toBe(false);
  });
});

describe('quêtes', () => {
  it('propose 10 journalières (250 à 1 000) et 50 hebdomadaires (500 à 2 000)', () => {
    const active = activeQuests(new Date('2026-11-17T12:00:00Z'));
    expect(active.daily.quests).toHaveLength(10);
    expect(active.weekly.quests).toHaveLength(50);
    expect(new Set(active.weekly.quests.map((q) => q.id)).size).toBe(50);
    for (const q of dailyPool) {
      expect(q.munny).toBeGreaterThanOrEqual(250);
      expect(q.munny).toBeLessThanOrEqual(1000);
    }
    for (const q of weeklyPool) {
      expect(q.munny).toBeGreaterThanOrEqual(500);
      expect(q.munny).toBeLessThanOrEqual(2000);
    }
    expect(new Set([...dailyPool, ...weeklyPool].map((q) => q.id)).size).toBe(
      dailyPool.length + weeklyPool.length,
    );
  });
  it('garde la même sélection toute la journée et change le lendemain', () => {
    const morning = activeQuests(new Date('2026-11-17T01:00:00Z'));
    const evening = activeQuests(new Date('2026-11-17T23:00:00Z'));
    const tomorrow = activeQuests(new Date('2026-11-18T01:00:00Z'));
    expect(evening.daily.quests).toEqual(morning.daily.quests);
    expect(tomorrow.daily.quests).not.toEqual(morning.daily.quests);
  });
  it('compte l’activité et rend une quête réclamable une seule fois', () => {
    const legendary = cards.find((c) => c.rarity === 'Légendaire')!;
    const activity = activityFrom(
      [
        {
          kind: 'summon',
          result: {
            boosterCount: 1,
            copies: [
              { cardId: legendary.id, holo: true },
              { cardId: cards[0].id, holo: false },
            ],
          },
        },
        { kind: 'bonus' },
        { kind: 'roulette' },
        { kind: 'quest', request: { cycle: 'daily' } },
        { kind: 'quest', request: { cycle: 'weekly' } },
      ],
      cards,
    );
    expect(activity).toMatchObject({
      boosters: 1,
      cards: 2,
      holos: 1,
      legendPlus: 1,
      bonuses: 1,
      games: 1,
      dailyQuests: 1,
    });
    const now = new Date('2026-11-17T12:00:00Z');
    const full = { ...emptyActivity() };
    for (const key of Object.keys(full) as (keyof typeof full)[])
      full[key] = 1000;
    const statuses = questStatus([], full, full, now);
    expect(statuses.every((s) => s.claimable)).toBe(true);
    const first = statuses[0];
    const again = questStatus([first.claimKey], full, full, now);
    expect(again[0].claimable).toBe(false);
    expect(again[0].claimed).toBe(true);
  });
  it('purge les réclamations de quêtes des semaines passées seulement', () => {
    const now = new Date('2026-11-17T12:00:00Z');
    const kept = questClaimKey('daily', '2026-11-17', 'd-booster-1');
    const old = questClaimKey('weekly', '2026-11-03', 'w-booster-5');
    expect(pruneQuestClaims(['first', old, kept], now)).toEqual([
      'first',
      kept,
    ]);
  });
});

describe('saisons', () => {
  it('compte les points selon la rareté, les holos et les actions', () => {
    const secret = cards.find((c) => c.rarity === 'Secret')!;
    expect(
      seasonPoints(
        [
          {
            kind: 'summon',
            result: {
              copies: [
                { cardId: secret.id, holo: true },
                {
                  cardId: cards.find((c) => c.rarity === 'Commun')!.id,
                  holo: false,
                },
              ],
            },
          },
          { kind: 'quest' },
          { kind: 'fuse' },
        ],
        cards,
      ),
    ).toBe(60 + 15 + 1 + 5 + 5);
  });
  it('borne les mois en UTC et classe sans les joueurs à zéro', () => {
    expect(previousSeason('2026-01')).toBe('2025-12');
    expect(seasonBounds('2026-11').end.toISOString()).toBe(
      '2026-12-01T00:00:00.000Z',
    );
    expect(
      rankStandings([
        { id: '2', name: 'B', points: 10, copies: 5 },
        { id: '1', name: 'A', points: 10, copies: 9 },
        { id: '3', name: 'C', points: 0 },
        { id: '4', name: 'D', points: 30 },
      ]).map((s) => s.id),
    ).toEqual(['4', '1', '2']);
  });
});

describe('succès', () => {
  it('se calcule depuis la collection', () => {
    const player = {
      ...initialPlayer(),
      copies: [copy({ holo: true, fusion: 1 })],
    };
    const list = achievements(player, cards);
    expect(list.find((a) => a.id === 'holo-1')?.done).toBe(true);
    expect(list.find((a) => a.id === 'fusion-1')?.done).toBe(true);
    expect(list.find((a) => a.id === 'holo-10')?.done).toBe(false);
  });
});
