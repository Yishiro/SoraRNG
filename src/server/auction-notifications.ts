import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Copy } from '../game/core';
export type AuctionNotice = { copy: Copy; amount: number };
export async function queueAuctionNotice(
  db: PoolClient,
  id: string,
  playerId: string,
  kind: 'outbid' | 'won' | 'sold' | 'unsold',
  auctionId: string,
  copy: Copy,
  amount: number,
) {
  await db.query(
    'INSERT INTO "AuctionNotification" (id,"playerId",kind,"auctionId",payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
    [
      createHash('sha256').update(id).digest('hex').slice(0, 24),
      playerId,
      kind,
      auctionId,
      JSON.stringify({ copy, amount }),
    ],
  );
}
