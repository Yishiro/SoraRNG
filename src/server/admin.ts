import { assertWallet } from '../game/finance';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { pool } from './postgres';
import { discordId } from './auth-policy';
import { ForbiddenAccess, requireStaff, staffRole } from './permissions';
import type { Player } from '../game/core';
import { walletAuditContext } from './wallet-audit';
const reason = z.string().trim().min(8).max(500);
const base = { key: z.uuid(), reason };
export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({
    ...base,
    action: z.literal('resources.adjust'),
    target: z.string().refine(discordId),
    resource: z.enum(['munny', 'tickets', 'fragments']),
    delta: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((n) => n !== 0),
  }),
  z.object({
    ...base,
    action: z.literal('player.suspend'),
    target: z.string().refine(discordId),
    suspended: z.boolean(),
  }),
  z.object({
    ...base,
    action: z.literal('event.save'),
    id: z.uuid().optional(),
    revision: z.number().int().positive().optional(),
    title: z.string().trim().min(3).max(100),
    description: z.string().trim().min(10).max(4000),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    published: z.boolean(),
  }),
]);
export type AdminAction = z.infer<typeof adminActionSchema>;
export async function adminAction(actor: string, raw: unknown) {
  const input = adminActionSchema.parse(raw);
  const role = requireStaff(actor, input.action !== 'player.suspend');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${actor}:${input.key}`,
    ]);
    const prior = (
      await db.query(
        'SELECT request,result FROM "AdminAudit" WHERE "actorId"=$1 AND key=$2',
        [actor, input.key],
      )
    ).rows[0];
    if (prior) {
      if (!isDeepStrictEqual(prior.request, input))
        throw new Error('Clé utilisée pour une autre action');
      await db.query('COMMIT');
      return prior.result;
    }
    let target: string, result: Record<string, unknown>;
    if (input.action === 'event.save') {
      if (new Date(input.endsAt) <= new Date(input.startsAt))
        throw new Error('La fin doit être postérieure au début');
      target = input.id ?? randomUUID();
      const before =
        (
          await db.query('SELECT * FROM "Event" WHERE id=$1 FOR UPDATE', [
            target,
          ])
        ).rows[0] ?? null;
      if (input.id && (!before || input.revision !== before.revision))
        throw new Error('Événement modifié ou introuvable : actualisez');
      const after = (
        await db.query(
          'INSERT INTO "Event" (id,title,description,"startsAt","endsAt",published) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,"startsAt"=EXCLUDED."startsAt","endsAt"=EXCLUDED."endsAt",published=EXCLUDED.published,revision="Event".revision+1,"updatedAt"=NOW() RETURNING *',
          [
            target,
            input.title,
            input.description,
            input.startsAt,
            input.endsAt,
            input.published,
          ],
        )
      ).rows[0];
      result = { before, after, role };
    } else {
      target = input.target;
      const row = (
        await db.query('SELECT state FROM "Player" WHERE id=$1 FOR UPDATE', [
          target,
        ])
      ).rows[0];
      if (!row) throw new Error('Joueur introuvable');
      const state: Player = row.state;
      await walletAuditContext(db, {
        source: 'admin',
        kind: input.action,
        actor,
        reference: input.key,
      });
      if (input.action === 'resources.adjust') {
        const before = {
          munny: state.munny,
          tickets: state.tickets,
          fragments: state.fragments,
        };
        if (
          state[input.resource] + input.delta < 0 ||
          !Number.isSafeInteger(state[input.resource] + input.delta)
        )
          throw new Error('Ajustement impossible : solde invalide');
        state[input.resource] += input.delta;
        const after = {
          munny: state.munny,
          tickets: state.tickets,
          fragments: state.fragments,
        };
        result = { before, after, role };
        await db.query(
          'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result,request) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            randomUUID(),
            target,
            `admin:${actor}:${input.key}`,
            'admin.adjust',
            input.resource === 'munny' ? input.delta : 0,
            JSON.stringify({
              resources: { before, after },
              actor,
              reason: input.reason,
            }),
            JSON.stringify({ resource: input.resource, delta: input.delta }),
          ],
        );
      } else {
        if (input.suspended && staffRole(target) !== 'player')
          throw new ForbiddenAccess(
            'Un compte de l’équipe ne peut pas être suspendu depuis cet outil',
          );
        const before = state.moderation ?? null;
        state.moderation = {
          suspended: input.suspended,
          reason: input.reason,
          updatedAt: new Date().toISOString(),
          actor,
        };
        result = { before, after: state.moderation, role };
      }
      assertWallet(state);
      await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
        target,
        JSON.stringify(state),
      ]);
    }
    const persisted = JSON.parse(JSON.stringify(result));
    await db.query(
      'INSERT INTO "AdminAudit" (id,"actorId",key,action,"targetId",reason,request,result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        randomUUID(),
        actor,
        input.key,
        input.action,
        target,
        input.reason,
        JSON.stringify(input),
        JSON.stringify(persisted),
      ],
    );
    await db.query('COMMIT');
    return persisted;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
export async function adminOverview(actor: string, q = '', cursor = '') {
  const role = requireStaff(actor);
  const players = (
    await pool.query(
      "SELECT id,name,state->>'munny' AS munny,state->>'tickets' AS tickets,state->>'fragments' AS fragments,jsonb_array_length(state->'copies') AS copies,state->'moderation' AS moderation FROM \"Player\" WHERE (id ILIKE $1 OR name ILIKE $1) AND id>$2 ORDER BY id LIMIT 21",
      [`%${q}%`, cursor],
    )
  ).rows;
  const totals = (
    await pool.query(
      'SELECT COUNT(*)::int AS players,COALESCE(SUM(jsonb_array_length(state->\'copies\')),0)::int AS copies FROM "Player"',
    )
  ).rows[0];
  const audit = (
    await pool.query(
      'SELECT id,"actorId",action,"targetId",reason,result,"createdAt" FROM "AdminAudit" ORDER BY "createdAt" DESC,id LIMIT 50',
    )
  ).rows;
  const events = (
    await pool.query(
      'SELECT * FROM "Event" ORDER BY "startsAt" DESC,id LIMIT 100',
    )
  ).rows;
  return {
    role,
    totals,
    players: players.slice(0, 20),
    nextCursor: players.length > 20 ? players[19].id : null,
    audit,
    events,
  };
}
