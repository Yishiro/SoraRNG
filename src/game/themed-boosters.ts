// Boosters à thème, en vente seulement pendant leur fenêtre (heure de Paris).
// `cardIds: null` = tout le catalogue, en attendant les cartes du thème.
import type { Boost } from './boosts';
import { holoRate } from './config';

export type ThemedBooster = {
  id: string;
  name: string;
  description: string;
  tone: 'winter';
  // Bornes ISO avec décalage horaire explicite : début inclus, fin exclue.
  start: string;
  end: string;
  cost: number;
  // Commun, Rare, Épique, Légendaire, Mythique, Secret (sur 10 000).
  rates: number[];
  holoRate: number;
  cardIds: string[] | null;
};

export const themedBoosters: ThemedBooster[] = [
  {
    id: 'hiver-2026',
    name: 'Booster hivernal',
    description:
      'Édition de Noël : Rares et Épiques plus fréquentes. Les cartes d’hiver rejoindront ce booster prochainement.',
    tone: 'winter',
    start: '2026-12-01T00:00:00+01:00',
    end: '2027-01-07T00:00:00+01:00',
    cost: 1500,
    rates: [8790, 700, 350, 120, 36, 4],
    holoRate,
    cardIds: null,
  },
];

export function themedStatus(booster: ThemedBooster, now: number) {
  const start = Date.parse(booster.start);
  const end = Date.parse(booster.end);
  return {
    active: now >= start && now < end,
    upcoming: now < start,
    start,
    end,
  };
}

// Boosters à montrer : en vente, ou annoncés dans les 30 jours à venir.
export function visibleThemedBoosters(now: number) {
  return themedBoosters.filter((b) => {
    const s = themedStatus(b, now);
    return s.active || (s.upcoming && s.start - now < 30 * 86400000);
  });
}

// Les boosts temporaires s'appliquent aussi aux boosters à thème.
export function themedOdds(
  booster: ThemedBooster,
  boost: Boost | undefined,
  now: number,
) {
  const active = boost && boost.expiresAt > now ? boost : undefined;
  return {
    active,
    rates:
      active?.kind === 'rare'
        ? [
            booster.rates[0] - 100,
            booster.rates[1] + 100,
            ...booster.rates.slice(2),
          ]
        : booster.rates,
    holoRate: active?.kind === 'holo' ? booster.holoRate + 5 : booster.holoRate,
  };
}
