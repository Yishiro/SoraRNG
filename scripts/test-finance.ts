import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { initialPlayer } from '../src/game/core';
import { FinanceService } from '../src/server/finance';
import { applyTestMigrations } from './lib/test-migrations';

const schema = `finance_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool, mutate } = await import('../src/server/game');
let now = Date.now(),
  roll = 0,
  calls = 0;
const ranges: number[] = [];
const service = new FinanceService(
  pool,
  () => now,
  (maximum) => {
    ranges.push(maximum);
    calls++;
    return roll;
  },
);
const a = '100000000000000001',
  b = '100000000000000002',
  guildId = '100000000000000003';
const run = (id: string, kind: string, input: Record<string, unknown> = {}) =>
  service.action(id, randomUUID(), kind, input);
const seed = async (id: string, munny = 10000) => {
  await pool.query(
    'INSERT INTO "Player" (id,name,state) VALUES ($1,$1,$2) ON CONFLICT (id) DO UPDATE SET state=$2',
    [id, JSON.stringify({ ...initialPlayer(), munny })],
  );
};
try {
  await applyTestMigrations(pool);
  await seed(a, 0);
  await seed(b);
  await assert.rejects(
    run(a, 'staff.credit', {
      target: a,
      amount: '1000',
      reason: 'Removed command regression',
    }),
  );
  const roundId = randomUUID();
  await pool.query(
    'INSERT INTO "ChatChallenge" (id,"guildId","channelId",content,status,"publishedAt","expiresAt") VALUES ($1,$2,$2,$3,$4,$5,$6)',
    [
      roundId,
      guildId,
      JSON.stringify({
        kind: 'question',
        prompt: 'Test',
        answers: ['42'],
        exact: false,
      }),
      'published',
      new Date(now - 1000),
      new Date(now + 300000),
    ],
  );
  const answer = {
    id: roundId,
    guildId,
    channelId: guildId,
    answer: '42',
    messageId: '100000000000000004',
    sentAt: now - 1,
  };
  const race = await Promise.allSettled([
    service.action(a, 'challenge:' + roundId, 'challenge.answer', answer),
    service.action(b, 'challenge:' + roundId, 'challenge.answer', answer),
  ]);
  assert.equal(
    race.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const winner = (
    await pool.query('SELECT "winnerId" FROM "ChatChallenge" WHERE id=$1', [
      roundId,
    ])
  ).rows[0].winnerId;
  const beforeReplay = (await service.view(winner)).wallet;
  await service.action(
    winner,
    'challenge:' + roundId,
    'challenge.answer',
    answer,
  );
  assert.equal((await service.view(winner)).wallet, beforeReplay);
  assert.equal(
    (await service.view(a)).wallet + (await service.view(b)).wallet,
    10250,
  );
  await seed(a, 0);
  await seed(b);
  await seed(a, 1000);
  const guessAll = (await run(a, 'guess.start', { amount: ' ALL ' })).game!;
  assert.equal((await service.view(a)).wallet, 0);
  assert.equal(guessAll.state.stake, 1000);
  await run(a, 'guess.abandon', { id: guessAll.id });
  for (const game of ['coinflip', 'dice']) {
    await seed(a, 1000);
    const duelAll = (
      await run(a, 'duel.start', { opponent: b, guildId, game, amount: 'all' })
    ).game!;
    assert.equal((await service.view(a)).wallet, 0);
    assert.equal(duelAll.state.stake, 1000);
    await run(a, 'duel.decline', { id: duelAll.id, guildId });
    assert.equal((await service.view(a)).wallet, 1000);
  }
  await seed(a, 1000);
  const doubleKey = randomUUID();
  ranges.length = 0;
  roll = 1;
  calls = 0;
  const doubleResults = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.action(a, doubleKey, 'double', { amount: '100' }),
    ),
  );
  doubleResults.forEach((result) => assert.deepEqual(result, doubleResults[0]));
  assert.equal(calls, 1);
  assert.equal(doubleResults[0].double?.payout, 200);
  assert.deepEqual(ranges, [2]);
  assert.equal((await service.view(a)).wallet, 1100);
  await assert.rejects(
    service.action(a, doubleKey, 'double', { amount: '200' }),
  );
  await assert.rejects(run(a, 'double', { amount: '0' }));
  await assert.rejects(run(a, 'double', { amount: '1101' }));
  roll = 0;
  const doubleLosses = await Promise.allSettled(
    Array.from({ length: 6 }, () => run(a, 'double', { amount: 'all' })),
  );
  assert.equal(
    doubleLosses.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal((await service.view(a)).wallet, 0);
  assert.equal((await service.view(a)).reserved, 0);
  await seed(a, 0);
  const donationKey = randomUUID();
  await Promise.all(
    Array.from({ length: 5 }, () =>
      service.action(b, donationKey, 'donate', {
        recipient: a,
        amount: '1000',
      }),
    ),
  );
  assert.equal((await service.view(a)).wallet, 1000);
  assert.equal((await service.view(b)).wallet, 9000);
  await assert.rejects(run(a, 'donate', { recipient: a, amount: '100' }));
  await assert.rejects(run(a, 'donate', { recipient: b, amount: '2000' }));
  await seed(a, 0);
  await seed(b);
  const claims = await Promise.allSettled([
    mutate(a, randomUUID(), 'daily', {}),
    run(a, 'bonus', { type: 'daily' }),
  ]);
  assert.equal(claims.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await service.view(a)).wallet, 5000);
  const key = randomUUID();
  roll = 1;
  calls = 0;
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.action(a, key, 'roulette', { amount: '100', choice: 'rouge' }),
    ),
  );
  results.forEach((x) => assert.deepEqual(x, results[0]));
  assert.equal(calls, 1);
  assert.equal((await service.view(a)).wallet, 5100);
  await assert.rejects(
    service.action(a, key, 'roulette', { amount: '200', choice: 'rouge' }),
  );
  await seed(a, 4000000000);
  await run(a, 'roulette', { amount: 'all', choice: 'rouge' });
  assert.equal((await service.view(a)).wallet, 8000000000);
  roll = 0;
  const losses = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      run(a, 'roulette', { amount: 'all', choice: 'rouge' }),
    ),
  );
  assert.equal(losses.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await service.view(a)).wallet, 0);
  await seed(a);
  await run(a, 'deposit', { amount: 'all' });
  await assert.rejects(run(a, 'roulette', { amount: '1', choice: 'rouge' }));
  now += 86400000;
  assert.equal((await service.view(a)).bank, '10200');
  await run(a, 'withdraw', { amount: '5000' });
  assert.equal((await service.view(a)).wallet, 5000);
  now += 86400000;
  assert.equal((await service.view(a)).bank, '5304');
  roll = 41;
  const guess = (await run(a, 'guess.start', { amount: '100' })).game!;
  assert.equal('secret' in guess.state, false);
  assert.equal('answer' in guess.state, false);
  assert.equal((await service.resume(a)).games![0].id, guess.id);
  await assert.rejects(run(b, 'guess.attempt', { id: guess.id, number: 42 }));
  const attemptKey = randomUUID();
  await service.action(a, attemptKey, 'guess.attempt', {
    id: guess.id,
    number: 20,
  });
  await service.action(a, attemptKey, 'guess.attempt', {
    id: guess.id,
    number: 20,
  });
  await assert.rejects(run(a, 'guess.attempt', { id: guess.id, number: 20 }));
  const win = await run(a, 'guess.attempt', { id: guess.id, number: 42 });
  assert.equal(win.game!.status, 'won');
  assert.equal(win.wallet, 5200);
  await run(a, 'guess.attempt', { id: guess.id, number: 42 });
  assert.equal((await service.view(a)).wallet, 5200);
  await seed(a);
  await seed(b);
  roll = 0;
  const duelInput = { opponent: b, guildId, amount: '1000', game: 'coinflip' };
  const duel = (await run(a, 'duel.start', duelInput)).game!;
  assert.equal((await service.view(a)).wallet, 9000);
  assert.equal((await service.view(b)).wallet, 10000);
  await assert.rejects(run(a, 'duel.accept', { id: duel.id, guildId }));
  await assert.rejects(run(b, 'duel.accept', { id: duel.id, guildId: a }));
  await Promise.all(
    Array.from({ length: 5 }, () =>
      run(b, 'duel.accept', { id: duel.id, guildId }),
    ),
  );
  assert.equal((await service.view(a)).wallet, 11000);
  assert.equal((await service.view(b)).wallet, 9000);
  const expiring = (await run(a, 'duel.start', duelInput)).game!;
  await assert.rejects(run(a, 'duel.expire', { id: expiring.id }));
  now += 120001;
  await service.expireDue();
  await service.expireDue();
  assert.equal((await service.view(a)).wallet, 11000);
  const declined = (await run(a, 'duel.start', duelInput)).game!;
  await run(b, 'duel.decline', { id: declined.id, guildId });
  assert.equal((await service.view(a)).wallet, 11000);
  const dice = (await run(a, 'duel.start', { ...duelInput, game: 'dice' }))
    .game!;
  await run(b, 'duel.accept', { id: dice.id, guildId });
  assert.equal((await service.view(a)).wallet, 11000);
  assert.equal((await service.view(b)).wallet, 9000);
  assert.equal((await service.view(a)).reserved, 0);
  roll = 41;
  const losingGuess = (await run(a, 'guess.start', { amount: '100' })).game!;
  for (const number of [1, 2, 3, 4, 5])
    await run(a, 'guess.attempt', { id: losingGuess.id, number });
  assert.equal((await service.view(a)).reserved, 0);
  assert.equal((await service.view(a)).wallet, 10900);
  await seed(a);
  const legacyAt = now - 3600000;
  await pool.query(
    'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result,"createdAt") VALUES ($1,$2,$1,$3,2000,$4,$5)',
    [randomUUID(), a, 'daily', '{}', new Date(legacyAt)],
  );
  const sql = await readFile(
    'prisma/migrations/20261029190000_discord_economy/migration.sql',
    'utf8',
  );
  await pool.query(sql.slice(sql.indexOf('UPDATE "Player"')));
  assert.equal(
    (await service.view(a)).bonuses.daily.nextAt,
    legacyAt + 86400000,
  );
  await assert.rejects(run(a, 'bonus', { type: 'daily' }));
  console.log(
    'Finance PostgreSQL: shared claims, concurrency, idempotence, BIGINT, bank, private guesses, duels and refunds passed (isolated schema).',
  );
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
