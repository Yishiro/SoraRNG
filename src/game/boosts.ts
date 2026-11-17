import { holoRate, rates } from './config';

export const boostDuration = 30 * 60 * 1000;
export const boosts = {
  rare: {
    name: 'Éclat rare',
    cost: 1500,
    description: 'Cartes Rares : 5,6 % → 6,6 %',
  },
  holo: {
    name: 'Reflet holographique',
    cost: 1000,
    description: 'Finition holographique : 0,40 % → 0,45 %',
  },
} as const;

export type BoostKind = keyof typeof boosts;
export type Boost = { kind: BoostKind; expiresAt: number };

export function summonOdds(boost: Boost | undefined, now: number) {
  const active = boost && boost.expiresAt > now ? boost : undefined;
  return {
    active,
    rates:
      active?.kind === 'rare'
        ? [rates[0] - 100, rates[1] + 100, ...rates.slice(2)]
        : rates,
    holoRate: active?.kind === 'holo' ? holoRate + 5 : holoRate,
  };
}
