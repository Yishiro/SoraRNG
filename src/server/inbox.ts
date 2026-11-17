import type { Pool } from 'pg';
export async function inbox(db: Pool, playerId: string) {
  const [items, count] = await Promise.all([
    db.query(
      'SELECT id,kind,payload,"auctionId","createdAt","readAt" FROM "AuctionNotification" WHERE "playerId"=$1 ORDER BY "createdAt" DESC,id DESC LIMIT 50',
      [playerId],
    ),
    db.query(
      'SELECT count(*)::int AS unread FROM "AuctionNotification" WHERE "playerId"=$1 AND "readAt" IS NULL',
      [playerId],
    ),
  ]);
  return { items: items.rows, unread: count.rows[0].unread as number };
}
export async function readInbox(db: Pool, playerId: string, id?: string) {
  await db.query(
    'UPDATE "AuctionNotification" SET "readAt"=now() WHERE "playerId"=$1 AND "readAt" IS NULL AND ($2::text IS NULL OR id=$2)',
    [playerId, id ?? null],
  );
}
