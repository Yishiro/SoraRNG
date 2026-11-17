import type { Pool, PoolClient } from 'pg';
import type { Card, Player } from '../game/core';
import {
  activeQuests,
  activityFrom,
  questStatus,
  type ActivityRow,
} from '../game/quests';

type Db = Pool | PoolClient;
type DatedRow = ActivityRow & { createdAt: Date };

// Journal d'un joueur sur une période : site, économie Discord et ventes créées.
export async function activityRows(
  db: Db,
  playerId: string,
  from: Date,
  to: Date,
): Promise<DatedRow[]> {
  return (
    await db.query(
      `SELECT kind,result,request,"createdAt" FROM "Operation"
         WHERE "playerId"=$1 AND "createdAt">=$2 AND "createdAt"<$3
       UNION ALL
       SELECT kind,result,request,"createdAt" FROM "EconomyOperation"
         WHERE "playerId"=$1 AND "createdAt">=$2 AND "createdAt"<$3
       UNION ALL
       SELECT 'auction.create','{}'::jsonb,'{}'::jsonb,"createdAt" FROM "CardAuction"
         WHERE "sellerId"=$1 AND "createdAt">=$2 AND "createdAt"<$3`,
      [playerId, from, to],
    )
  ).rows;
}

export async function playerQuests(
  db: Db,
  playerId: string,
  player: Player,
  cards: Card[],
  now = new Date(),
) {
  const { daily, weekly } = activeQuests(now);
  const rows = await activityRows(db, playerId, weekly.start, weekly.resetsAt);
  const today = rows.filter(
    (row) => row.createdAt >= daily.start && row.createdAt < daily.resetsAt,
  );
  return questStatus(
    player.claimed ?? [],
    activityFrom(today, cards),
    activityFrom(rows, cards),
    now,
  );
}
