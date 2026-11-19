// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  eloUpdate,
  leagueOf,
  pvpRules,
  stakePayout,
  validStake,
} from '../../src/game/battle/rules';

describe('règles PvP', () => {
  it('range les équipes dans 4 ligues par puissance', () => {
    expect(leagueOf(630).name).toBe('Bronze');
    expect(leagueOf(700).name).toBe('Argent');
    expect(leagueOf(899).name).toBe('Argent');
    expect(leagueOf(900).name).toBe('Or');
    expect(leagueOf(1320).name).toBe('Platine');
  });
  it('fait gagner environ 20 points à égalité de classement, et les garde', () => {
    const even = eloUpdate(1000, 1000);
    expect(even).toEqual({ winner: 1020, loser: 980 });
    // Battre plus fort rapporte plus, battre plus faible rapporte moins.
    expect(eloUpdate(1000, 1300).winner - 1000).toBeGreaterThan(30);
    expect(eloUpdate(1300, 1000).winner - 1300).toBeLessThan(10);
    // Points conservés : ce que l'un gagne, l'autre le perd.
    const r = eloUpdate(1200, 1100);
    expect(r.winner - 1200).toBe(1100 - r.loser);
    expect(eloUpdate(1000, 1000, true)).toEqual({ winner: 1000, loser: 1000 });
  });
  it('borne les mises de 100 à 10 000 Munny, sans commission', () => {
    expect(validStake(100)).toBe(true);
    expect(validStake(10000)).toBe(true);
    expect(validStake(99)).toBe(false);
    expect(validStake(10001)).toBe(false);
    expect(validStake(150.5)).toBe(false);
    expect(stakePayout(500, 'a')).toEqual({ a: 1000, b: 0 });
    expect(stakePayout(500, 'draw')).toEqual({ a: 500, b: 500 });
    expect(pvpRules.stake.feePercent).toBe(0);
  });
});

describe('récit du combat', () => {
  it('décrit les événements du point de vue du joueur', async () => {
    const { describeEvent } = await import('../../src/game/battle/log');
    expect(
      describeEvent({
        type: 'move',
        side: 'a',
        actor: 'Lyra',
        move: 'Braise',
        damage: 12,
        effectiveness: 2,
        crit: true,
      } as never),
    ).toMatch(/Lyra utilise Braise : 12 dégâts\. Coup critique !/);
    expect(describeEvent({ type: 'end', winner: 'b' } as never)).toBe(
      'Défaite…',
    );
    expect(
      describeEvent({ type: 'switch', side: 'b', from: 'X', to: 'Y' } as never),
    ).toBe('L’adversaire envoie Y.');
  });
});
