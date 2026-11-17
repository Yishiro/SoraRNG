import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Card, Player } from '../game/core';
import { assertWallet } from '../game/finance';
import {
  firstSeason,
  previousSeason,
  rankStandings,
  seasonBounds,
  seasonId,
  seasonPoints,
  seasonRewards,
  type Standing,
} from '../game/seasons';
import { walletAuditContext } from './wallet-audit';
import type { ActivityRow } from '../game/quests';

type Db = Pool | PoolClient;

export async function seasonStandings(
  db: Db,
  season: string,
  cards: Card[],
): Promise<Standing[]> {
  const { start, end } = seasonBounds(season);
  const { rows } = await db.query(
    `SELECT p.id,p.name,jsonb_array_length(p.state->'copies') AS copies,o.kind,o.result
       FROM "Player" p
       LEFT JOIN "Operation" o ON o."playerId"=p.id AND o."createdAt">=$1 AND o."createdAt"<$2
         AND o.kind IN ('summon','quest','fuse','awaken')
      WHERE COALESCE(p.state#>>'{moderation,suspended}','false')<>'true'`,
    [start, end],
  );
  const players = new Map<
    string,
    {
      id: string;
      name: string;
      copies: number;
      rows: ActivityRow[];
    }
  >();
  for (const row of rows) {
    const entry = players.get(row.id) ?? {
      id: row.id,
      name: row.name,
      copies: Number(row.copies) || 0,
      rows: [] as ActivityRow[],
    };
    if (row.kind) entry.rows.push({ kind: row.kind, result: row.result });
    players.set(row.id, entry);
  }
  return rankStandings(
    [...players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      copies: p.copies,
      points: seasonPoints(p.rows, cards),
    })),
  );
}

let settledThrough = '';

// Verse les récompenses des saisons terminées qui ne l'ont pas encore été.
// Appelée paresseusement par les lectures : aucun planificateur n'est nécessaire.
export async function settleSeasons(
  pool: Pool,
  cards: Card[],
  now = new Date(),
) {
  const last = previousSeason(seasonId(now));
  if (last < firstSeason || settledThrough === last) return;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('sorarng:season'))");
    const done = new Set(
      (await db.query('SELECT id FROM "SeasonSettlement"')).rows.map(
        (r) => r.id,
      ),
    );
    for (
      let season = last;
      season >= firstSeason;
      season = previousSeason(season)
    ) {
      if (done.has(season)) break;
      await settle(db, season, cards);
    }
    await db.query('COMMIT');
    settledThrough = last;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function settle(db: PoolClient, season: string, cards: Card[]) {
  const standings = await seasonStandings(db, season, cards);
  const winners = standings.slice(0, seasonRewards.length);
  await walletAuditContext(db, {
    source: 'system',
    kind: 'season.reward',
    reference: `season:${season}`,
  });
  const locked = new Map<string, Player>(
    (
      await db.query(
        'SELECT id,state FROM "Player" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
        [winners.map((w) => w.id)],
      )
    ).rows.map((r) => [r.id, r.state as Player]),
  );
  for (const [index, winner] of winners.entries()) {
    const state = locked.get(winner.id);
    if (!state || state.moderation?.suspended) continue;
    const reward = seasonRewards[index];
    const inserted = await db.query(
      'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result,request) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("playerId",key) DO NOTHING RETURNING id',
      [
        randomUUID(),
        winner.id,
        `season:${season}`,
        'season.reward',
        reward,
        JSON.stringify({
          season,
          rank: index + 1,
          points: winner.points,
          reward,
        }),
        JSON.stringify({}),
      ],
    );
    if (!inserted.rowCount) continue;
    state.munny += reward;
    assertWallet(state);
    await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
      winner.id,
      JSON.stringify(state),
    ]);
  }
  await db.query(
    'INSERT INTO "SeasonSettlement" (id,standings) VALUES ($1,$2)',
    [
      season,
      JSON.stringify(
        standings.slice(0, 10).map((s, i) => ({
          ...s,
          rank: i + 1,
          reward: seasonRewards[i] ?? 0,
        })),
      ),
    ],
  );
}

export async function lastSettlement(db: Db) {
  return (
    await db.query(
      'SELECT id,standings,"createdAt" FROM "SeasonSettlement" ORDER BY id DESC LIMIT 1',
    )
  ).rows[0] as
    | {
        id: string;
        createdAt: Date;
        standings: (Standing & { rank: number; reward: number })[];
      }
    | undefined;
}
