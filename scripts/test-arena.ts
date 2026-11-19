// Non-régression PostgreSQL de l'arène PvP (schéma isolé, supprimé à la fin) :
// équipe validée côté serveur, attaque idempotente, ligue, quota du jour,
// double clic sur un tour, combat complet avec Elo des deux camps, abandon,
// combat laissé en plan, récompenses mensuelles versées une seule fois.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { applyTestMigrations } from './lib/test-migrations';
import { caps, rarities, type Copy, type Player } from '../src/game/core';
import { pvpRules } from '../src/game/battle/rules';

const schema = `sora_arena_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool, ensurePlayer, snapshot } = await import('../src/server/game');
const arena = await import('../src/server/arena');

const prefix = `arena-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const copy = (cardId: string, level = 1): Copy => ({
  id: randomUUID(),
  cardId,
  holo: false,
  level,
  awakening: 0,
  locked: false,
  favorite: false,
});
async function setState(playerId: string, change: Partial<Player>) {
  const state = (await snapshot(playerId)).state as Player;
  await pool.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
    playerId,
    JSON.stringify({ ...state, ...change }),
  ]);
}
const rating = async (playerId: string) =>
  (
    await pool.query('SELECT * FROM "PvpRating" WHERE "playerId"=$1', [
      playerId,
    ])
  ).rows[0];
const battleRow = async (battleId: string) =>
  (await pool.query('SELECT * FROM "PvpBattle" WHERE id=$1', [battleId]))
    .rows[0];
const munny = async (playerId: string) =>
  ((await snapshot(playerId)).state as Player).munny;

try {
  await applyTestMigrations(pool);
  const elements = ['Feu', 'Eau', 'Terre'];
  const fixture = rarities.flatMap((rarity, i) =>
    Array.from({ length: 4 }, (_, n) => ({
      id: `fixture-${i}-${n}`,
      name: `Test ${i}-${n}`,
      version: 'Test uniquement',
      rarity,
      type: 'Créature',
      role: n === 3 ? 'Objet' : 'Attaquant',
      origin: 'Test',
      affinity: elements[n % 3],
      maxLevel: caps[i],
    })),
  );
  await pool.query(
    'INSERT INTO "Catalogue" (id,cards,version) VALUES ($1,$2,$3)',
    ['standard', JSON.stringify(fixture), 'test-only'],
  );

  const [a, b, c] = [id('a'), id('b'), id('c')];
  await ensurePlayer(a, 'Attaquant');
  await ensurePlayer(b, 'Défenseur');
  await ensurePlayer(c, 'Hors ligue');
  const teamA = [0, 1, 2].map((n) => copy(`fixture-0-${n}`));
  const objectA = copy('fixture-0-3');
  const teamB = [0, 1, 2].map((n) => copy(`fixture-0-${n}`));
  const teamC = [0, 1, 2].map((n) => copy(`fixture-5-${n}`, caps[5]));
  await setState(a, { copies: [...teamA, objectA] });
  await setState(b, { copies: teamB });
  await setState(c, { copies: teamC });

  // 1. Équipe : validation serveur.
  await assert.rejects(arena.saveTeam(a, []), 'équipe vide refusée');
  await assert.rejects(
    arena.saveTeam(a, [teamA[0].id, teamA[0].id]),
    'doublon refusé',
  );
  await assert.rejects(
    arena.saveTeam(a, [...teamA.map((x) => x.id), objectA.id]),
    'plus de 3 cartes refusées',
  );
  await assert.rejects(arena.saveTeam(a, [teamB[0].id]), 'carte d’un autre');
  await assert.rejects(
    arena.saveTeam(a, [objectA.id]),
    'un objet ne combat pas',
  );
  const savedA = await arena.saveTeam(
    a,
    teamA.map((x) => x.id),
  );
  const savedB = await arena.saveTeam(
    b,
    teamB.map((x) => x.id),
  );
  const savedC = await arena.saveTeam(
    c,
    teamC.map((x) => x.id),
  );
  assert.equal(savedA.league, 'bronze');
  assert.equal(savedB.league, 'bronze');
  assert.notEqual(
    savedC.league,
    'bronze',
    'les cartes secrètes changent de ligue',
  );

  // 2. Ligue différente refusée, attaque idempotente.
  await assert.rejects(arena.attack(a, randomUUID(), c), /ligue/);
  const first = randomUUID();
  assert.equal(await arena.attack(a, first, b), first);
  assert.equal(await arena.attack(a, first, b), first, 'même clé, même combat');
  assert.equal((await rating(a)).attacksUsed, 1, 'une seule attaque comptée');
  await assert.rejects(
    arena.attack(a, randomUUID(), b),
    /combat en cours/,
    'un seul combat actif à la fois',
  );
  const view = await arena.battleView(a, first);
  assert.equal('seed' in view.state, false, 'la graine reste secrète');
  await assert.rejects(arena.battleView(c, first), /introuvable/);

  // 3. Double clic : deux envois du même tour, un seul est joué.
  const both = await Promise.allSettled([
    arena.playTurn(a, first, 0, { type: 'move', index: 0 }),
    arena.playTurn(a, first, 0, { type: 'move', index: 0 }),
  ]);
  assert.equal(both.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = both.find((r) => r.status === 'rejected') as
    PromiseRejectedResult | undefined;
  assert.ok(rejected?.reason instanceof arena.ArenaConflict);
  assert.equal((await battleRow(first)).state.turn, 1);

  // 4. Combat mené jusqu'au bout : Elo des deux camps, bilans.
  for (let guard = 0; guard < 200; guard++) {
    const current = await arena.battleView(a, first);
    if (current.status !== 'active') break;
    if (current.needsReplacement) {
      const next = current.state.teams.a.findIndex((f) => f.hp > 0);
      await arena.replaceFighter(a, first, next);
    } else
      await arena.playTurn(a, first, current.state.turn, {
        type: 'move',
        index: 0,
      });
  }
  const done = await battleRow(first);
  assert.equal(done.status, 'finished');
  const [ra, rb] = [await rating(a), await rating(b)];
  assert.equal(ra.rating + rb.rating, 2 * pvpRules.elo.start, 'Elo conservé');
  assert.equal(ra.wins + ra.losses + ra.draws, 1);
  assert.equal(rb.wins + rb.losses + rb.draws, 1);
  if (done.winner === 'a') assert.equal(rb.losses, 1);
  if (done.winner === 'b') assert.equal(rb.wins, 1);
  assert.equal(done.result.attacker.after, ra.rating);
  await assert.rejects(
    arena.playTurn(a, first, done.state.turn, { type: 'move', index: 0 }),
    (e) => e instanceof arena.ArenaConflict,
  );

  // 5. Abandon : victoire du défenseur.
  const second = randomUUID();
  await arena.attack(a, second, b);
  await arena.forfeit(a, second);
  await arena.forfeit(a, second);
  const forfeited = await battleRow(second);
  assert.equal(forfeited.winner, 'b');
  assert.equal(forfeited.result.reason, 'abandon');
  assert.equal(
    (await rating(b)).wins + (await rating(b)).losses,
    2,
    'un abandon répété ne compte qu’une fois',
  );

  // 6. Combat laissé en plan : abandon au bout du délai.
  const third = randomUUID();
  await arena.attack(a, third, b);
  await pool.query(
    `UPDATE "PvpBattle" SET "updatedAt"=now()-interval '31 minutes' WHERE id=$1`,
    [third],
  );
  const overview = await arena.arenaOverview(a);
  assert.equal(overview.active, null);
  assert.equal((await battleRow(third)).result.reason, 'abandon');
  assert.equal(overview.attacksLeft, pvpRules.arena.attacksPerDay - 3);

  // 7. Équipe modifiée (carte vendue) : l'attaquant doit l'enregistrer à nouveau.
  await setState(a, { copies: teamA.slice(1) });
  await assert.rejects(arena.attack(a, randomUUID(), b), /enregistrez-la/);
  await setState(a, { copies: teamA });

  // 8. Quota du jour.
  await pool.query(
    'UPDATE "PvpRating" SET "attacksUsed"=$2 WHERE "playerId"=$1',
    [a, pvpRules.arena.attacksPerDay],
  );
  await assert.rejects(arena.attack(a, randomUUID(), b), /par jour/);

  // 9. Récompenses de novembre : top de la ligue Bronze, versées une fois.
  await pool.query(`UPDATE "PvpBattle" SET "updatedAt"='2026-11-15T12:00:00Z'`);
  const before = { a: await munny(a), b: await munny(b), c: await munny(c) };
  const december = new Date('2026-12-02T12:00:00Z');
  await arena.settleArena(december);
  const standings = (
    await pool.query('SELECT standings FROM "PvpSettlement" WHERE id=$1', [
      '2026-11',
    ])
  ).rows[0].standings as { id: string; reward: number }[];
  assert.equal(standings.length, 2, 'C n’a livré aucun combat : non classé');
  for (const s of standings)
    assert.equal(await munny(s.id), before[s.id === a ? 'a' : 'b'] + s.reward);
  assert.deepEqual(
    standings.map((s) => s.reward).sort((x, y) => y - x),
    pvpRules.monthlyRewards.slice(0, 2),
  );
  assert.equal(await munny(c), before.c);
  // Une seconde instance (cache mémoire vide) ne paie pas deux fois.
  await pool.query('DELETE FROM "PvpSettlement"');
  const paid = { a: await munny(a), b: await munny(b) };
  await arena.settleArena(new Date('2027-01-02T12:00:00Z'));
  assert.equal(await munny(a), paid.a);
  assert.equal(await munny(b), paid.b);
  console.log(
    'PASS: équipe validée, attaque idempotente, ligue et quota respectés, double clic sans effet, Elo conservé, abandon et délai, récompenses versées une seule fois.',
  );
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
