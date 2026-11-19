// Arène PvP asynchrone : l'attaquant joue, l'IA défend l'équipe d'un absent.
// Le serveur détient seul l'état (et la graine) du combat ; chaque action est
// une transaction avec verrou, et le numéro de tour empêche de jouer deux fois.
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Card, Player } from '../game/core';
import { assertWallet } from '../game/finance';
import { parisDay } from '../game/streak';
import {
  activeFighter,
  buildFighter,
  cardCanFight,
  createBattle,
  needsReplacement,
  replace,
  resolveTurn,
  teamPower,
  type Action,
  type BattleEvent,
  type BattleState,
  type Fighter,
} from '../game/battle/engine';
import { chooseAction, chooseReplacement } from '../game/battle/ai';
import { eloUpdate, leagueOf, leagues, pvpRules } from '../game/battle/rules';
import { previousSeason, seasonBounds, seasonId } from '../game/seasons';
import { catalog, pool } from './play';
import { walletAuditContext } from './wallet-audit';

type Db = Pool | PoolClient;
export const firstArenaMonth = '2026-11';

export class ArenaConflict extends Error {}

async function tx<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function playerState(db: Db, id: string, lock = false) {
  const row = (
    await db.query(
      `SELECT name,state FROM "Player" WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    )
  ).rows[0] as { name: string; state: Player } | undefined;
  if (!row) throw new Error('Profil introuvable.');
  if (row.state.moderation?.suspended)
    throw new Error('Ce compte est suspendu.');
  return row;
}

// Exemplaires bloqués : proposés dans un échange en cours (les cartes aux
// enchères ont déjà quitté l'inventaire).
async function copiesInTrades(db: Db, playerId: string) {
  const rows = (
    await db.query(
      `SELECT state->'offers'->$1 AS offer FROM "Trade"
        WHERE (a=$1 OR b=$1) AND state->>'status' IN ('invited','open') AND "expiresAt">now()`,
      [playerId],
    )
  ).rows;
  return new Set<string>(
    rows.flatMap((r) =>
      Array.isArray(r.offer) ? r.offer.map((c: { id: string }) => c.id) : [],
    ),
  );
}

export function buildTeam(
  cards: Card[],
  player: Player,
  copyIds: unknown,
  blocked: Set<string>,
): Fighter[] {
  const { minSize, maxSize } = pvpRules.team;
  if (
    !Array.isArray(copyIds) ||
    copyIds.length < minSize ||
    copyIds.length > maxSize ||
    new Set(copyIds).size !== copyIds.length
  )
    throw new Error(
      `Choisissez de ${minSize} à ${maxSize} exemplaires différents.`,
    );
  return copyIds.map((id) => {
    const copy = player.copies.find((c) => c.id === id);
    if (!copy)
      throw new Error(
        'Un exemplaire de l’équipe n’est plus dans votre collection.',
      );
    if (blocked.has(copy.id))
      throw new Error(
        'Un exemplaire de l’équipe est proposé dans un échange en cours.',
      );
    const card = cards.find((c) => c.id === copy.cardId);
    if (!card || !cardCanFight(card))
      throw new Error('Les objets ne combattent pas.');
    return buildFighter(card, copy);
  });
}

async function ensureRating(db: Db, playerId: string) {
  await db.query(
    'INSERT INTO "PvpRating" ("playerId",rating) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [playerId, pvpRules.elo.start],
  );
}

export async function saveTeam(playerId: string, copyIds: unknown) {
  return tx(async (db) => {
    const { state } = await playerState(db, playerId, true);
    const cards = await catalog(db);
    const team = buildTeam(
      cards,
      state,
      copyIds,
      await copiesInTrades(db, playerId),
    );
    const power = teamPower(team);
    const league = leagueOf(power).id;
    await db.query(
      `INSERT INTO "PvpTeam" ("playerId","copyIds",power,league,"updatedAt") VALUES ($1,$2,$3,$4,now())
       ON CONFLICT ("playerId") DO UPDATE SET "copyIds"=EXCLUDED."copyIds",power=EXCLUDED.power,league=EXCLUDED.league,"updatedAt"=now()`,
      [playerId, JSON.stringify(copyIds), power, league],
    );
    await ensureRating(db, playerId);
    return { power, league };
  });
}

type BattleRow = {
  id: string;
  attackerId: string;
  defenderId: string;
  state: BattleState;
  log: (BattleEvent & { turn: number })[];
  status: string;
  winner: string | null;
  result: Record<string, unknown> | null;
  updatedAt: Date;
};

// Fin de combat : Elo des deux camps, bilans, résultat figé.
async function finalize(
  db: PoolClient,
  battle: BattleRow,
  winner: 'a' | 'b' | 'draw',
  reason: 'victoire' | 'abandon' | 'limite',
) {
  const rows = (
    await db.query(
      'SELECT "playerId",rating FROM "PvpRating" WHERE "playerId"=ANY($1::text[]) ORDER BY "playerId" FOR UPDATE',
      [[battle.attackerId, battle.defenderId]],
    )
  ).rows as { playerId: string; rating: number }[];
  const rating = new Map(rows.map((r) => [r.playerId, r.rating]));
  const a = rating.get(battle.attackerId) ?? pvpRules.elo.start;
  const b = rating.get(battle.defenderId) ?? pvpRules.elo.start;
  let after: { a: number; b: number };
  if (winner === 'a') {
    const r = eloUpdate(a, b);
    after = { a: r.winner, b: r.loser };
  } else if (winner === 'b') {
    const r = eloUpdate(b, a);
    after = { a: r.loser, b: r.winner };
  } else {
    const r = eloUpdate(a, b, true);
    after = { a: r.winner, b: r.loser };
  }
  const column = (side: 'a' | 'b') =>
    winner === 'draw' ? 'draws' : winner === side ? 'wins' : 'losses';
  await db.query(
    `UPDATE "PvpRating" SET rating=$2,${column('a')}=${column('a')}+1,"updatedAt"=now() WHERE "playerId"=$1`,
    [battle.attackerId, after.a],
  );
  await db.query(
    `UPDATE "PvpRating" SET rating=$2,${column('b')}=${column('b')}+1,"updatedAt"=now() WHERE "playerId"=$1`,
    [battle.defenderId, after.b],
  );
  const result = {
    reason,
    attacker: { before: a, after: after.a },
    defender: { before: b, after: after.b },
  };
  battle.status = 'finished';
  battle.winner = winner;
  battle.result = result;
  if (!battle.state.winner) battle.state.winner = winner;
  if (reason !== 'victoire')
    battle.log.push({ type: 'end', winner, turn: battle.state.turn });
  await db.query(
    `UPDATE "PvpBattle" SET status='finished',winner=$2,result=$3,state=$4,log=$5,"updatedAt"=now() WHERE id=$1`,
    [
      battle.id,
      winner,
      JSON.stringify(result),
      JSON.stringify(battle.state),
      JSON.stringify(battle.log),
    ],
  );
}

async function expireStale(db: PoolClient, attackerId: string, now: number) {
  const stale = (
    await db.query(
      `SELECT * FROM "PvpBattle" WHERE "attackerId"=$1 AND status='active' AND "updatedAt"<$2 FOR UPDATE`,
      [attackerId, new Date(now - pvpRules.arena.staleMs)],
    )
  ).rows as BattleRow[];
  for (const battle of stale) await finalize(db, battle, 'b', 'abandon');
}

export async function attack(
  attackerId: string,
  battleId: string,
  defenderId: string,
  now = Date.now(),
) {
  return tx(async (db) => {
    await ensureRating(db, attackerId);
    const quota = (
      await db.query(
        'SELECT * FROM "PvpRating" WHERE "playerId"=$1 FOR UPDATE',
        [attackerId],
      )
    ).rows[0];
    // Idempotence : la même clé renvoie le même combat.
    const existing = (
      await db.query('SELECT * FROM "PvpBattle" WHERE id=$1', [battleId])
    ).rows[0] as BattleRow | undefined;
    if (existing) {
      if (
        existing.attackerId !== attackerId ||
        existing.defenderId !== defenderId
      )
        throw new Error('Identifiant de combat déjà utilisé.');
      return existing.id;
    }
    if (defenderId === attackerId)
      throw new Error('Choisissez un autre adversaire.');
    await expireStale(db, attackerId, now);
    if (
      (
        await db.query(
          `SELECT 1 FROM "PvpBattle" WHERE "attackerId"=$1 AND status='active'`,
          [attackerId],
        )
      ).rowCount
    )
      throw new Error(
        'Terminez votre combat en cours avant d’en lancer un autre.',
      );
    const day = parisDay(now);
    const used = quota.attackDay === day ? quota.attacksUsed : 0;
    if (used >= pvpRules.arena.attacksPerDay)
      throw new Error(
        `${pvpRules.arena.attacksPerDay} attaques d’arène par jour : revenez demain.`,
      );
    const teams = (
      await db.query(
        'SELECT * FROM "PvpTeam" WHERE "playerId"=ANY($1::text[])',
        [[attackerId, defenderId]],
      )
    ).rows as { playerId: string; copyIds: string[]; league: string }[];
    const mine = teams.find((t) => t.playerId === attackerId);
    const theirs = teams.find((t) => t.playerId === defenderId);
    if (!mine) throw new Error('Enregistrez d’abord votre équipe.');
    if (!theirs) throw new Error('Cet adversaire n’a pas d’équipe de défense.');
    if (mine.league !== theirs.league)
      throw new Error('Cet adversaire n’est pas dans votre ligue.');
    const cards = await catalog(db);
    const attackerPlayer = await playerState(db, attackerId);
    const defenderPlayer = await playerState(db, defenderId);
    let attackerTeam: Fighter[];
    try {
      attackerTeam = buildTeam(
        cards,
        attackerPlayer.state,
        mine.copyIds,
        await copiesInTrades(db, attackerId),
      );
    } catch {
      throw new Error('Votre équipe a changé : enregistrez-la à nouveau.');
    }
    // Côté défense, les exemplaires vendus ou échangés depuis sont simplement retirés.
    const blocked = await copiesInTrades(db, defenderId);
    const defenderTeam = theirs.copyIds.flatMap((id) => {
      try {
        return buildTeam(cards, defenderPlayer.state, [id], blocked);
      } catch {
        return [];
      }
    });
    if (!defenderTeam.length)
      throw new Error('L’équipe de cet adversaire est indisponible.');
    await ensureRating(db, defenderId);
    const state = createBattle(attackerTeam, defenderTeam, battleId);
    await db.query(
      'INSERT INTO "PvpBattle" (id,mode,"attackerId","defenderId",state) VALUES ($1,$2,$3,$4,$5)',
      [battleId, 'arena', attackerId, defenderId, JSON.stringify(state)],
    );
    await db.query(
      'UPDATE "PvpRating" SET "attackDay"=$2,"attacksUsed"=$3,"updatedAt"=now() WHERE "playerId"=$1',
      [attackerId, day, used + 1],
    );
    return battleId;
  });
}

async function lockBattle(
  db: PoolClient,
  attackerId: string,
  battleId: string,
  now: number,
) {
  const battle = (
    await db.query('SELECT * FROM "PvpBattle" WHERE id=$1 FOR UPDATE', [
      battleId,
    ])
  ).rows[0] as BattleRow | undefined;
  if (!battle || battle.attackerId !== attackerId)
    throw new Error('Combat introuvable.');
  if (
    battle.status === 'active' &&
    new Date(battle.updatedAt).getTime() < now - pvpRules.arena.staleMs
  ) {
    await finalize(db, battle, 'b', 'abandon');
  }
  return battle;
}

async function save(db: PoolClient, battle: BattleRow) {
  await db.query(
    'UPDATE "PvpBattle" SET state=$2,log=$3,"updatedAt"=now() WHERE id=$1',
    [battle.id, JSON.stringify(battle.state), JSON.stringify(battle.log)],
  );
}

export async function playTurn(
  attackerId: string,
  battleId: string,
  expectedTurn: number,
  action: Action,
  now = Date.now(),
) {
  return tx(async (db) => {
    const battle = await lockBattle(db, attackerId, battleId, now);
    if (battle.status !== 'active')
      throw new ArenaConflict('Ce combat est terminé.');
    // Le numéro de tour attendu rend un double clic sans effet.
    if (battle.state.turn !== expectedTurn)
      throw new ArenaConflict('Le combat a avancé : rechargez-le.');
    const state = battle.state;
    const events = resolveTurn(state, {
      a: action,
      b: chooseAction(state, 'b'),
    });
    if (needsReplacement(state, 'b'))
      events.push(...replace(state, 'b', chooseReplacement(state, 'b')!));
    battle.log.push(...events.map((e) => ({ ...e, turn: state.turn })));
    if (state.winner)
      await finalize(
        db,
        battle,
        state.winner,
        (['a', 'b'] as const).every((side) =>
          state.teams[side].some((f) => f.hp > 0),
        )
          ? 'limite'
          : 'victoire',
      );
    else await save(db, battle);
    return battle.id;
  });
}

export async function replaceFighter(
  attackerId: string,
  battleId: string,
  to: number,
  now = Date.now(),
) {
  return tx(async (db) => {
    const battle = await lockBattle(db, attackerId, battleId, now);
    if (battle.status !== 'active')
      throw new ArenaConflict('Ce combat est terminé.');
    const events = replace(battle.state, 'a', to);
    battle.log.push(...events.map((e) => ({ ...e, turn: battle.state.turn })));
    await save(db, battle);
    return battle.id;
  });
}

export async function forfeit(
  attackerId: string,
  battleId: string,
  now = Date.now(),
) {
  return tx(async (db) => {
    const battle = await lockBattle(db, attackerId, battleId, now);
    if (battle.status === 'active') await finalize(db, battle, 'b', 'abandon');
    return battle.id;
  });
}

// Vue envoyée au joueur : sans la graine ni le compteur de tirages.
export function publicBattle(row: BattleRow) {
  // Graine et compteur retirés : ils permettraient de prévoir les coups.
  const state = {
    turn: row.state.turn,
    teams: row.state.teams,
    active: row.state.active,
    winner: row.state.winner,
  };
  return {
    id: row.id,
    attackerId: row.attackerId,
    defenderId: row.defenderId,
    status: row.status,
    winner: row.winner,
    result: row.result,
    state,
    log: row.log.slice(-40),
    needsReplacement:
      row.status === 'active' && needsReplacement(row.state, 'a'),
    active: {
      a: activeFighter(row.state, 'a').name,
      b: activeFighter(row.state, 'b').name,
    },
  };
}

export async function battleView(attackerId: string, battleId: string) {
  const row = (
    await pool.query('SELECT * FROM "PvpBattle" WHERE id=$1', [battleId])
  ).rows[0] as BattleRow | undefined;
  if (!row || (row.attackerId !== attackerId && row.defenderId !== attackerId))
    throw new Error('Combat introuvable.');
  return publicBattle(row);
}

export async function arenaOverview(playerId: string, now = Date.now()) {
  await tx((db) => expireStale(db, playerId, now));
  const [team, rating] = await Promise.all([
    pool.query(
      'SELECT "copyIds",power,league FROM "PvpTeam" WHERE "playerId"=$1',
      [playerId],
    ),
    pool.query('SELECT * FROM "PvpRating" WHERE "playerId"=$1', [playerId]),
  ]);
  const myTeam = team.rows[0] as
    { copyIds: string[]; power: number; league: string } | undefined;
  const myRating = rating.rows[0] ?? {
    rating: pvpRules.elo.start,
    wins: 0,
    losses: 0,
    draws: 0,
    attackDay: '',
    attacksUsed: 0,
  };
  const day = parisDay(now);
  const attacksLeft =
    pvpRules.arena.attacksPerDay -
    (myRating.attackDay === day ? myRating.attacksUsed : 0);
  const opponents = myTeam
    ? (
        await pool.query(
          `SELECT t."playerId" AS id,p.name,t.power,COALESCE(r.rating,$3)::int AS rating
             FROM "PvpTeam" t JOIN "Player" p ON p.id=t."playerId" LEFT JOIN "PvpRating" r ON r."playerId"=t."playerId"
            WHERE t.league=$1 AND t."playerId"<>$2 AND COALESCE(p.state#>>'{moderation,suspended}','false')<>'true'
            ORDER BY abs(COALESCE(r.rating,$3)-$4),t."updatedAt" DESC LIMIT $5`,
          [
            myTeam.league,
            playerId,
            pvpRules.elo.start,
            myRating.rating,
            pvpRules.arena.opponentsShown,
          ],
        )
      ).rows
    : [];
  const ranking = (
    await pool.query(
      `SELECT t.league,t."playerId" AS id,p.name,r.rating,r.wins,r.losses
         FROM "PvpTeam" t JOIN "PvpRating" r ON r."playerId"=t."playerId" JOIN "Player" p ON p.id=t."playerId"
        WHERE COALESCE(p.state#>>'{moderation,suspended}','false')<>'true'
        ORDER BY r.rating DESC,r.wins DESC,t."playerId" LIMIT 400`,
    )
  ).rows;
  const leaderboards = Object.fromEntries(
    leagues.map((l) => [
      l.id,
      ranking.filter((r) => r.league === l.id).slice(0, 10),
    ]),
  );
  const active = (
    await pool.query(
      `SELECT * FROM "PvpBattle" WHERE "attackerId"=$1 AND status='active' LIMIT 1`,
      [playerId],
    )
  ).rows[0] as BattleRow | undefined;
  const recent = (
    await pool.query(
      `SELECT b.id,b."attackerId",b."defenderId",b.winner,b.result,b."updatedAt",pa.name AS "attackerName",pd.name AS "defenderName"
         FROM "PvpBattle" b JOIN "Player" pa ON pa.id=b."attackerId" JOIN "Player" pd ON pd.id=b."defenderId"
        WHERE (b."attackerId"=$1 OR b."defenderId"=$1) AND b.status='finished'
        ORDER BY b."updatedAt" DESC LIMIT 10`,
      [playerId],
    )
  ).rows;
  return {
    team: myTeam ?? null,
    rating: {
      rating: myRating.rating,
      wins: myRating.wins,
      losses: myRating.losses,
      draws: myRating.draws,
    },
    attacksLeft,
    opponents,
    leaderboards,
    active: active ? publicBattle(active) : null,
    recent,
  };
}

// --- Récompenses mensuelles : top 3 de chaque ligue, versés une seule fois ---
export async function arenaStandings(db: Db, month: string) {
  const { start, end } = seasonBounds(month);
  return (
    await db.query(
      `SELECT t.league,r."playerId" AS id,p.name,r.rating
         FROM "PvpRating" r JOIN "PvpTeam" t ON t."playerId"=r."playerId" JOIN "Player" p ON p.id=r."playerId"
        WHERE COALESCE(p.state#>>'{moderation,suspended}','false')<>'true'
          AND (SELECT count(*) FROM "PvpBattle" b WHERE b.status='finished'
                 AND (b."attackerId"=r."playerId" OR b."defenderId"=r."playerId")
                 AND b."updatedAt">=$1 AND b."updatedAt"<$2) >= $3
        ORDER BY r.rating DESC,r.wins DESC,r."playerId"`,
      [start, end, pvpRules.arena.monthlyMinBattles],
    )
  ).rows as { league: string; id: string; name: string; rating: number }[];
}

let settledThrough = '';
export async function settleArena(now = new Date()) {
  const last = previousSeason(seasonId(now));
  if (last < firstArenaMonth || settledThrough === last) return;
  await tx(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('sorarng:arena'))");
    const done = new Set(
      (await db.query('SELECT id FROM "PvpSettlement"')).rows.map((r) => r.id),
    );
    for (
      let month = last;
      month >= firstArenaMonth;
      month = previousSeason(month)
    ) {
      if (done.has(month)) break;
      const standings = await arenaStandings(db, month);
      await walletAuditContext(db, {
        source: 'system',
        kind: 'arena.reward',
        reference: `arena:${month}`,
      });
      const podium: {
        league: string;
        id: string;
        name: string;
        rating: number;
        rank: number;
        reward: number;
      }[] = [];
      for (const league of leagues) {
        standings
          .filter((s) => s.league === league.id)
          .slice(0, pvpRules.monthlyRewards.length)
          .forEach((s, i) =>
            podium.push({
              ...s,
              rank: i + 1,
              reward: pvpRules.monthlyRewards[i],
            }),
          );
      }
      for (const winner of podium.sort((x, y) => x.id.localeCompare(y.id))) {
        const inserted = await db.query(
          'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result,request) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("playerId",key) DO NOTHING RETURNING id',
          [
            randomUUID(),
            winner.id,
            `arena:${month}:${winner.league}`,
            'arena.reward',
            winner.reward,
            JSON.stringify(winner),
            '{}',
          ],
        );
        if (!inserted.rowCount) continue;
        const state = (
          await db.query('SELECT state FROM "Player" WHERE id=$1 FOR UPDATE', [
            winner.id,
          ])
        ).rows[0]?.state as Player | undefined;
        if (!state || state.moderation?.suspended) continue;
        state.munny += winner.reward;
        assertWallet(state);
        await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
          winner.id,
          JSON.stringify(state),
        ]);
      }
      await db.query(
        'INSERT INTO "PvpSettlement" (id,standings) VALUES ($1,$2)',
        [month, JSON.stringify(podium)],
      );
    }
  });
  settledThrough = last;
}
