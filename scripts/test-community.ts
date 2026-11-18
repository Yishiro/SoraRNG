// Non-régression PostgreSQL (schéma isolé, supprimé à la fin) :
// 1. une carte modifiée pendant un échange impose une nouvelle validation,
//    et le transfert remet l'exemplaire à jour (points de stats compris) ;
// 2. un exemplaire en vitrine n'est jamais consommé par une fusion ou un éveil ;
// 3. les contributions de guilde survivent aux départs et ne comptent qu'une fois.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { applyTestMigrations } from './lib/test-migrations';
import { caps, rarities, type Copy, type Player } from '../src/game/core';
import { guildWeek, previousGuildWeek } from '../src/game/community';

const schema = `sora_community_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool, ensurePlayer, mutate, snapshot } =
  await import('../src/server/game');
const { tradeAction } = await import('../src/server/trades');
const { guildBoosters } = await import('../src/server/community');

const prefix = `community-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const copy = (over: Partial<Copy>): Copy => ({
  id: randomUUID(),
  cardId: 'fixture-0-0',
  holo: false,
  level: 1,
  awakening: 0,
  locked: false,
  favorite: false,
  ...over,
});
async function setState(playerId: string, change: Partial<Player>) {
  const state = (await snapshot(playerId)).state as Player;
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    playerId,
    JSON.stringify({ ...state, ...change }),
  ]);
}

try {
  await applyTestMigrations(pool);
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

  // 1. Échange : points de statistiques attribués après la proposition.
  const [a, b] = [id('a'), id('b')];
  await ensurePlayer(a, 'Échange A');
  await ensurePlayer(b, 'Échange B');
  const offered = copy({ fusion: 1 });
  const other = copy({ cardId: 'fixture-1-0' });
  await setState(a, { copies: [offered] });
  await setState(b, { copies: [other] });
  let t = await tradeAction(a, 'invite', { target: b });
  t = await tradeAction(b, 'accept', { id: t.id, revision: t.state.revision });
  t = await tradeAction(a, 'offer', {
    id: t.id,
    revision: t.state.revision,
    copies: [offered.id],
  });
  t = await tradeAction(b, 'offer', {
    id: t.id,
    revision: t.state.revision,
    copies: [other.id],
  });
  t = await tradeAction(a, 'lock', { id: t.id, revision: t.state.revision });
  t = await tradeAction(b, 'lock', { id: t.id, revision: t.state.revision });
  t = await tradeAction(a, 'confirm', { id: t.id, revision: t.state.revision });
  // A répartit un point de fusion après avoir verrouillé et confirmé.
  await mutate(a, randomUUID(), 'allocate', {
    copyId: offered.id,
    stat: 'atk',
  });
  await assert.rejects(
    tradeAction(b, 'confirm', { id: t.id, revision: t.state.revision }),
    /revalider/,
  );
  const reset = (
    await pool.query('SELECT state FROM "Trade" WHERE id=$1', [t.id])
  ).rows[0].state;
  assert.deepEqual(reset.locked, []);
  assert.deepEqual(reset.confirmed, []);
  assert.equal(reset.revision, t.state.revision + 1);
  assert.deepEqual(reset.offers[a][0].bonus, { atk: 1 });
  assert.equal((await snapshot(b)).state.copies[0].id, other.id);
  t = { ...t, state: reset };
  // Les deux joueurs revalident : la carte transmise garde son point.
  t = await tradeAction(a, 'lock', { id: t.id, revision: t.state.revision });
  t = await tradeAction(b, 'lock', { id: t.id, revision: t.state.revision });
  t = await tradeAction(a, 'confirm', { id: t.id, revision: t.state.revision });
  t = await tradeAction(b, 'confirm', { id: t.id, revision: t.state.revision });
  assert.equal(t.state.status, 'completed');
  const received = (await snapshot(b)).state.copies.find(
    (c: Copy) => c.id === offered.id,
  );
  assert.deepEqual(received?.bonus, { atk: 1 });
  assert.equal(received?.fusion, 1);
  // Modification dès le verrouillage : le second verrouillage est refusé aussi.
  const second = copy({ fusion: 2 });
  await setState(a, { copies: [second, copy({})] });
  let u = await tradeAction(a, 'invite', { target: b });
  u = await tradeAction(b, 'accept', { id: u.id, revision: u.state.revision });
  u = await tradeAction(a, 'offer', {
    id: u.id,
    revision: u.state.revision,
    copies: [second.id],
  });
  u = await tradeAction(a, 'lock', { id: u.id, revision: u.state.revision });
  await mutate(a, randomUUID(), 'allocate', { copyId: second.id, stat: 'hp' });
  await assert.rejects(
    tradeAction(b, 'lock', { id: u.id, revision: u.state.revision }),
    /revalider/,
  );
  console.log(
    'PASS: carte modifiée pendant un échange → revalidation des deux joueurs, transfert de l’exemplaire à jour.',
  );

  // 2. Vitrine : aucun doublon exposé ne peut être consommé.
  const c = id('c');
  await ensurePlayer(c, 'Vitrine');
  const target = copy({ level: 5 });
  const shown = copy({});
  await setState(c, { copies: [target, shown], munny: 50000, fragments: 0 });
  await mutate(c, randomUUID(), 'showcase', { copies: [shown.id] });
  await assert.rejects(
    mutate(c, randomUUID(), 'fuse', {
      copyId: target.id,
      duplicateId: shown.id,
    }),
    /vitrine/,
  );
  await assert.rejects(
    mutate(c, randomUUID(), 'awaken', { copyId: target.id }),
    /Doublons standards disponibles insuffisants/,
  );
  let state = (await snapshot(c)).state as Player;
  assert.equal(state.copies.length, 2);
  assert.equal(state.munny, 50000);
  await mutate(c, randomUUID(), 'showcase', { copies: [] });
  await mutate(c, randomUUID(), 'fuse', {
    copyId: target.id,
    duplicateId: shown.id,
  });
  state = (await snapshot(c)).state as Player;
  assert.equal(state.copies.length, 1);
  assert.equal(state.copies[0].fusion, 1);
  console.log(
    'PASS: un exemplaire en vitrine est refusé comme matériau de fusion et d’éveil, même par requête directe.',
  );

  // 3. Guildes : contributions conservées après un départ, jamais doublées.
  const [owner, member, late] = [id('owner'), id('member'), id('late')];
  for (const [p, name] of [
    [owner, 'Chef'],
    [member, 'Membre'],
    [late, 'Retardataire'],
  ])
    await ensurePlayer(p, name);
  await setState(owner, { munny: 100000 });
  await setState(member, { munny: 100000 });
  await setState(late, { munny: 100000 });
  const created = await mutate(owner, randomUUID(), 'guild-create', {
    name: `Gardiens ${prefix.slice(-6)}`,
  });
  const guildId = created.guildId as string;
  await mutate(member, randomUUID(), 'guild-join', { guildId });
  for (let i = 0; i < 3; i++)
    await mutate(member, randomUUID(), 'summon', { mode: 'multi' });
  const week = guildWeek(new Date()).key;
  assert.equal(await guildBoosters(pool, guildId, week), 30);
  await mutate(member, randomUUID(), 'guild-leave', {});
  assert.equal(
    await guildBoosters(pool, guildId, week),
    30,
    'un départ ne doit rien retirer au compteur',
  );
  // Le même joueur fonde une autre guilde : ses nouvelles ouvertures ne
  // comptent que pour elle, les anciennes restent à la première.
  const second2 = await mutate(member, randomUUID(), 'guild-create', {
    name: `Autre ${prefix.slice(-6)}`,
  });
  await mutate(member, randomUUID(), 'summon', { mode: 'single' });
  assert.equal(await guildBoosters(pool, guildId, week), 30);
  assert.equal(await guildBoosters(pool, second2.guildId as string, week), 1);
  // Semaine précédente atteinte grâce à un membre parti depuis : la
  // récompense reste due au chef, présent depuis plus de 72 h.
  const previous = previousGuildWeek(new Date());
  await pool.query(
    `INSERT INTO "GuildContribution" ("guildId","playerId",week,boosters) VALUES ($1,$2,$3,150)`,
    [guildId, member, previous.key],
  );
  await pool.query(
    'UPDATE "GuildMember" SET "joinedAt"=$2 WHERE "playerId"=$1',
    [owner, previous.start],
  );
  const before = ((await snapshot(owner)).state as Player).munny;
  await mutate(owner, randomUUID(), 'guild-reward', {});
  assert.equal(((await snapshot(owner)).state as Player).munny, before + 2000);
  await assert.rejects(mutate(owner, randomUUID(), 'guild-reward', {}));
  // La règle des 72 h tient toujours : un arrivant récent ne touche rien.
  await mutate(late, randomUUID(), 'guild-join', { guildId });
  await assert.rejects(mutate(late, randomUUID(), 'guild-reward', {}), /72 h/);
  console.log(
    'PASS: contributions de guilde conservées après départ, attribuées à une seule guilde, règle des 72 h respectée.',
  );
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
