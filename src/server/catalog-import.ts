import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { parseSourceCatalog } from '../game/catalog';
export async function importCatalog(db: Pool | PoolClient, raw: string) {
  const { source, cards } = parseSourceCatalog(JSON.parse(raw));
  const version = createHash('sha256').update(raw).digest('hex');
  await db.query(
    'INSERT INTO "Catalogue" (id,cards,version) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET cards=EXCLUDED.cards,version=EXCLUDED.version',
    ['standard', JSON.stringify(cards), version],
  );
  return {
    count: cards.length,
    sourceVersion: source.catalogue_version,
    version,
  };
}
