// Saisons mensuelles (UTC). Le classement de la saison repose sur des points
// gagnés pendant le mois, pour que les nouveaux joueurs aient leur chance.
import type { Card } from './core';
import { rarities } from './config';
import type { ActivityRow } from './quests';

// Première saison récompensée : novembre 2026, date de mise en place.
export const firstSeason = '2026-11';
export const seasonRewards = [30000, 20000, 10000] as const;

export const seasonPointRules = {
  // Points par carte révélée selon sa rareté (Commun → Secret).
  rarity: [1, 2, 4, 10, 25, 60],
  holo: 15,
  quest: 5,
  fusion: 5,
  awakening: 3,
} as const;

export function seasonId(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function seasonBounds(id: string) {
  const [year, month] = id.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function previousSeason(id: string) {
  const { start } = seasonBounds(id);
  return seasonId(new Date(start.getTime() - 86400000));
}

export function seasonLabel(id: string) {
  const { start } = seasonBounds(id);
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(start);
}

export function seasonPoints(rows: ActivityRow[], cards: Card[]) {
  const rarityOf = new Map(
    cards.map((card) => [card.id, rarities.indexOf(card.rarity)]),
  );
  let points = 0;
  for (const row of rows) {
    if (row.kind === 'summon') {
      for (const copy of Array.isArray(row.result?.copies)
        ? row.result.copies
        : []) {
        points += seasonPointRules.rarity[rarityOf.get(copy.cardId) ?? 0] ?? 1;
        if (copy.holo) points += seasonPointRules.holo;
      }
    } else if (row.kind === 'quest') points += seasonPointRules.quest;
    else if (row.kind === 'fuse') points += seasonPointRules.fusion;
    else if (row.kind === 'awaken') points += seasonPointRules.awakening;
  }
  return points;
}

export type Standing = { id: string; name: string; points: number };

// Égalité : celui qui avait le plus d'exemplaires puis l'identifiant le plus ancien.
export function rankStandings(
  standings: (Standing & { copies?: number })[],
): Standing[] {
  return standings
    .filter((s) => s.points > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        (b.copies ?? 0) - (a.copies ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .map(({ id, name, points }) => ({ id, name, points }));
}
