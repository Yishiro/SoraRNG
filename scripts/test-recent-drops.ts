import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { recentDrops } from '../src/server/recent-drops';
import type { Card } from '../src/game/core';
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const schema = `drops_test_${randomUUID().replaceAll('-', '')}`;
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
const db = new Pool({ connectionString: url.toString() });
try {
  await db.query(
    'CREATE TABLE "Player" (id text PRIMARY KEY,name text); CREATE TABLE "Operation" (id text,"playerId" text,kind text,result jsonb,request jsonb,"createdAt" timestamptz)',
  );
  await db.query('INSERT INTO "Player" VALUES ($1,$2)', [
    'private-discord-id',
    'Alice',
  ]);
  const cards = ['Commun', 'Légendaire', 'Mythique', 'Secret'].map(
    (rarity, i) => ({
      id: `KH-00${i}`,
      name: `Carte ${i}`,
      version: 'Exacte',
      rarity,
    }),
  ) as Card[];
  for (let i = 0; i < 25; i++)
    await db.query('INSERT INTO "Operation" VALUES ($1,$2,$3,$4,$5,$6)', [
      String(i),
      'private-discord-id',
      'summon',
      {
        copies: [
          { cardId: 'KH-001', holo: false },
          { cardId: 'KH-000', holo: true },
          { cardId: 'KH-000', holo: false },
          { cardId: 'KH-002', holo: false },
          { cardId: 'KH-003', holo: false },
        ],
      },
      { mode: i === 24 ? 'free' : 'single' },
      new Date(2026, 0, 1, 0, i),
    ]);
  const drops = await recentDrops(db, cards);
  assert.equal(drops.length, 20);
  assert.equal(drops[0].id, '23:5');
  assert(drops.some((d) => d.card.rarity === 'Commun' && d.holo));
  assert(drops.every((d) => d.card.rarity !== 'Commun' || d.holo));
  assert(!JSON.stringify(drops).includes('private-discord-id'));
  assert(
    drops.every((d) => d.playerName === 'Alice' && d.card.version === 'Exacte'),
  );
  console.log(
    'Recent drops SQL: threshold, holo, chronology, cap, free exclusion and privacy passed.',
  );
} finally {
  await db.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
