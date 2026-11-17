import type { Pool } from 'pg';
import type { Card } from '../game/core';

export type RecentDrop = {
  id: string;
  playerName: string;
  card: Card;
  holo: boolean;
  openedAt: string;
};

export async function recentDrops(
  db: Pool,
  cards: Card[],
): Promise<RecentDrop[]> {
  const eligible = cards
    .filter((c) => ['Légendaire', 'Mythique', 'Secret'].includes(c.rarity))
    .map((c) => c.id);
  const { rows } = await db.query(
    `SELECT o.id || ':' || c.position::text AS id,p.name AS "playerName",
      c.copy->>'cardId' AS "cardId",c.copy->>'holo'='true' AS holo,
      o."createdAt" AS "openedAt"
     FROM "Operation" o JOIN "Player" p ON p.id=o."playerId"
     CROSS JOIN LATERAL jsonb_array_elements(
       CASE WHEN jsonb_typeof(o.result->'copies')='array'
       THEN o.result->'copies' ELSE '[]'::jsonb END
     ) WITH ORDINALITY AS c(copy,position)
     WHERE o.kind='summon'
       AND o.request->>'mode' IN ('single','multi','ticket')
       AND (c.copy->>'cardId'=ANY($1::text[]) OR c.copy->>'holo'='true')
     ORDER BY o."createdAt" DESC,o.id DESC,c.position DESC LIMIT 20`,
    [eligible],
  );
  return rows.flatMap((row) => {
    const card = cards.find((c) => c.id === row.cardId);
    return card
      ? [
          {
            id: row.id,
            playerName: row.playerName,
            card,
            holo: row.holo,
            openedAt: new Date(row.openedAt).toISOString(),
          },
        ]
      : [];
  });
}
