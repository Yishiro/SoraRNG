import { randomUUID } from 'node:crypto';
import type { Copy, Player } from '../game/core';
import { pool } from './game';
import { PlayerSuspended } from './permissions';
export type TradeState = {
  status: 'invited' | 'open' | 'completed' | 'cancelled';
  revision: number;
  offers: Record<string, Copy[]>;
  locked: string[];
  confirmed: string[];
};
export type Trade = {
  id: string;
  a: string;
  b: string;
  aName?: string;
  bName?: string;
  state: TradeState;
  expiresAt: string;
};
export async function tradeAction(
  userId: string,
  action: string,
  input: { id?: string; target?: string; copies?: string[]; revision?: number },
) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    if (action === 'invite') {
      if (!input.target || input.target === userId)
        throw new Error('Destinataire invalide');
      const recipient = (
        await db.query('SELECT state FROM "Player" WHERE id=$1', [input.target])
      ).rows[0];
      if (!recipient || recipient.state.moderation?.suspended)
        throw new Error('Ce joueur est indisponible');
      const state: TradeState = {
        status: 'invited',
        revision: 0,
        offers: { [userId]: [], [input.target]: [] },
        locked: [],
        confirmed: [],
      };
      const id = input.id ?? randomUUID();
      const inserted = (
        await db.query(
          'INSERT INTO "Trade" (id,a,b,state) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING *',
          [id, userId, input.target, JSON.stringify(state)],
        )
      ).rows[0];
      const row =
        inserted ??
        (
          await db.query(
            'SELECT * FROM "Trade" WHERE id=$1 AND a=$2 AND b=$3',
            [id, userId, input.target],
          )
        ).rows[0];
      if (!row) throw new Error('Invitation inaccessible');
      await db.query('COMMIT');
      return row;
    }
    const trade: Trade | undefined = (
      await db.query('SELECT * FROM "Trade" WHERE id=$1 FOR UPDATE', [input.id])
    ).rows[0];
    if (!trade || ![trade.a, trade.b].includes(userId))
      throw new Error('Échange inaccessible');
    const s = trade.state;
    if (new Date(trade.expiresAt).getTime() < Date.now())
      throw new Error('Échange expiré');
    if (['completed', 'cancelled'].includes(s.status))
      throw new Error('Échange terminé');
    if (input.revision !== s.revision)
      throw new Error('Offre modifiée, rechargez l’échange');
    if (action === 'cancel') {
      s.status = 'cancelled';
    } else if (action === 'accept') {
      if (userId !== trade.b || s.status !== 'invited')
        throw new Error('Invitation invalide');
      s.status = 'open';
    } else {
      if (s.status !== 'open') throw new Error('Invitation non acceptée');
      if (action === 'offer') {
        if (
          !input.copies ||
          input.copies.length > 50 ||
          new Set(input.copies).size !== input.copies.length
        )
          throw new Error('Sélection invalide (50 maximum)');
        const p: Player = (
          await db.query('SELECT state FROM "Player" WHERE id=$1 FOR UPDATE', [
            userId,
          ])
        ).rows[0].state;
        const copies = input.copies.map((id) =>
          p.copies.find((c) => c.id === id),
        );
        if (copies.some((c) => !c || c.locked))
          throw new Error('Carte absente ou verrouillée');
        s.offers[userId] = copies as Copy[];
        s.locked = [];
        s.confirmed = [];
      } else if (action === 'lock') {
        if (!s.offers[trade.a].length && !s.offers[trade.b].length)
          throw new Error('Proposez au moins une carte avant de valider.');
        if (!s.locked.includes(userId)) s.locked.push(userId);
      } else if (action === 'confirm') {
        if (s.locked.length !== 2)
          throw new Error('Les deux offres doivent être verrouillées');
        if (!s.confirmed.includes(userId)) s.confirmed.push(userId);
        if (s.confirmed.length === 2) {
          const rows = (
            await db.query(
              'SELECT id,state FROM "Player" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
              [[trade.a, trade.b]],
            )
          ).rows as { id: string; state: Player }[];
          for (const owner of rows) {
            if (owner.state.moderation?.suspended) throw new PlayerSuspended();
            for (const offered of s.offers[owner.id]) {
              const current = owner.state.copies.find(
                (c) => c.id === offered.id,
              );
              if (
                !current ||
                current.locked ||
                current.cardId !== offered.cardId ||
                current.level !== offered.level ||
                current.awakening !== offered.awakening ||
                current.holo !== offered.holo
              )
                throw new Error(
                  'Une carte proposée a changé ou n’est plus disponible',
                );
            }
          }
          for (const owner of rows) {
            const other = owner.id === trade.a ? trade.b : trade.a;
            owner.state.copies = owner.state.copies.filter(
              (c) => !s.offers[owner.id].some((o) => o.id === c.id),
            );
            owner.state.copies.push(
              ...s.offers[other].map((c) => ({
                ...c,
                locked: false,
                favorite: false,
              })),
            );
            owner.state.discoveries = [
              ...new Set([
                ...(owner.state.discoveries ?? []),
                ...s.offers[other].map((c) => c.cardId),
              ]),
            ];
            owner.state.holoDiscoveries = [
              ...new Set([
                ...(owner.state.holoDiscoveries ?? []),
                ...s.offers[other].filter((c) => c.holo).map((c) => c.cardId),
              ]),
            ];
            await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
              owner.id,
              JSON.stringify(owner.state),
            ]);
            await db.query(
              'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result) VALUES ($1,$2,$3,$4,0,$5)',
              [
                randomUUID(),
                owner.id,
                `trade:${trade.id}`,
                'trade',
                JSON.stringify({
                  tradeId: trade.id,
                  received: s.offers[other].map((c) => c.id),
                }),
              ],
            );
          }
          s.status = 'completed';
        }
      } else throw new Error('Action inconnue');
    }
    s.revision++;
    await db.query('UPDATE "Trade" SET state=$2 WHERE id=$1', [
      trade.id,
      JSON.stringify(s),
    ]);
    await db.query('COMMIT');
    return { ...trade, state: s };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
