// Série de connexion : 7 jours croissants, un jour manqué fait repartir au jour 1.
// Les jours suivent le calendrier de Paris.
import type { Player } from './core';

export const streakRewards = [
  { munny: 500, tickets: 0 },
  { munny: 1000, tickets: 0 },
  { munny: 1500, tickets: 0 },
  { munny: 2000, tickets: 0 },
  { munny: 2500, tickets: 0 },
  { munny: 3000, tickets: 0 },
  { munny: 5000, tickets: 1 },
] as const;

export type Streak = { day: number; last: string };

export function parisDay(now: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

function previousDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function streakStatus(player: Pick<Player, 'streak'>, now: number) {
  const today = parisDay(now);
  const streak = player.streak;
  const claimedToday = streak?.last === today;
  const continues = streak?.last === previousDay(today);
  // Jour de la série que le joueur réclamera (ou vient de réclamer) aujourd'hui.
  const day = claimedToday
    ? streak!.day
    : continues
      ? (streak!.day % streakRewards.length) + 1
      : 1;
  return {
    today,
    day,
    claimable: !claimedToday,
    broken: Boolean(streak) && !claimedToday && !continues,
    reward: streakRewards[day - 1],
  };
}

export function claimStreak(player: Player, now: number) {
  const status = streakStatus(player, now);
  if (!status.claimable)
    throw new Error('Récompense de connexion déjà reçue aujourd’hui.');
  player.streak = { day: status.day, last: status.today };
  player.munny += status.reward.munny;
  player.tickets += status.reward.tickets;
  return { day: status.day, ...status.reward };
}
