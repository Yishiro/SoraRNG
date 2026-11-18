// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { initialPlayer } from '../../src/game/core';
import { claimStreak, streakStatus } from '../../src/game/streak';
import { codexRewardStatus } from '../../src/game/codex-rewards';
import {
  themedBoosters,
  themedOdds,
  themedStatus,
  visibleThemedBoosters,
} from '../../src/game/themed-boosters';
import {
  cleanAnnouncement,
  cleanGuildName,
  guildWeek,
  previousGuildWeek,
} from '../../src/game/community';

const at = (iso: string) => Date.parse(iso);

describe('série de connexion', () => {
  it('progresse sur 7 jours puis recommence, et repart à 1 après un oubli', () => {
    const p = initialPlayer();
    const days = [
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
    ];
    const gains = days.map((d) => claimStreak(p, at(`${d}T10:00:00+01:00`)));
    expect(gains.map((g) => g.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 1]);
    expect(p.munny).toBe(15500 + 500);
    expect(p.tickets).toBe(1);
    expect(() => claimStreak(p, at('2026-11-25T22:00:00+01:00'))).toThrow();
    expect(streakStatus(p, at('2026-11-27T10:00:00+01:00'))).toMatchObject({
      day: 1,
      broken: true,
    });
  });
  it('suit le jour de Paris, pas celui de UTC', () => {
    const p = initialPlayer();
    claimStreak(p, at('2026-11-18T23:30:00+01:00'));
    // 00:30 à Paris le 19 = 23:30 UTC le 18 : c'est bien un nouveau jour.
    expect(streakStatus(p, at('2026-11-19T00:30:00+01:00')).claimable).toBe(
      true,
    );
  });
});

describe('paliers du Codex', () => {
  it('débloque chaque palier une fois', () => {
    const p = {
      ...initialPlayer(),
      discoveries: Array.from({ length: 60 }, (_, i) => `KH-${i}`),
    };
    const status = codexRewardStatus(p);
    expect(status.filter((s) => s.claimable).map((s) => s.target)).toEqual([
      25, 50,
    ]);
    p.claimed = ['codex-reward:codex-25'];
    expect(
      codexRewardStatus(p)
        .filter((s) => s.claimable)
        .map((s) => s.target),
    ).toEqual([50]);
  });
});

describe('booster hivernal', () => {
  const winter = themedBoosters[0];
  it('respecte sa fenêtre du 1er décembre au 6 janvier (Paris)', () => {
    expect(themedStatus(winter, at('2026-11-30T23:59:00+01:00')).active).toBe(
      false,
    );
    expect(themedStatus(winter, at('2026-12-01T00:00:00+01:00')).active).toBe(
      true,
    );
    expect(themedStatus(winter, at('2027-01-06T23:59:00+01:00')).active).toBe(
      true,
    );
    expect(themedStatus(winter, at('2027-01-07T00:00:00+01:00')).active).toBe(
      false,
    );
    expect(visibleThemedBoosters(at('2026-11-18T12:00:00+01:00'))).toHaveLength(
      1,
    );
  });
  it('a des taux qui totalisent 100 % et applique les boosts', () => {
    expect(winter.rates.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(winter.rates.slice(1, 3)).toEqual([700, 350]);
    const odds = themedOdds(
      winter,
      { kind: 'rare', expiresAt: Date.now() + 60000 },
      Date.now(),
    );
    expect(odds.rates.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(odds.rates[1]).toBe(800);
  });
});

describe('guildes et annonces', () => {
  it('valide les noms et les annonces', () => {
    expect(cleanGuildName('  Les   Gardiens ')).toBe('Les Gardiens');
    expect(() => cleanGuildName('ab')).toThrow();
    expect(() => cleanGuildName('<script>')).toThrow();
    expect(cleanAnnouncement('Je cherche Sora holo\n\n\n\nmerci')).toBe(
      'Je cherche Sora holo\n\nmerci',
    );
    expect(() => cleanAnnouncement('x'.repeat(281))).toThrow();
  });
  it('enchaîne les semaines de guilde', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    expect(guildWeek(now).key).toBe('2026-11-16');
    expect(previousGuildWeek(now).key).toBe('2026-11-09');
  });
});
