import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { applyTestMigrations } from './lib/test-migrations';
import type { Trade } from '../src/server/trades';
import type { MissionStatus } from '../src/game/missions';
import { initialPlayer, rarities, caps, type Copy } from '../src/game/core';
import { showcaseCopies } from '../src/game/showcase';
const schema = `sora_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool, ensurePlayer, mutate, snapshot } =
  await import('../src/server/game');
const { tradeAction } = await import('../src/server/trades');
const { rateLimit } = await import('../src/server/limits');
const prefix = `integration-${randomUUID()}`;
const a = `${prefix}-a`,
  b = `${prefix}-b`;
const copy: Copy = {
  id: randomUUID(),
  cardId: 'test-fixture-only',
  level: 1,
  awakening: 0,
  holo: true,
  locked: false,
  favorite: false,
};
try {
  await applyTestMigrations(pool);
  await ensurePlayer(a, 'Integration A');
  await ensurePlayer(b, 'Integration B');
  await mutate(a, randomUUID(), 'settings', { auctionNotifications: false });
  assert.equal((await snapshot(a)).state.auctionNotifications, false);
  assert.equal((await snapshot(a)).state.reducedMotion, false);
  await assert.rejects(
    mutate(a, randomUUID(), 'settings', { auctionNotifications: 'false' }),
  );
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => mutate(a, randomUUID(), 'daily', {})),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await snapshot(a)).state.munny, 5000);
  const key = randomUUID();
  await Promise.all(
    Array.from({ length: 10 }, () =>
      mutate(a, key, 'shop', { item: 'ticket' }),
    ),
  );
  assert.equal((await snapshot(a)).state.munny, 4000);
  assert.equal((await snapshot(a)).state.tickets, 1);
  await assert.rejects(mutate(a, key, 'shop', { item: 'fragments' }));
  const limited = await Promise.all(
    Array.from({ length: 20 }, () => rateLimit(a, 'test', 10)),
  );
  assert.equal(limited.filter(Boolean).length, 10);
  const buys = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      mutate(a, randomUUID(), 'shop', { item: 'ticket' }),
    ),
  );
  assert.equal(buys.filter((r) => r.status === 'fulfilled').length, 4);
  assert.equal((await snapshot(a)).state.munny, 0);
  await assert.rejects(mutate(a, randomUUID(), 'shop', { item: 'ticket' }));
  await assert.rejects(mutate(a, randomUUID(), 'summon', { mode: 'free' }));
  const fixture = rarities.flatMap((rarity, i) =>
    Array.from({ length: [38, 43, 29, 22, 14, 4][i] }, (_, n) => ({
      id: `fixture-${i}-${n}`,
      name: `Test ${i}-${n}`,
      version: 'Test uniquement',
      rarity,
      type: 'Objet',
      origin: 'Test',
      affinity: 'Neutre',
      maxLevel: caps[i],
    })),
  );
  await pool.query(
    'INSERT INTO "Catalogue" (id,cards,version) VALUES ($1,$2,$3)',
    ['standard', JSON.stringify(fixture), 'test-only'],
  );
  await Promise.all(
    Array.from({ length: 5 }, () =>
      mutate(a, randomUUID(), 'wishlist', {
        cardId: fixture[0].id,
        wanted: true,
      }),
    ),
  );
  assert.deepEqual((await snapshot(a)).state.wishlist, [fixture[0].id]);
  assert.deepEqual((await snapshot(b)).state.wishlist ?? [], []);
  await assert.rejects(
    mutate(a, randomUUID(), 'wishlist', {
      cardId: 'missing-card',
      wanted: true,
    }),
  );
  await mutate(a, randomUUID(), 'wishlist', {
    cardId: fixture[0].id,
    wanted: false,
  });
  assert.deepEqual((await snapshot(a)).state.wishlist, []);
  console.log(
    'PASS: wishlist persisted, concurrent additions unique, isolated between players, unknown cards rejected and removal persisted.',
  );
  await assert.rejects(mutate(a, randomUUID(), 'summon', { mode: 'free' }));
  await assert.rejects(mutate(a, randomUUID(), 'summon', { mode: 'trial' }));
  await pool.query(
    `UPDATE "Player" SET state=jsonb_set(state,'{tickets}','1') WHERE id=$1`,
    [a],
  );
  const ticketResults = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      mutate(a, randomUUID(), 'summon', { mode: 'ticket' }),
    ),
  );
  assert.equal(
    ticketResults.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal((await snapshot(a)).state.copies.length, 5);
  const summonKey = randomUUID();
  await pool.query(
    "UPDATE \"Player\" SET state=jsonb_set(state,'{munny}','20000') WHERE id=$1",
    [a],
  );
  const [multi1, multi2] = await Promise.all([
    mutate(a, summonKey, 'summon', { mode: 'multi' }),
    mutate(a, summonKey, 'summon', { mode: 'multi' }),
  ]);
  assert.deepEqual(multi1, multi2);
  assert.equal((await snapshot(a)).state.copies.length, 55);
  assert.equal((await snapshot(a)).state.munny, 10000);
  const holoCopy = { ...copy, cardId: fixture[0].id };
  const duplicate = { ...holoCopy, id: randomUUID(), holo: false };
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    a,
    JSON.stringify({
      ...initialPlayer(),
      munny: 20000,
      fragments: 1000,
      copies: [holoCopy, duplicate],
    }),
  ]);
  await mutate(a, randomUUID(), 'awaken', { copyId: holoCopy.id });
  assert.equal((await snapshot(a)).state.copies.length, 1);
  assert.equal((await snapshot(a)).state.copies[0].awakening, 1);
  assert.equal((await snapshot(a)).state.copies[0].holo, true);
  await mutate(a, randomUUID(), 'upgrade', { copyId: holoCopy.id });
  assert.equal((await snapshot(a)).state.copies[0].level, 2);
  await mutate(a, randomUUID(), 'awaken', {
    copyId: holoCopy.id,
    alternative: true,
  });
  assert.equal((await snapshot(a)).state.copies[0].awakening, 2);
  const state = { ...initialPlayer(), munny: 10000, copies: [copy] };
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    a,
    JSON.stringify(state),
  ]);
  await mutate(a, randomUUID(), 'lock', { copyId: copy.id });
  await assert.rejects(mutate(a, randomUUID(), 'recycle', { copyId: copy.id }));
  await mutate(a, randomUUID(), 'lock', { copyId: copy.id });
  const invitationId = randomUUID();
  let t: Trade = await tradeAction(a, 'invite', {
    target: b,
    id: invitationId,
  });
  assert.equal(
    (await tradeAction(a, 'invite', { target: b, id: invitationId })).id,
    t.id,
  );
  await assert.rejects(
    tradeAction(`${prefix}-intruder`, 'accept', { id: t.id, revision: 0 }),
  );
  t = await tradeAction(b, 'accept', { id: t.id, revision: t.state.revision });
  t = await tradeAction(a, 'offer', {
    id: t.id,
    revision: t.state.revision,
    copies: [copy.id],
  });
  await assert.rejects(tradeAction(a, 'lock', { id: t.id, revision: 0 }));
  t = await tradeAction(a, 'lock', { id: t.id, revision: t.state.revision });
  t = await tradeAction(b, 'lock', { id: t.id, revision: t.state.revision });
  t = await tradeAction(a, 'confirm', { id: t.id, revision: t.state.revision });
  t = await tradeAction(b, 'confirm', { id: t.id, revision: t.state.revision });
  assert.equal(t.state.status, 'completed');
  assert.equal((await snapshot(a)).state.copies.length, 0);
  assert.equal((await snapshot(b)).state.copies[0].holo, true);
  await assert.rejects(
    tradeAction(b, 'confirm', { id: t.id, revision: t.state.revision }),
  );
  async function prepareTrade() {
    let trade: Trade = await tradeAction(b, 'invite', { target: a });
    trade = await tradeAction(a, 'accept', {
      id: trade.id,
      revision: trade.state.revision,
    });
    trade = await tradeAction(b, 'offer', {
      id: trade.id,
      revision: trade.state.revision,
      copies: [copy.id],
    });
    trade = await tradeAction(a, 'lock', {
      id: trade.id,
      revision: trade.state.revision,
    });
    trade = await tradeAction(b, 'lock', {
      id: trade.id,
      revision: trade.state.revision,
    });
    return tradeAction(a, 'confirm', {
      id: trade.id,
      revision: trade.state.revision,
    });
  }
  const trades = await Promise.all([prepareTrade(), prepareTrade()]);
  const competing = await Promise.allSettled(
    trades.map((trade) =>
      tradeAction(b, 'confirm', {
        id: trade.id,
        revision: trade.state.revision,
      }),
    ),
  );
  assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await snapshot(a)).state.copies.length, 1);
  assert.equal((await snapshot(b)).state.copies.length, 0);
  const expired: Trade = await tradeAction(a, 'invite', { target: b });
  await pool.query(
    'UPDATE "Trade" SET "expiresAt"=NOW()-INTERVAL \'1 second\' WHERE id=$1',
    [expired.id],
  );
  await assert.rejects(
    tradeAction(b, 'accept', { id: expired.id, revision: 0 }),
  );
  console.log(
    'PASS: isolated PostgreSQL schema; daily concurrency, idempotency, purchases, no overdraft, missing catalogue, simultaneous ticket spending, persisted multi-draw replay, duplicate consumption, alternative awakening, level and permanent finish, locked recycling, trade permissions, stale revision, atomic transfer and double transfer rejection.',
  );
  const { importCatalog } = await import('../src/server/catalog-import');
  const raw = await readFile('data/kingdom_hearts_catalogue_150.json', 'utf8');
  const first = await importCatalog(pool, raw);
  const second = await importCatalog(pool, raw);
  assert.deepEqual(first, second);
  assert.equal(first.count, 150);
  assert.equal(
    (await pool.query('SELECT COUNT(*)::int AS count FROM "Catalogue"')).rows[0]
      .count,
    1,
  );
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    a,
    JSON.stringify({ ...initialPlayer(), munny: 10000 }),
  ]);
  const officialResult = await mutate(a, randomUUID(), 'summon', {
    mode: 'multi',
  });
  assert.equal(officialResult.copies.length, 50);
  assert.equal(officialResult.boosterCount, 10);
  assert.equal(officialResult.cardsPerBooster, 5);
  assert.ok(
    officialResult.copies.every((c: Copy) => /^KH-\d{3}$/.test(c.cardId)),
  );
  const invalid = JSON.parse(raw);
  invalid.holographic_rate_percent = 99;
  await assert.rejects(importCatalog(pool, JSON.stringify(invalid)));
  assert.equal(
    (
      await pool.query('SELECT version FROM "Catalogue" WHERE id=$1', [
        'standard',
      ])
    ).rows[0].version,
    first.version,
  );
  console.log(
    'PASS: real catalogue import, repeat import without duplicates, invalid import leaves active version intact, 10 boosters with 50 real catalogue cards. Test schema only.',
  );
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    a,
    JSON.stringify({ ...initialPlayer(), munny: 2000, tickets: 1 }),
  ]);
  for (const mode of ['single', 'ticket']) {
    const key = randomUUID();
    const result = await mutate(a, key, 'summon', { mode });
    assert.equal(result.copies.length, 5);
    assert.equal(result.boosterCount, 1);
    assert.deepEqual(await mutate(a, key, 'summon', { mode }), result);
  }
  const boosterPlayer = await snapshot(a);
  assert.equal(boosterPlayer.state.copies.length, 10);
  assert.equal(boosterPlayer.state.munny, 1000);
  assert.equal(boosterPlayer.state.tickets, 0);
  await pool.query(
    'UPDATE "Player" SET state=jsonb_set(state,\'{claimed}\',$2::jsonb) WHERE id=$1',
    [a, JSON.stringify(['trial-booster-v1'])],
  );
  const beforeRemoved = await snapshot(a);
  for (const mode of ['free', 'trial']) {
    const rejected = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        mutate(a, randomUUID(), 'summon', { mode }),
      ),
    );
    assert.equal(
      rejected.filter((result) => result.status === 'fulfilled').length,
      0,
    );
  }
  assert.deepEqual((await snapshot(a)).state, beforeRemoved.state);
  console.log(
    'PASS: free and trial modes rejected without mutations; paid/ticket boosters retain five cards and idempotence.',
  );
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    b,
    JSON.stringify({ ...initialPlayer(), munny: 30000 }),
  ]);
  for (let i = 0; i < 3; i++)
    await mutate(b, randomUUID(), 'summon', { mode: 'multi' });
  const missionState = await snapshot(b);
  assert.equal(
    missionState.missions.find((m: MissionStatus) => m.id === 'weekly-25')
      ?.claimable,
    true,
  );
  for (const mission of ['daily-three', 'weekly-25']) {
    const rewards = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        mutate(b, randomUUID(), 'mission', { mission }),
      ),
    );
    assert.equal(rewards.filter((r) => r.status === 'fulfilled').length, 1);
  }
  let afterMissions = await snapshot(b);
  assert.equal(afterMissions.state.munny, 6000);
  assert.equal(afterMissions.state.tickets, 1);
  assert.equal(afterMissions.state.fragments, 25);
  await pool.query(
    'UPDATE "Player" SET state=jsonb_set(state,\'{discoveries}\',$2::jsonb) WHERE id=$1',
    [
      b,
      JSON.stringify(
        JSON.parse(raw)
          .cards.slice(0, 10)
          .map((c: { id: string }) => c.id),
      ),
    ],
  );
  await mutate(b, randomUUID(), 'mission', { mission: 'collect-10' });
  afterMissions = await snapshot(b);
  assert.equal(afterMissions.state.munny, 7000);
  assert.equal(afterMissions.state.fragments, 35);
  await assert.rejects(
    mutate(b, randomUUID(), 'mission', { mission: 'collect-10' }),
  );
  await assert.rejects(
    mutate(a, randomUUID(), 'mission', { mission: 'nonexistent' }),
  );
  await pool.query(
    'UPDATE "Operation" SET "createdAt"=NOW()-INTERVAL \'8 days\' WHERE "playerId"=$1 AND kind=\'summon\'',
    [b],
  );
  const past = await snapshot(b);
  assert.equal(
    past.missions.find((m: MissionStatus) => m.id === 'daily-three')?.progress,
    0,
  );
  assert.equal(
    past.missions.find((m: MissionStatus) => m.id === 'weekly-25')?.progress,
    0,
  );
  console.log(
    'PASS: authoritative daily/weekly counts, concurrent mission claims paid once, ticket/fragment rewards, permanent collection milestone, invalid mission rejected, old summons excluded from current periods.',
  );
  await pool.query(
    "UPDATE \"Player\" SET state=jsonb_set(state,'{munny}','10000') WHERE id=$1",
    [a],
  );
  const boostKey = randomUUID();
  await Promise.all(
    Array.from({ length: 3 }, () =>
      mutate(a, boostKey, 'shop', { item: 'boost-holo' }),
    ),
  );
  assert.equal((await snapshot(a)).state.munny, 9000);
  await assert.rejects(
    mutate(a, randomUUID(), 'shop', { item: 'boost-rare' }),
    /déjà actif/,
  );
  const boosted = await mutate(a, randomUUID(), 'summon', { mode: 'single' });
  assert.equal(boosted.holoRate, 45);
  assert.deepEqual(boosted.rates, [9000, 560, 280, 120, 36, 4]);
  await pool.query(
    `UPDATE "Player" SET state=jsonb_set(state,'{boost,expiresAt}','0') WHERE id=$1`,
    [a],
  );
  const expiredBoost = await mutate(a, randomUUID(), 'summon', {
    mode: 'single',
  });
  assert.equal(expiredBoost.holoRate, 40);
  await mutate(a, randomUUID(), 'shop', { item: 'boost-rare' });
  const rare = await mutate(a, randomUUID(), 'summon', { mode: 'single' });
  assert.deepEqual(rare.rates, [8900, 660, 280, 120, 36, 4]);
  assert.equal(rare.holoRate, 40);
  const ids = [rare.copies[1].id, rare.copies[0].id];
  await mutate(a, randomUUID(), 'showcase', { copies: ids });
  assert.deepEqual(
    showcaseCopies((await snapshot(a)).state).map((copy) => copy.id),
    ids,
  );
  await assert.rejects(mutate(b, randomUUID(), 'showcase', { copies: ids }));
  console.log(
    'PASS: boost replay, balance, stacking restriction, expiry, effective summon odds and ordered owned showcase.',
  );
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
