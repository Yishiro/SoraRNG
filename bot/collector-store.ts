import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool } from 'pg';
import { z } from 'zod';
import { cardSchema, type Card, type Player } from '../src/game/core';
import { FinanceError } from '../src/game/finance';
import { saleHistory } from '../src/server/auction-history';

export type CollectorProfile = { name: string; state: Player };
export type CollectorSale = {
  id: string;
  copy: { cardId: string; holo: boolean };
  startPrice: number;
  bid: number;
  status: string;
  endsAt: Date;
};
export type CollectorMovement = {
  kind: string;
  delta: number | null;
  before: number | null;
  after: number | null;
  createdAt: Date;
  bankMicros?: string;
  reserved?: number;
};
export class CollectorStore {
  private cache: { cards: Card[]; until: number } | null = null;
  constructor(private db: Pool) {}
  async prices(cardId: string) {
    return saleHistory(this.db, cardId, 'all');
  }
  async cards(): Promise<Card[]> {
    if (this.cache && this.cache.until > Date.now()) return this.cache.cards;
    const row = (
      await this.db.query('SELECT cards FROM "Catalogue" WHERE id=$1', [
        'standard',
      ])
    ).rows[0];
    const cards = z.array(cardSchema).length(150).parse(row?.cards);
    this.cache = { cards, until: Date.now() + 60000 };
    return cards;
  }
  async profile(id: string): Promise<CollectorProfile> {
    if (!/^\d{17,20}$/.test(id)) throw new FinanceError('Membre invalide.');
    const row = (
      await this.db.query('SELECT name,state FROM "Player" WHERE id=$1', [id])
    ).rows[0];
    if (!row)
      throw new FinanceError(
        'Aucun profil SoraRNG pour ce membre. Connectez-vous au site pour créer votre propre profil.',
      );
    if (row.state.moderation?.suspended)
      throw new FinanceError('Ce profil est indisponible.');
    return row;
  }
  async wishlist(id: string, key: string, cardId: string, wanted: boolean) {
    if (!/^\d{17,20}$/.test(id) || !/^discord:\d{17,20}$/.test(key))
      throw new FinanceError('Requête invalide.');
    if (!(await this.cards()).some((c) => c.id === cardId))
      throw new FinanceError('Carte introuvable.');
    const db = await this.db.connect();
    try {
      await db.query('BEGIN');
      const row = (
        await db.query('SELECT state FROM "Player" WHERE id=$1 FOR UPDATE', [
          id,
        ])
      ).rows[0];
      if (!row || row.state.moderation?.suspended)
        throw new FinanceError(
          'Profil absent ou indisponible. Connectez-vous au site avec ce compte.',
        );
      const request = { cardId, wanted };
      const old = (
        await db.query(
          'SELECT kind,request FROM "Operation" WHERE "playerId"=$1 AND key=$2',
          [id, key],
        )
      ).rows[0];
      if (old) {
        if (old.kind !== 'wishlist' || !isDeepStrictEqual(old.request, request))
          throw new FinanceError('Identifiant de requête déjà utilisé.');
        await db.query('COMMIT');
        return;
      }
      const state: Player = row.state;
      const wishlist = new Set(state.wishlist ?? []);
      if (wanted) wishlist.add(cardId);
      else wishlist.delete(cardId);
      state.wishlist = [...wishlist];
      await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
        id,
        JSON.stringify(state),
      ]);
      await db.query(
        'INSERT INTO "Operation" (id,"playerId",key,kind,delta,result,request) VALUES ($1,$2,$3,$4,0,$5,$6)',
        [
          randomUUID(),
          id,
          key,
          'wishlist',
          JSON.stringify({ success: true }),
          JSON.stringify(request),
        ],
      );
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
  async market(
    cardId: string | null,
    playerId: string | null,
    page: number,
  ): Promise<CollectorSale[]> {
    return (
      await this.db.query(
        `SELECT id,copy,"startPrice",bid,status,"endsAt" FROM "CardAuction" WHERE ($1::text IS NULL OR copy->>'cardId'=$1) AND ($2::text IS NULL OR "sellerId"=$2) AND ($2::text IS NOT NULL OR (status='open' AND "endsAt">now())) ORDER BY (status='open' AND "endsAt">now()) DESC,"createdAt" DESC,id LIMIT 11 OFFSET $3`,
        [cardId, playerId, (page - 1) * 10],
      )
    ).rows;
  }
  async history(id: string): Promise<CollectorMovement[]> {
    await this.profile(id);
    const entries = (
      await this.db.query(
        `SELECT kind,(after->>'wallet')::float8-(before->>'wallet')::float8 AS delta,(before->>'wallet')::float8 AS before,(after->>'wallet')::float8 AS after,"createdAt",after->>'bankMicros' AS "bankMicros",(after->>'reserved')::float8 AS reserved FROM "WalletLedger" WHERE "playerId"=$1 AND before IS NOT NULL AND kind<>'baseline' ORDER BY id DESC LIMIT 10`,
        [id],
      )
    ).rows;
    if (entries.length === 10) return entries;
    const legacy = (
      await this.db.query(
        `WITH logs AS (
    SELECT id,kind,delta::float8,result,"createdAt" FROM "Operation" WHERE "playerId"=$1 AND delta<>0
    UNION ALL SELECT id,kind,delta::float8,result,"createdAt" FROM "EconomyOperation" WHERE "playerId"=$1 AND delta<>0
  ) SELECT kind,delta,COALESCE((result#>>'{resources,before,munny}')::float8,(result->>'wallet')::float8-delta) AS before,COALESCE((result#>>'{resources,after,munny}')::float8,(result->>'wallet')::float8) AS after,"createdAt" FROM logs WHERE "createdAt"<(SELECT min("createdAt") FROM "WalletLedger" WHERE "playerId"=$1 AND kind IN ('baseline','account.create')) ORDER BY "createdAt" DESC,id DESC LIMIT $2`,
        [id, 10 - entries.length],
      )
    ).rows;
    return [...entries, ...legacy];
  }
}
