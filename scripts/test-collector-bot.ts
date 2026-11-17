import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { CollectorStore } from '../bot/collector-store';
import { initialPlayer } from '../src/game/core';
import { applyTestMigrations } from './lib/test-migrations';
import { importCatalog } from '../src/server/catalog-import';
import { FinanceService } from '../src/server/finance';
const schema = `collector_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
const db = new Pool({ connectionString: url.toString() });
const a = '900000000000000001',
  b = '900000000000000002';
const store = new CollectorStore(db),
  finance = new FinanceService(db);
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await applyTestMigrations(db);
  await importCatalog(
    db,
    await readFile('data/kingdom_hearts_catalogue_150.json', 'utf8'),
  );
  for (const [id, name] of [
    [a, 'Alice'],
    [b, 'Bob'],
  ])
    await db.query('INSERT INTO "Player" (id,name,state) VALUES ($1,$2,$3)', [
      id,
      name,
      JSON.stringify({ ...initialPlayer(), munny: 10000 }),
    ]);
  assert.equal((await store.cards()).length, 150);
  await assert.rejects(store.profile('900000000000000003'), /Aucun profil/);
  const original = (await store.profile(a)).state;
  await Promise.all(
    Array.from({ length: 8 }, () =>
      store.wishlist(a, 'discord:900000000000000010', 'KH-001', true),
    ),
  );
  assert.deepEqual((await store.profile(a)).state, {
    ...original,
    wishlist: ['KH-001'],
  });
  assert.deepEqual((await store.profile(b)).state.wishlist ?? [], []);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM "Operation" WHERE "playerId"=$1',
        [a],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    store.wishlist(a, 'discord:900000000000000010', 'KH-002', true),
    /déjà utilisé/,
  );
  await store.wishlist(a, 'discord:900000000000000011', 'KH-002', true);
  await store.wishlist(a, 'discord:900000000000000012', 'KH-001', false);
  assert.deepEqual((await store.profile(a)).state.wishlist, ['KH-002']);
  assert.equal((await store.profile(a)).state.munny, 10000);
  await finance.action(a, 'deposit-test', 'deposit', { amount: 500 });
  const history = await store.history(a);
  assert.equal(history[0].kind, 'deposit');
  assert.equal(history[0].before, 10000);
  assert.equal(history[0].after, 9500);
  assert.equal(history[0].bankMicros, '500000000');
  assert.equal((await store.history(b)).length, 0);
  for (const [id, seller, card, status, offset] of [
    ['active-a', a, 'KH-001', 'open', 100000],
    ['expired', a, 'KH-001', 'open', -100000],
    ['active-b', b, 'KH-002', 'open', 100000],
    ['sold', a, 'KH-001', 'sold', -100000],
  ])
    await db.query(
      'INSERT INTO "CardAuction" (id,"sellerId",copy,"startPrice",bid,status,"endsAt","bidderId") VALUES ($1,$2,$3,500,$4,$5,$6,$7)',
      [
        id,
        seller,
        { cardId: card, holo: false, level: 1, awakening: 0 },
        status === 'sold' ? 700 : 0,
        status,
        new Date(Date.now() + Number(offset)),
        status === 'sold' ? b : null,
      ],
    );
  assert.equal((await store.market(null, null, 1)).length, 2);
  assert.equal((await store.market('KH-001', null, 1))[0].id, 'active-a');
  assert.equal((await store.market(null, b, 1)).length, 1);
  assert.equal((await store.market(null, null, 2)).length, 0);
  assert.equal((await store.prices('KH-001')).stats[0].average, 700);
  assert.equal((await store.prices('KH-002')).stats.length, 0);
  await db.query(
    `UPDATE "Player" SET state=jsonb_set(state,'{moderation}','{"suspended":true}') WHERE id=$1`,
    [b],
  );
  await assert.rejects(store.profile(b), /indisponible/);
  await assert.rejects(
    store.wishlist(b, 'discord:900000000000000013', 'KH-001', true),
    /indisponible/,
  );
  console.log(
    'Collector SQL passed: exact catalogue, shared wishlist concurrent replay, account isolation, untouched balances, private history, market expiry/filter/pagination, completed-sale means and suspended/missing accounts.',
  );
} finally {
  await db.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
