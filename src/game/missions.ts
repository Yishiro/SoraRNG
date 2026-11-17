import type { Player } from './core';
import { discoveryIds } from './collection';
export const missionDefinitions = [
  {
    id: 'first',
    name: 'Premier passage',
    cycle: 'permanent',
    metric: 'summons',
    target: 1,
    munny: 500,
    tickets: 0,
    fragments: 0,
  },
  {
    id: 'ten',
    name: 'Dix rencontres',
    cycle: 'permanent',
    metric: 'summons',
    target: 10,
    munny: 5000,
    tickets: 0,
    fragments: 0,
  },
  {
    id: 'collect-10',
    name: 'Les premières pages',
    cycle: 'permanent',
    metric: 'discoveries',
    target: 10,
    munny: 1000,
    tickets: 0,
    fragments: 10,
  },
  {
    id: 'collect-50',
    name: 'Archiviste des mondes',
    cycle: 'permanent',
    metric: 'discoveries',
    target: 50,
    munny: 5000,
    tickets: 1,
    fragments: 25,
  },
  {
    id: 'daily-three',
    name: 'Trois portes aujourd’hui',
    cycle: 'daily',
    metric: 'summons',
    target: 3,
    munny: 1000,
    tickets: 0,
    fragments: 5,
  },
  {
    id: 'weekly-25',
    name: 'Une semaine de rencontres',
    cycle: 'weekly',
    metric: 'summons',
    target: 25,
    munny: 5000,
    tickets: 1,
    fragments: 20,
  },
] as const;
export type MissionCounts = { daily: number; weekly: number };
export function missionPeriods(now: Date) {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const week = new Date(day);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  return {
    day,
    week,
    dailyReset: new Date(day.getTime() + 86400000),
    weeklyReset: new Date(week.getTime() + 7 * 86400000),
  };
}
export function missionStatus(
  player: Player,
  counts: MissionCounts,
  now = new Date(),
) {
  const periods = missionPeriods(now);
  return missionDefinitions.map((m) => {
    const period =
      m.cycle === 'daily'
        ? periods.day
        : m.cycle === 'weekly'
          ? periods.week
          : null;
    const claimKey = period
      ? `${m.id}:${period.toISOString().slice(0, 10)}`
      : m.id;
    const value =
      m.metric === 'discoveries'
        ? discoveryIds(player).size
        : m.cycle === 'daily'
          ? counts.daily
          : m.cycle === 'weekly'
            ? counts.weekly
            : player.summons;
    const claimed = player.claimed.includes(claimKey);
    return {
      ...m,
      progress: Math.min(value, m.target),
      claimKey,
      claimed,
      claimable: !claimed && value >= m.target,
      resetsAt:
        m.cycle === 'daily'
          ? periods.dailyReset.toISOString()
          : m.cycle === 'weekly'
            ? periods.weeklyReset.toISOString()
            : null,
    };
  });
}
export type MissionStatus = ReturnType<typeof missionStatus>[number];
