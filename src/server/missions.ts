import type { Pool, PoolClient } from 'pg';
import type { Player } from '../game/core';
import { missionPeriods, missionStatus } from '../game/missions';
export async function playerMissions(
  db: Pool | PoolClient,
  id: string,
  player: Player,
  now = new Date(),
) {
  const { day, week, dailyReset, weeklyReset } = missionPeriods(now);
  const row = (
    await db.query(
      `SELECT COALESCE(SUM(jsonb_array_length(result->'copies')) FILTER (WHERE "createdAt">=$2 AND "createdAt"<$4),0)::int AS daily, COALESCE(SUM(jsonb_array_length(result->'copies')) FILTER (WHERE "createdAt">=$3 AND "createdAt"<$5),0)::int AS weekly FROM "Operation" WHERE "playerId"=$1 AND kind='summon' AND "createdAt">=$3 AND "createdAt"<$5`,
      [id, day, week, dailyReset, weeklyReset],
    )
  ).rows[0];
  return missionStatus(player, row, now);
}
