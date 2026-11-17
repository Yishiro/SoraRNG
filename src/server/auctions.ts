import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import type { Copy, Player } from '../game/core';
import { assertWallet, credit, financeState } from '../game/finance';
import { queueAuctionNotice } from './auction-notifications';
import { marketPageSize, type MarketQuery } from '../game/market-query';
import { walletAuditContext } from './wallet-audit';

export type Auction = {
  id: string;
  sellerId: string;
  sellerName: string;
  copy: Copy;
  startPrice: number;
  bid: number;
  bidderId: string | null;
  bidderName: string | null;
  hasBid?: boolean;
  status: 'open' | 'sold' | 'unsold' | 'cancelled';
  endsAt: string;
};
export type AuctionInput = {
  action: 'create' | 'bid' | 'cancel' | 'sync';
  key: string;
  id?: string;
  copyId?: string;
  amount?: number;
};

// All economy operations take this lock before player row locks. Physical escrow
// removes listed copies from the inventory, so upgrade/recycle/trade cannot spend them.
export class AuctionService {
  constructor(
    private pool: Pool,
    private now = Date.now,
  ) {}

  private async players(db: PoolClient, ids: string[]) {
    const rows = (
      await db.query(
        'SELECT id,state FROM "Player" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
        [[...new Set(ids)].sort()],
      )
    ).rows;
    const players = new Map<string, Player>(rows.map((r) => [r.id, r.state]));
    if (players.size !== new Set(ids).size)
      throw new Error('Profil introuvable.');
    return players;
  }

  private async save(db: PoolClient, players: Map<string, Player>) {
    for (const [id, state] of players) {
      assertWallet(state);
      await db.query('UPDATE "Player" SET state=$2 WHERE id=$1', [
        id,
        JSON.stringify(state),
      ]);
    }
  }

  private receive(player: Player, copy: Copy) {
    if (player.copies.some((c) => c.id === copy.id))
      throw new Error('Exemplaire déjà présent.');
    player.copies.push({ ...copy, locked: false, favorite: false });
    player.discoveries = [
      ...new Set([...(player.discoveries ?? []), copy.cardId]),
    ];
    if (copy.holo)
      player.holoDiscoveries = [
        ...new Set([...(player.holoDiscoveries ?? []), copy.cardId]),
      ];
  }

  async settle() {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext('sorarng-finance-v1'))",
      );
      const ended: Auction[] = (
        await db.query(
          'SELECT * FROM "CardAuction" WHERE status=\'open\' AND "endsAt" <= $1 ORDER BY "endsAt",id FOR UPDATE',
          [new Date(this.now())],
        )
      ).rows;
      const players = await this.players(
        db,
        ended.flatMap((auction) => [
          auction.sellerId,
          ...(auction.bidderId ? [auction.bidderId] : []),
        ]),
      );
      for (const auction of ended) {
        const seller = players.get(auction.sellerId)!;
        if (auction.bidderId) {
          const buyer = players.get(auction.bidderId)!;
          financeState(buyer, this.now()).reserved -= auction.bid;
          financeState(seller, this.now()).liability -= auction.bid;
          credit(seller, auction.bid);
          this.receive(buyer, auction.copy);
          await queueAuctionNotice(
            db,
            `${auction.id}:won`,
            auction.bidderId,
            'won',
            auction.id,
            auction.copy,
            auction.bid,
          );
          await queueAuctionNotice(
            db,
            `${auction.id}:sold`,
            auction.sellerId,
            'sold',
            auction.id,
            auction.copy,
            auction.bid,
          );
        } else {
          if (seller.copies.some((c) => c.id === auction.copy.id))
            throw new Error('Exemplaire déjà présent.');
          seller.copies.push(auction.copy);
          await queueAuctionNotice(
            db,
            `${auction.id}:unsold`,
            auction.sellerId,
            'unsold',
            auction.id,
            auction.copy,
            0,
          );
        }
        await db.query('UPDATE "CardAuction" SET status=$2 WHERE id=$1', [
          auction.id,
          auction.bidderId ? 'sold' : 'unsold',
        ]);
        await walletAuditContext(db, {
          source: 'market',
          kind: 'auction.settle',
          reference: auction.id,
        });
        await this.save(
          db,
          new Map([
            [auction.sellerId, seller],
            ...(auction.bidderId
              ? [
                  [auction.bidderId, players.get(auction.bidderId)!] as [
                    string,
                    Player,
                  ],
                ]
              : []),
          ]),
        );
      }
      await db.query('COMMIT');
      return ended.length;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }

  async list(actor: string) {
    return (
      await this.pool.query(
        `SELECT a.*,s.name AS "sellerName",b.name AS "bidderName",EXISTS(SELECT 1 FROM "AuctionRequest" r WHERE r."playerId"=$1 AND r.request->>'action'='bid' AND r.request->>'id'=a.id) AS "hasBid" FROM "CardAuction" a JOIN "Player" s ON s.id=a."sellerId" LEFT JOIN "Player" b ON b.id=a."bidderId" WHERE a.status='open' OR a."sellerId"=$1 OR a."bidderId"=$1 OR EXISTS(SELECT 1 FROM "AuctionRequest" r WHERE r."playerId"=$1 AND r.request->>'action'='bid' AND r.request->>'id'=a.id) ORDER BY (a.status='open') DESC,a."endsAt" DESC LIMIT 200`,
        [actor],
      )
    ).rows as Auction[];
  }

  async page(actor: string, query: MarketQuery) {
    const bid = `EXISTS(SELECT 1 FROM "AuctionRequest" r WHERE r."playerId"=$1 AND r.request->>'action'='bid' AND r.request->>'id'=a.id)`;
    const select = `SELECT a.*,s.name AS "sellerName",b.name AS "bidderName",${bid} AS "hasBid"
      FROM "CardAuction" a JOIN "Player" s ON s.id=a."sellerId"
      LEFT JOIN "Player" b ON b.id=a."bidderId"`;
    const orders = {
      ending: 'a."endsAt" ASC',
      newest: 'a."endsAt" DESC',
      'price-low': 'COALESCE(NULLIF(a.bid,0),a."startPrice") ASC',
      'price-high': 'COALESCE(NULLIF(a.bid,0),a."startPrice") DESC',
    };
    const fold = (value: string) =>
      `translate(lower(${value}), 'àáâäãåéèêëíìîïóòôöõúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')`;
    const [page, detail] = await Promise.all([
      this.pool.query<Auction>(
        `${select}
        LEFT JOIN (SELECT jsonb_array_elements(cards) AS card FROM "Catalogue" WHERE id='standard') model
          ON model.card->>'id'=a.copy->>'cardId'
        WHERE CASE $2::text
          WHEN 'sales' THEN a."sellerId"=$1
          WHEN 'offers' THEN a."bidderId"=$1 OR ${bid}
          ELSE a.status='open' AND a."endsAt">now() END
        AND ($3='' OR strpos(${fold("concat_ws(' ',model.card->>'name',model.card->>'version',a.copy->>'cardId',s.name)")},${fold('$3::text')})>0)
        AND ($4='Toutes' OR model.card->>'rarity'=$4)
        AND ($5='all' OR (a.copy->>'holo')::boolean=($5='holo'))
        AND ($6='' OR a.copy->>'cardId'=$6)
        ORDER BY ${orders[query.sort]},a.id LIMIT $7 OFFSET $8`,
        [
          actor,
          query.view,
          query.search,
          query.rarity,
          query.finish,
          query.card,
          marketPageSize + 1,
          (query.page - 1) * marketPageSize,
        ],
      ),
      query.auction
        ? this.pool.query<Auction>(
            `${select} WHERE a.id=$2 AND (a.status='open' OR a."sellerId"=$1 OR a."bidderId"=$1 OR ${bid})`,
            [actor, query.auction],
          )
        : Promise.resolve(null),
    ]);
    return {
      auctions: page.rows.slice(0, marketPageSize),
      hasNext: page.rows.length > marketPageSize,
      detail: detail?.rows[0] ?? null,
    };
  }

  async action(actor: string, input: AuctionInput) {
    if (!input.key || input.key.length > 100)
      throw new Error('Identifiant de requête invalide.');
    if (!['create', 'bid', 'cancel', 'sync'].includes(input.action))
      throw new Error('Action invalide.');
    await this.settle();
    if (input.action === 'sync') return { ok: true };
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext('sorarng-finance-v1'))",
      );
      const old = (
        await db.query(
          'SELECT request,result FROM "AuctionRequest" WHERE "playerId"=$1 AND key=$2',
          [actor, input.key],
        )
      ).rows[0];
      if (old) {
        if (!isDeepStrictEqual(old.request, input))
          throw new Error('Identifiant déjà utilisé.');
        await db.query('COMMIT');
        return old.result;
      }
      let result: { id: string };
      await walletAuditContext(db, {
        source: 'market',
        kind: `auction.${input.action}`,
        actor,
        reference: input.id ?? input.key,
      });
      if (input.action === 'create') {
        this.price(input.amount);
        const players = await this.players(db, [actor]),
          seller = players.get(actor)!;
        this.active(seller);
        const copy = seller.copies.find((c) => c.id === input.copyId);
        if (!copy || copy.locked)
          throw new Error('Carte absente ou verrouillée.');
        if (
          (
            await db.query(
              'SELECT count(*)::int AS n FROM "CardAuction" WHERE "sellerId"=$1 AND status=\'open\'',
              [actor],
            )
          ).rows[0].n >= 50
        )
          throw new Error('50 ventes simultanées maximum.');
        seller.copies = seller.copies.filter((c) => c.id !== copy.id);
        result = { id: randomUUID() };
        await db.query(
          'INSERT INTO "CardAuction" (id,"sellerId",copy,"startPrice","endsAt") VALUES ($1,$2,$3,$4,$5)',
          [
            result.id,
            actor,
            JSON.stringify(copy),
            input.amount,
            new Date(this.now() + 86400000),
          ],
        );
        await this.save(db, players);
      } else {
        const auction: Auction | undefined = (
          await db.query('SELECT * FROM "CardAuction" WHERE id=$1 FOR UPDATE', [
            input.id,
          ])
        ).rows[0];
        if (
          !auction ||
          auction.status !== 'open' ||
          new Date(auction.endsAt).getTime() <= this.now()
        )
          throw new Error('Enchère terminée ou introuvable.');
        const players = await this.players(db, [
          actor,
          auction.sellerId,
          ...(auction.bidderId ? [auction.bidderId] : []),
        ]);
        const player = players.get(actor)!,
          seller = players.get(auction.sellerId)!;
        this.active(player);
        if (input.action === 'cancel') {
          if (actor !== auction.sellerId || auction.bidderId)
            throw new Error(
              'Annulation possible uniquement par le vendeur avant toute mise.',
            );
          // Return the exact copy, including its original preferences.
          seller.copies.push(auction.copy);
          await db.query(
            'UPDATE "CardAuction" SET status=\'cancelled\' WHERE id=$1',
            [auction.id],
          );
        } else {
          this.price(input.amount);
          this.active(seller);
          if (actor === auction.sellerId)
            throw new Error('Impossible de miser sur votre carte.');
          if (
            input.amount! <
            (auction.bidderId ? auction.bid + 1 : auction.startPrice)
          )
            throw new Error('La mise doit dépasser la meilleure offre.');
          const previous = auction.bidderId
            ? players.get(auction.bidderId)!
            : null;
          // Refund first, including a bidder raising their own bid. All stays atomic.
          if (previous) {
            financeState(previous, this.now()).reserved -= auction.bid;
            credit(previous, auction.bid);
            financeState(seller, this.now()).liability -= auction.bid;
          }
          if (player.munny < input.amount!)
            throw new Error('Munny disponibles insuffisants.');
          if (auction.bidderId && auction.bidderId !== actor)
            await queueAuctionNotice(
              db,
              `${auction.id}:outbid:${actor}:${input.key}`,
              auction.bidderId,
              'outbid',
              auction.id,
              auction.copy,
              auction.bid,
            );
          player.munny -= input.amount!;
          financeState(player, this.now()).reserved += input.amount!;
          financeState(seller, this.now()).liability += input.amount!;
          await db.query(
            'UPDATE "CardAuction" SET bid=$2,"bidderId"=$3 WHERE id=$1',
            [auction.id, input.amount, actor],
          );
        }
        await this.save(db, players);
        result = { id: auction.id };
      }
      await db.query(
        'INSERT INTO "AuctionRequest" ("playerId",key,request,result) VALUES ($1,$2,$3,$4)',
        [actor, input.key, JSON.stringify(input), JSON.stringify(result)],
      );
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  private active(player: Player) {
    if (player.moderation?.suspended) throw new Error('Compte suspendu.');
  }
  private price(value: unknown): asserts value is number {
    if (!Number.isSafeInteger(value) || (value as number) < 1)
      throw new Error('Indiquez un prix entier positif.');
  }
}
