import type { Pool } from 'pg';
export type SaleHistory = {
  stats: {
    holo: boolean;
    count: number;
    average: number;
    minimum: number;
    maximum: number;
  }[];
  sales: {
    id: string;
    price: number;
    holo: boolean;
    level: number;
    awakening: number;
    endedAt: string;
  }[];
};
export async function saleHistory(
  db: Pool,
  cardId: string,
  finish: string,
): Promise<SaleHistory> {
  const stats = (
    await db.query(
      `SELECT (copy->>'holo')::boolean AS holo,count(*)::int AS count,avg(bid::numeric)::float8 AS average,min(bid) AS minimum,max(bid) AS maximum FROM "CardAuction" WHERE status='sold' AND copy->>'cardId'=$1 GROUP BY (copy->>'holo')::boolean`,
      [cardId],
    )
  ).rows;
  const sales = (
    await db.query(
      `SELECT id,bid AS price,(copy->>'holo')::boolean AS holo,(copy->>'level')::int AS level,(copy->>'awakening')::int AS awakening,"endsAt" AS "endedAt" FROM "CardAuction" WHERE status='sold' AND copy->>'cardId'=$1 AND ($2::boolean IS NULL OR (copy->>'holo')::boolean=$2) ORDER BY "endsAt" DESC,id DESC LIMIT 20`,
      [cardId, finish === 'all' ? null : finish === 'holo'],
    )
  ).rows;
  return { stats, sales };
}
