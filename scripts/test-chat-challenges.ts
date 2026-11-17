import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  ChannelType,
  type Client,
  type Message,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { ChatChallenges } from '../bot/challenges';
import { FinanceService } from '../src/server/finance';
import { initialPlayer } from '../src/game/core';
import { applyTestMigrations } from './lib/test-migrations';
const schema = 'chat_test_' + randomUUID().replaceAll('-', '');
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
const db = new Pool({ connectionString: url.toString() });
const a = '100000000000000001',
  b = '100000000000000002',
  guild = '100000000000000003',
  channelId = '100000000000000004';
let sends = 0,
  edits = 0;
const announcements: string[] = [];
const channel = {
  guildId: guild,
  permissionsFor: () => ({ has: () => true }),
  type: ChannelType.GuildText,
  send: async (options: { content?: string } = {}) => {
    sends++;
    if (options.content) announcements.push(options.content);
    return { id: '100000000000000005', createdTimestamp: Date.now() };
  },
  messages: {
    fetch: async () => ({
      edit: async () => {
        edits++;
      },
    }),
  },
};
const client = {
  isReady: () => true,
  channels: { fetch: async () => channel },
} as unknown as Client;
try {
  await applyTestMigrations(db);
  for (const id of [a, b])
    await db.query('INSERT INTO "Player" (id,name,state) VALUES ($1,$1,$2)', [
      id,
      JSON.stringify(initialPlayer()),
    ]);
  await db.query(
    'INSERT INTO "ChatChallengeConfig" ("guildId","channelId","nextAt","updatedBy") VALUES ($1,$2,NOW()-INTERVAL \'1 second\',$3)',
    [guild, channelId, a],
  );
  const service = new FinanceService(db),
    challenges = new ChatChallenges(db, client, service, true);
  await Promise.all([challenges.tick(), challenges.tick()]);
  assert.equal(sends, 1);
  const round = (await db.query('SELECT * FROM "ChatChallenge"')).rows[0];
  assert.equal(round.status, 'published');
  assert.equal(round.expiresAt.getTime() - round.publishedAt.getTime(), 300000);
  const message = (id: string) =>
    ({
      author: { id, bot: false },
      guildId: guild,
      channelId,
      content: round.content.answers[0],
      id:
        id === '100000000000000001'
          ? '100000000000000006'
          : '100000000000000007',
      createdTimestamp: Date.now(),
    }) as Message;
  await challenges.answer(message('100000000000000008'));
  assert.equal(
    (
      await db.query('SELECT status FROM "ChatChallenge" WHERE id=$1', [
        round.id,
      ])
    ).rows[0].status,
    'published',
  );
  await Promise.all([
    challenges.answer(message(a)),
    challenges.answer(message(b)),
  ]);
  await challenges.tick();
  const wallets = (await db.query('SELECT state FROM "Player"')).rows.map(
    (row) => row.state.munny,
  );
  assert.equal(
    wallets.reduce((sum, value) => sum + value, 0),
    250,
  );
  assert.equal(edits, 1);
  assert.equal(announcements.length, 1);
  assert.ok(
    announcements[0].includes(`<@${a}>`) &&
      announcements[0].includes('250 Munny'),
  );
  const restarted = new ChatChallenges(
    db,
    client,
    new FinanceService(db),
    true,
  );
  await restarted.tick();
  assert.equal(sends, 2);
  assert.equal(edits, 1);
  const next = (await db.query('SELECT "nextAt" FROM "ChatChallengeConfig"'))
    .rows[0].nextAt;
  assert.ok(next.getTime() - Date.now() > 19 * 60000);
  await db.query(
    'UPDATE "ChatChallengeConfig" SET enabled=false,"nextAt"=NOW()-INTERVAL \'1 minute\'',
  );
  await restarted.tick();
  assert.equal(sends, 2);
  const pausedAt = (
    await db.query('SELECT "nextAt" FROM "ChatChallengeConfig"')
  ).rows[0].nextAt.getTime();
  const manual = {
    id: '100000000000000009',
    guildId: guild,
    memberPermissions: { has: () => true },
    deferReply: async () => {},
    editReply: async () => {},
  } as unknown as ChatInputCommandInteraction;
  await Promise.all([restarted.force(manual), restarted.force(manual)]);
  assert.equal(sends, 3);
  const unchanged = (
    await db.query('SELECT "nextAt",enabled FROM "ChatChallengeConfig"')
  ).rows[0];
  assert.equal(unchanged.enabled, false);
  assert.equal(unchanged.nextAt.getTime(), pausedAt);
  await assert.rejects(
    restarted.force({
      ...manual,
      id: '100000000000000010',
    } as ChatInputCommandInteraction),
  );
  await assert.rejects(
    restarted.force({
      ...manual,
      memberPermissions: { has: () => false },
    } as unknown as ChatInputCommandInteraction),
  );
  assert.equal(sends, 3);
  console.log(
    'PASS: persistent 20-minute scheduler, concurrent ticks publish once, first correct reply credited once, public winner announced once, restart resumes, disabled schedule stays silent (isolated PostgreSQL and simulated Discord).',
  );
} finally {
  await db.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
