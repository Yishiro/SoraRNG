import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { initialPlayer, type Player } from '../src/game/core';
import { FinanceService } from '../src/server/finance';
import { AuctionService } from '../src/server/auctions';
const schema = `wallet_test_${randomUUID().replaceAll('-', '')}`;
const maintenance = new Pool({ connectionString: process.env.DATABASE_URL });
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const a = '100000000000000001',
  b = '100000000000000002';
process.env.ADMIN_DISCORD_IDS = a;
const { pool } = await import('../src/server/postgres');
const { walletLogs, walletLogQuery } =
  await import('../src/server/wallet-logs');
const { ensurePlayer } = await import('../src/server/players');
const { adminAction } = await import('../src/server/admin');
const finance = new FinanceService(
  pool,
  () => Date.now(),
  () => 1,
);
let now = Date.now();
const auctions = new AuctionService(pool, () => now);
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  for (const directory of (await readdir('prisma/migrations'))
    .filter((n) => /^\d+_/.test(n) && !n.endsWith('wallet_audit'))
    .sort())
    await pool.query(
      await readFile(`prisma/migrations/${directory}/migration.sql`, 'utf8'),
    );
  const state: Player = {
    ...initialPlayer(),
    munny: 10000,
    copies: [
      {
        id: 'copy-a',
        cardId: 'KH-001',
        holo: false,
        level: 1,
        awakening: 0,
        favorite: false,
        locked: false,
      },
    ],
  };
  await pool.query('INSERT INTO "Player" (id,name,state) VALUES ($1,$2,$3)', [
    a,
    'Alice',
    JSON.stringify(state),
  ]);
  await pool.query(
    await readFile(
      'prisma/migrations/20261103010000_wallet_audit/migration.sql',
      'utf8',
    ),
  );
  const baseline = (await pool.query('SELECT * FROM "WalletLedger"')).rows;
  assert.equal(baseline.length, 1);
  assert.equal(baseline[0].kind, 'baseline');
  assert.equal(baseline[0].after.wallet, 10000);
  await ensurePlayer(b, 'Bob');
  await finance.action(a, 'deposit-1', 'deposit', { amount: 'all' });
  const logs = await walletLogs(a, walletLogQuery.parse({ player: a }));
  assert.equal(logs.entries[0].before!.wallet, 10000);
  assert.equal(logs.entries[0].after.wallet, 0);
  assert.equal(logs.entries[0].after.bankMicros, '10000000000');
  assert.equal(logs.entries[0].kind, 'deposit');
  const count = logs.entries.length;
  await finance.action(a, 'deposit-1', 'deposit', { amount: 'all' });
  assert.equal(
    (await walletLogs(a, walletLogQuery.parse({ player: a }))).entries.length,
    count,
  );
  await finance.action(a, 'withdraw-1', 'withdraw', { amount: 5000 });
  await finance.action(a, 'donation-1', 'donate', {
    recipient: b,
    amount: 2000,
  });
  const donation = (
    await pool.query(
      `SELECT * FROM "WalletLedger" WHERE reference='donation-1' ORDER BY id`,
    )
  ).rows;
  assert.equal(donation.length, 2);
  assert(donation.every((r) => r.actorId === a && r.source === 'economy'));
  assert.equal(
    donation.reduce((sum, r) => sum + r.after.wallet - r.before.wallet, 0),
    0,
  );
  const listing = await auctions.action(a, {
    action: 'create',
    key: 'create-1',
    copyId: 'copy-a',
    amount: 500,
  });
  await auctions.action(b, {
    action: 'bid',
    key: 'bid-1',
    id: listing.id,
    amount: 500,
  });
  const bid = (
    await walletLogs(a, walletLogQuery.parse({ player: b, source: 'market' }))
  ).entries[0];
  assert.equal(bid.after.wallet, 1500);
  assert.equal(bid.after.reserved, 500);
  assert.equal(bid.reference, listing.id);
  now += 86400001;
  await auctions.settle();
  const sale = (
    await walletLogs(a, walletLogQuery.parse({ player: a, source: 'market' }))
  ).entries[0];
  assert.equal(sale.kind, 'auction.settle');
  assert.equal(sale.after.wallet, 3500);
  assert.equal(sale.reference, listing.id);
  const buyer = (
    await walletLogs(a, walletLogQuery.parse({ player: b, source: 'market' }))
  ).entries[0];
  assert.equal(buyer.after.reserved, 0);
  await adminAction(a, {
    action: 'resources.adjust',
    key: randomUUID(),
    reason: 'Isolated wallet audit test',
    target: b,
    resource: 'munny',
    delta: 100,
  });
  assert.equal(
    (await walletLogs(a, walletLogQuery.parse({ player: b, source: 'admin' })))
      .entries[0].after.wallet,
    1600,
  );
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query(
      `UPDATE "Player" SET state=jsonb_set(state,'{munny}','0') WHERE id=$1`,
      [b],
    );
    await connection.query('ROLLBACK');
  } finally {
    connection.release();
  }
  assert.equal(
    (await walletLogs(a, walletLogQuery.parse({ player: b }))).entries[0].after
      .wallet,
    1600,
  );
  await pool.query(
    `UPDATE "Player" SET state=jsonb_set(state,'{munny}','1500') WHERE id=$1`,
    [b],
  );
  assert.equal(
    (await walletLogs(a, walletLogQuery.parse({ player: b }))).entries[0].kind,
    'unattributed',
  );
  await assert.rejects(
    pool.query('DELETE FROM "WalletLedger" WHERE "playerId"=$1', [a]),
    /cannot be changed/,
  );
  await assert.rejects(
    walletLogs(b, walletLogQuery.parse({})),
    /Accès interdit/,
  );
  const debit = await walletLogs(
    a,
    walletLogQuery.parse({ player: a, direction: 'debit' }),
  );
  assert(debit.entries.every((e) => e.after.wallet! < e.before!.wallet!));
  for (let i = 0; i < 55; i++)
    await pool.query(
      `UPDATE "Player" SET state=jsonb_set(state,'{munny}',to_jsonb((state->>'munny')::int+1)) WHERE id=$1`,
      [b],
    );
  const first = await walletLogs(a, walletLogQuery.parse({ player: b }));
  assert.equal(first.entries.length, 50);
  assert(first.nextCursor);
  const second = await walletLogs(
    a,
    walletLogQuery.parse({ player: b, cursor: first.nextCursor }),
  );
  assert(second.entries.length > 0);
  assert(!second.entries.some((e) => first.entries.some((f) => f.id === e.id)));
  const legacy = await walletLogs(
    a,
    walletLogQuery.parse({ player: a, mode: 'legacy' }),
  );
  assert(
    legacy.entries.some(
      (e) =>
        e.kind === 'deposit' &&
        e.after.wallet === 0 &&
        e.before!.wallet === 10000,
    ),
  );
  assert(!JSON.stringify(legacy).includes('secret'));
  console.log(
    'Wallet audit passed: migration baseline, deposit/withdraw, donation counterparts, auctions/reserves/settlement, staff, rollback, replay, fallback, immutable logs, staff isolation, filters, pagination and legacy history.',
  );
} finally {
  await pool.end();
  await maintenance.query(`DROP SCHEMA "${schema}" CASCADE`);
  await maintenance.end();
}
