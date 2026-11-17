import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { applyTestMigrations } from './lib/test-migrations';
const schema = `sora_admin_test_${randomUUID().replaceAll('-', '')}`;
const maintenance = new Pool({ connectionString: process.env.DATABASE_URL });
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const administrator = '111111111111111111',
  moderator = '222222222222222222',
  player = '333333333333333333';
process.env.ADMIN_DISCORD_IDS = administrator;
process.env.MODERATOR_DISCORD_IDS = moderator;
const { pool } = await import('../src/server/postgres');
const { adminAction, adminOverview } = await import('../src/server/admin');
const { ensurePlayer } = await import('../src/server/players');
const { mutate } = await import('../src/server/game');
const { tradeAction } = await import('../src/server/trades');
const { ForbiddenAccess, PlayerSuspended } =
  await import('../src/server/permissions');
const reason = 'Recette automatique isolée';
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  await applyTestMigrations(pool);
  for (const id of [administrator, moderator, player])
    await ensurePlayer(id, `Test ${id}`);
  const adjust = {
    action: 'resources.adjust',
    key: randomUUID(),
    reason,
    target: player,
    resource: 'munny',
    delta: 100,
  };
  await assert.rejects(adminOverview(player), ForbiddenAccess);
  await assert.rejects(adminAction(moderator, adjust), ForbiddenAccess);
  const results = await Promise.all(
    Array.from({ length: 10 }, () => adminAction(administrator, adjust)),
  );
  results.forEach((r) => assert.deepEqual(r, results[0]));
  assert.equal(
    (
      await pool.query(
        'SELECT (state->>\'munny\')::int AS balance FROM "Player" WHERE id=$1',
        [player],
      )
    ).rows[0].balance,
    100,
  );
  assert.equal(
    (await pool.query('SELECT COUNT(*)::int AS n FROM "Operation"')).rows[0].n,
    1,
  );
  assert.equal(
    (await pool.query('SELECT COUNT(*)::int AS n FROM "AdminAudit"')).rows[0].n,
    1,
  );
  await assert.rejects(adminAction(administrator, { ...adjust, delta: 200 }));
  await assert.rejects(
    adminAction(administrator, { ...adjust, key: randomUUID(), delta: -2000 }),
  );
  await assert.rejects(
    adminAction(administrator, {
      ...adjust,
      key: randomUUID(),
      reason: 'court',
    }),
  );
  assert.equal(
    (await pool.query('SELECT COUNT(*)::int AS n FROM "AdminAudit"')).rows[0].n,
    1,
  );
  const suspend = {
    action: 'player.suspend',
    key: randomUUID(),
    reason,
    target: player,
    suspended: true,
  };
  const offered = {
    id: randomUUID(),
    cardId: 'fixture-test-only',
    level: 1,
    awakening: 0,
    holo: false,
    locked: false,
    favorite: false,
  };
  await pool.query(
    'UPDATE "Player" SET state=jsonb_set(state,\'{copies}\',$2::jsonb) WHERE id=$1',
    [administrator, JSON.stringify([offered])],
  );
  let t = await tradeAction(administrator, 'invite', { target: player });
  const steps: [string, string, Parameters<typeof tradeAction>[2]][] = [
    [player, 'accept', {}],
    [administrator, 'offer', { copies: [offered.id] }],
    [administrator, 'lock', {}],
    [player, 'lock', {}],
    [player, 'confirm', {}],
  ];
  for (const [actor, action, extra] of steps)
    t = await tradeAction(actor, action, {
      id: t.id,
      revision: t.state.revision,
      ...extra,
    });
  await adminAction(moderator, suspend);
  await assert.rejects(
    tradeAction(administrator, 'confirm', {
      id: t.id,
      revision: t.state.revision,
    }),
    PlayerSuspended,
  );
  assert.equal(
    (
      await pool.query(
        'SELECT jsonb_array_length(state->\'copies\') AS n FROM "Player" WHERE id=$1',
        [administrator],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(ensurePlayer(player, 'Reconnexion'), PlayerSuspended);
  await assert.rejects(
    mutate(player, randomUUID(), 'daily', {}),
    PlayerSuspended,
  );
  await assert.rejects(
    adminAction(moderator, {
      ...suspend,
      key: randomUUID(),
      target: administrator,
    }),
    ForbiddenAccess,
  );
  await adminAction(moderator, {
    ...suspend,
    key: randomUUID(),
    suspended: false,
  });
  await ensurePlayer(player, 'Retour');
  assert.equal(
    (
      await pool.query(
        'SELECT state->>\'munny\' AS balance FROM "Player" WHERE id=$1',
        [player],
      )
    ).rows[0].balance,
    '100',
  );
  const event = {
    action: 'event.save',
    key: randomUUID(),
    reason,
    title: 'Recette du calendrier',
    description: 'Événement réservé à la base de test.',
    startsAt: '2026-10-29T10:00:00Z',
    endsAt: '2026-10-29T11:00:00Z',
    published: false,
  };
  await assert.rejects(adminAction(moderator, event), ForbiddenAccess);
  await assert.rejects(
    adminAction(administrator, { ...event, endsAt: event.startsAt }),
  );
  const created = await adminAction(administrator, event);
  assert.deepEqual(await adminAction(administrator, event), created);
  assert.equal(
    (await pool.query('SELECT * FROM "Event" WHERE published=true')).rowCount,
    0,
  );
  const saved = {
    ...event,
    id: created.after.id,
    revision: 1,
    published: true,
  };
  const race = await Promise.allSettled([
    adminAction(administrator, { ...saved, key: randomUUID() }),
    adminAction(administrator, { ...saved, key: randomUUID() }),
  ]);
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    (await pool.query('SELECT revision FROM "Event" WHERE published=true'))
      .rows[0].revision,
    2,
  );
  const overview = await adminOverview(moderator, 'Retour');
  assert.equal(overview.players.length, 1);
  assert.equal(overview.role, 'moderator');
  assert.equal(overview.audit.length, 5);
  delete process.env.ADMIN_DISCORD_IDS;
  await assert.rejects(
    adminAction(administrator, { ...adjust, key: randomUUID() }),
    ForbiddenAccess,
  );
  console.log(
    'PASS administration : permissions, révocation, soldes, idempotence concurrente, audit atomique, suspension, reconnexion et événements versionnés. Schéma isolé uniquement.',
  );
} finally {
  await pool.end();
  await maintenance.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await maintenance.end();
}
