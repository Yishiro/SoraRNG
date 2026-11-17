import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuctionService, type AuctionInput } from '../src/server/auctions';
import { FinanceService } from '../src/server/finance';
import { initialPlayer, type Player, type Copy } from '../src/game/core';
import { applyTestMigrations } from './lib/test-migrations';
import { saleHistory } from '../src/server/auction-history';
import { AuctionNotifier } from '../bot/auction-notifications';
import { inbox, readInbox } from '../src/server/inbox';
import { marketQuery } from '../src/game/market-query';
const schema = `auction_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
const db = new Pool({ connectionString: url.toString() });
let now = Date.now();
const service = new AuctionService(db, () => now),
  finance = new FinanceService(db, () => now);
const seller = '100000000000000001',
  a = '100000000000000002',
  b = '100000000000000003';
const copy = (): Copy => ({
  id: randomUUID(),
  cardId: 'KH-001',
  holo: true,
  level: 7,
  awakening: 2,
  locked: false,
  favorite: true,
});
const run = (actor: string, input: Omit<AuctionInput, 'key'>) =>
  service.action(actor, { ...input, key: randomUUID() });
const state = async (id: string): Promise<Player> =>
  (await db.query('SELECT state FROM "Player" WHERE id=$1', [id])).rows[0]
    .state;
try {
  await applyTestMigrations(db);
  const copies = [copy(), copy(), copy(), copy()];
  for (const id of [seller, a, b])
    await db.query('INSERT INTO "Player" (id,name,state) VALUES ($1,$1,$2)', [
      id,
      JSON.stringify({
        ...initialPlayer(),
        munny: 10000,
        copies: id === seller ? copies : [],
      }),
    ]);
  const request: AuctionInput = {
    action: 'create',
    key: randomUUID(),
    copyId: copies[0].id,
    amount: 1000,
  };
  const created = await Promise.all(
    Array.from({ length: 8 }, () => service.action(seller, request)),
  );
  assert.equal(new Set(created.map((r) => r.id)).size, 1);
  const id = created[0].id;
  assert.equal((await state(seller)).copies.length, 3);
  await assert.rejects(
    run(seller, { action: 'create', copyId: copies[0].id, amount: 1 }),
  );
  await assert.rejects(run(seller, { action: 'bid', id, amount: 1000 }));
  await assert.rejects(run(a, { action: 'bid', id, amount: 999 }));
  await assert.rejects(run(a, { action: 'bid', id, amount: 10001 }));
  await run(a, { action: 'bid', id, amount: 1000 });
  assert.equal((await state(a)).munny, 9000);
  assert.equal((await state(a)).finance!.reserved, 1000);
  await assert.rejects(run(seller, { action: 'cancel', id }));
  const bids = await Promise.allSettled([
    run(a, { action: 'bid', id, amount: 1500 }),
    run(b, { action: 'bid', id, amount: 1500 }),
  ]);
  assert.equal(bids.filter((r) => r.status === 'fulfilled').length, 1);
  // Always finish with b as highest bidder, testing refund + self raise.
  await run(b, { action: 'bid', id, amount: 2000 });
  await run(b, { action: 'bid', id, amount: 2500 });
  assert.equal((await state(a)).munny, 10000);
  assert.equal((await state(a)).finance!.reserved, 0);
  assert.equal(
    (await service.list(a)).find((lot) => lot.id === id)!.hasBid,
    true,
  );
  assert.equal((await state(b)).munny, 7500);
  assert.equal((await state(b)).finance!.reserved, 2500);
  // All-in wagers cannot spend funds already reserved by an auction.
  await assert.rejects(
    finance.action(b, randomUUID(), 'double', { amount: '10000' }),
  );
  now += 86400001;
  await assert.rejects(run(a, { action: 'bid', id, amount: 3000 }));
  await Promise.all(Array.from({ length: 5 }, () => service.settle()));
  assert.equal((await state(seller)).munny, 12500);
  assert.equal((await state(seller)).finance!.liability, 0);
  assert.equal((await state(b)).finance!.reserved, 0);
  assert.equal((await state(b)).copies.length, 1);
  assert.equal(
    (await service.list(a)).find((lot) => lot.id === id)!.status,
    'sold',
  );
  assert.deepEqual((await state(b)).copies[0], {
    ...copies[0],
    favorite: false,
  });
  assert.deepEqual((await state(b)).holoDiscoveries, ['KH-001']);
  assert.equal(
    (await state(seller)).munny +
      (await state(a)).munny +
      (await state(b)).munny,
    30000,
  );
  const unsold = await run(seller, {
    action: 'create',
    copyId: copies[1].id,
    amount: 1000,
  });
  now += 86400001;
  await service.settle();
  assert.equal(
    (await service.list(seller)).find((r) => r.id === unsold.id)!.status,
    'unsold',
  );
  assert.equal(
    (await state(seller)).copies.filter((c) => c.id === copies[1].id).length,
    1,
  );
  const cancelled = await run(seller, {
    action: 'create',
    copyId: copies[2].id,
    amount: 1000,
  });
  await run(seller, { action: 'cancel', id: cancelled.id });
  assert.deepEqual(
    (await state(seller)).copies.find((c) => c.id === copies[2].id),
    copies[2],
  );
  await assert.rejects(
    run(a, { action: 'bid', id: cancelled.id, amount: 1000 }),
  );
  const suspended = await run(seller, {
    action: 'create',
    copyId: copies[3].id,
    amount: 1000,
  });
  await db.query(
    'UPDATE "Player" SET state=jsonb_set(state,\'{moderation}\',\'{"suspended":true}\') WHERE id=$1',
    [a],
  );
  await assert.rejects(
    run(a, { action: 'bid', id: suspended.id, amount: 1000 }),
  );
  await assert.rejects(service.action(seller, { ...request, amount: 2 }));
  const history = await saleHistory(db, 'KH-001', 'holo');
  assert.equal(history.sales.length, 1);
  assert.equal(history.stats[0].average, 2500);
  assert.equal(history.stats[0].count, 1);
  assert.equal((await saleHistory(db, 'KH-150', 'all')).stats.length, 0);
  for (const [amount, holo] of [
    [1000, false],
    [3000, false],
    [4500, true],
  ] as const) {
    await db.query(
      'INSERT INTO "CardAuction" (id,"sellerId",copy,"startPrice",bid,"bidderId",status,"endsAt") VALUES ($1,$2,$3,1,$4,$5,\'sold\',$6)',
      [
        randomUUID(),
        seller,
        JSON.stringify({ ...copy(), holo }),
        amount,
        b,
        new Date(now),
      ],
    );
  }
  const mixed = await saleHistory(db, 'KH-001', 'standard');
  assert.equal(mixed.sales.length, 2);
  assert.equal(mixed.stats.find((s) => !s.holo)!.average, 2000);
  assert.equal(mixed.stats.find((s) => s.holo)!.average, 3500);
  assert.ok(mixed.sales.every((s) => !s.holo));
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM "AuctionNotification" WHERE kind=\'won\'',
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM "AuctionNotification" WHERE kind=\'sold\'',
      )
    ).rows[0].n,
    1,
  );
  const notificationsBefore = (
    await db.query('SELECT count(*)::int AS n FROM "AuctionNotification"')
  ).rows[0].n;
  await db.query(
    "UPDATE \"Player\" SET state=jsonb_set(state,'{auctionNotifications}','false') WHERE id=$1",
    [seller],
  );
  let deliveries = 0;
  const delivered = new Set<string>();
  const notifier = new AuctionNotifier(
    db,
    async (notice) => {
      assert.notEqual(notice.playerId, seller);
      assert.ok(!delivered.has(notice.id));
      delivered.add(notice.id);
      deliveries++;
      return 'mock-message';
    },
    () => now,
  );
  await Promise.all([notifier.tick(), notifier.tick()]);
  const sent = deliveries;
  const sellerInbox = await inbox(db, seller);
  assert.ok(
    sellerInbox.unread > 0,
    'site notices remain available after opting out of DMs',
  );
  const buyerInbox = await inbox(db, b);
  const buyerNotice = buyerInbox.items[0].id;
  await readInbox(db, seller, buyerNotice);
  assert.equal(
    (await inbox(db, b)).unread,
    buyerInbox.unread,
    'cannot mark another player notice',
  );
  await readInbox(db, seller, sellerInbox.items[0].id);
  assert.equal((await inbox(db, seller)).unread, sellerInbox.unread - 1);
  await readInbox(db, seller);
  assert.equal((await inbox(db, seller)).unread, 0);
  assert.equal((await inbox(db, b)).unread, buyerInbox.unread);
  assert.ok(sent > 0);
  await notifier.tick();
  assert.equal(deliveries, sent);
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM "AuctionNotification"'))
      .rows[0].n,
    notificationsBefore,
  );
  assert.ok(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM "AuctionNotification" WHERE status=\'ignored\'',
      )
    ).rows[0].n > 0,
  );
  await db.query(
    'UPDATE "AuctionNotification" SET status=\'pending\',attempts=0,"nextAt"=$1 WHERE kind=\'won\'',
    [new Date(now)],
  );
  const blocked = new AuctionNotifier(
    db,
    async () => {
      throw Object.assign(new Error('Closed DMs'), { code: 50007 });
    },
    () => now,
  );
  await blocked.tick();
  assert.equal(
    (
      await db.query(
        'SELECT status FROM "AuctionNotification" WHERE kind=\'won\'',
      )
    ).rows[0].status,
    'blocked',
  );
  await db.query(
    'UPDATE "AuctionNotification" SET status=\'pending\',attempts=0,"nextAt"=$1 WHERE kind=\'won\'',
    [new Date(now)],
  );
  let failedCalls = 0;
  const retry = new AuctionNotifier(
    db,
    async () => {
      failedCalls++;
      if (failedCalls === 1) throw new Error('Temporary outage');
      return 'mock-retry';
    },
    () => now,
  );
  await retry.tick();
  await retry.tick();
  assert.equal(failedCalls, 1);
  now += 30001;
  await retry.tick();
  assert.equal(failedCalls, 2);
  assert.equal(
    (
      await db.query(
        'SELECT status FROM "AuctionNotification" WHERE kind=\'won\'',
      )
    ).rows[0].status,
    'sent',
  );
  console.log(
    'Sale averages/history and notification outbox: opt-out, deduplication, concurrent workers, closed DMs and retries passed (mock delivery; no Discord message sent).',
  );
  console.log(
    'Auctions: escrow, concurrency, refunds, self raises, expiry, delivery, conservation, idempotency and suspension passed (isolated PostgreSQL).',
  );
  await db.query(
    `INSERT INTO "Catalogue" (id,cards,version) VALUES ('standard',$1,'test')`,
    [
      JSON.stringify([
        { id: 'KH-001', name: 'Épreuve', version: 'Test', rarity: 'Rare' },
        { id: 'KH-002', name: 'Unique', version: 'Cible', rarity: 'Rare' },
      ]),
    ],
  );
  const lots = Array.from({ length: 205 }, (_, i) => ({
    id: randomUUID(),
    copy: { ...copy(), cardId: i === 204 ? 'KH-002' : 'KH-001' },
    price: i + 100,
  }));
  await db.query(
    `INSERT INTO "CardAuction" (id,"sellerId",copy,"startPrice","endsAt")
    SELECT lot->>'id',$1,lot->'copy',(lot->>'price')::int,now()+interval '1 day' FROM jsonb_array_elements($2::jsonb) lot`,
    [seller, JSON.stringify(lots)],
  );
  const firstPage = await service.page(
    a,
    marketQuery.parse({ rarity: 'Rare', search: 'epreuve', sort: 'price-low' }),
  );
  assert.equal(firstPage.auctions.length, 24);
  assert.equal(firstPage.hasNext, true);
  const secondPage = await service.page(
    a,
    marketQuery.parse({
      page: '2',
      rarity: 'Rare',
      search: 'epreuve',
      sort: 'price-low',
    }),
  );
  assert.equal(secondPage.auctions[0].startPrice, 124);
  const exact = await service.page(
    a,
    marketQuery.parse({ card: 'KH-002', auction: lots[0].id }),
  );
  assert.deepEqual(
    exact.auctions.map((lot) => lot.id),
    [lots[204].id],
  );
  assert.equal(exact.detail?.id, lots[0].id);
  await db.query(`UPDATE "CardAuction" SET status='cancelled' WHERE id=$1`, [
    lots[0].id,
  ]);
  assert.equal(
    (await service.page(a, marketQuery.parse({ auction: lots[0].id }))).detail,
    null,
  );
  assert.equal(
    (await service.page(seller, marketQuery.parse({ auction: lots[0].id })))
      .detail?.id,
    lots[0].id,
  );
  console.log(
    'Market pagination, exact-version filter beyond 200 listings, direct links and private sale access passed.',
  );
} finally {
  await db.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
