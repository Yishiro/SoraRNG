import type { Pool } from 'pg';
import type { Client, MessageCreateOptions } from 'discord.js';
import type { AuctionNotice } from '../src/server/auction-notifications';
export type PendingNotice = {
  id: string;
  playerId: string;
  auctionId: string;
  kind: 'outbid' | 'won' | 'sold' | 'unsold';
  payload: AuctionNotice;
  attempts: number;
  name?: string;
  version?: string;
};
export function noticeMessage(
  notice: PendingNotice,
  site: string,
): MessageCreateOptions {
  const amount = notice.payload.amount.toLocaleString('fr-FR'),
    label = `${notice.name ?? notice.payload.copy.cardId}${notice.version ? ` · ${notice.version}` : ''}${notice.payload.copy.holo ? ' · Holographique' : ''}`;
  const text = {
    outbid: [
      'Une offre vous a dépassé',
      `Votre mise de **${amount} Munny** a été remboursée. Vous pouvez enchérir à nouveau depuis le marché.`,
    ],
    won: [
      'Vous avez remporté une carte !',
      `Votre achat de **${amount} Munny** est terminé. La carte a rejoint votre collection.`,
    ],
    sold: [
      'Votre carte a été vendue !',
      `**${amount} Munny** ont été ajoutés à votre portefeuille. La carte a été remise à son nouveau collectionneur.`,
    ],
    unsold: [
      'Votre enchère est terminée',
      'Aucune offre reçue : votre carte est de retour dans votre collection.',
    ],
  }[notice.kind];
  return {
    embeds: [
      {
        title: text[0],
        url: `${new URL('/trade', site).href}#notice-${notice.id}`,
        description: `**${label}**\n\n${text[1]}\n\n[Voir l’enchère](${new URL(`/trade?auction=${encodeURIComponent(notice.auctionId)}`, site).href}) · [Gérer mes notifications](${new URL('/settings', site).href})`,
        color: 0xb9ab8a,
        footer: { text: 'Marché · SoraRNG' },
      },
    ],
    allowedMentions: { parse: [] },
    nonce: notice.id,
    enforceNonce: true,
  };
}
export function discordNoticeDelivery(client: Client, site: string) {
  return async (notice: PendingNotice) => {
    const user = await client.users.fetch(notice.playerId),
      channel = await user.createDM();
    // Reconcile a previous ambiguous send, including after a process restart.
    if (notice.attempts > 0) {
      const recent = await channel.messages.fetch({ limit: 100 });
      const existing = recent.find(
        (m) =>
          m.author.id === client.user?.id &&
          m.embeds.some(
            (e) =>
              e.url === `${new URL('/trade', site).href}#notice-${notice.id}`,
          ),
      );
      if (existing) return existing.id;
    }
    return (await channel.send(noticeMessage(notice, site))).id;
  };
}
export class AuctionNotifier {
  constructor(
    private pool: Pool,
    private deliver: (notice: PendingNotice) => Promise<string>,
    private now = Date.now,
  ) {}
  async tick() {
    const db = await this.pool.connect();
    let locked = false;
    try {
      locked = (
        await db.query(
          "SELECT pg_try_advisory_lock(hashtext('sorarng-auction-notices-v1')) AS locked",
        )
      ).rows[0].locked;
      if (!locked) return;
      const rows = (
        await db.query(
          `SELECT n.*,p.state->>'auctionNotifications' AS preference,c.card->>'name' AS name,c.card->>'version' AS version FROM "AuctionNotification" n JOIN "Player" p ON p.id=n."playerId" LEFT JOIN LATERAL (SELECT card FROM "Catalogue",jsonb_array_elements(cards) card WHERE "Catalogue".id='standard' AND card->>'id'=n.payload#>>'{copy,cardId}' LIMIT 1) c ON true WHERE n.status='pending' AND n."nextAt" <= $1 ORDER BY n."createdAt",n.id LIMIT 10`,
          [new Date(this.now())],
        )
      ).rows;
      for (const row of rows) {
        if (row.preference === 'false') {
          await db.query(
            'UPDATE "AuctionNotification" SET status=\'ignored\' WHERE id=$1',
            [row.id],
          );
          continue;
        }
        await db.query(
          'UPDATE "AuctionNotification" SET attempts=attempts+1,"nextAt"=$2 WHERE id=$1',
          [row.id, new Date(this.now() + 120000)],
        );
        try {
          const messageId = await this.deliver(row);
          await db.query(
            'UPDATE "AuctionNotification" SET status=\'sent\',"messageId"=$2,"deliveredAt"=$3 WHERE id=$1',
            [row.id, messageId, new Date(this.now())],
          );
        } catch (error) {
          const code =
            typeof error === 'object' && error && 'code' in error
              ? Number(error.code)
              : 0;
          const status = [50007, 50013, 10013].includes(code)
            ? 'blocked'
            : row.attempts >= 7
              ? 'failed'
              : 'pending';
          await db.query(
            'UPDATE "AuctionNotification" SET status=$2,"nextAt"=$3 WHERE id=$1',
            [
              row.id,
              status,
              new Date(
                this.now() + Math.min(1800000, 30000 * 2 ** row.attempts),
              ),
            ],
          );
        }
      }
    } finally {
      try {
        if (locked)
          await db.query(
            "SELECT pg_advisory_unlock(hashtext('sorarng-auction-notices-v1'))",
          );
      } finally {
        db.release();
      }
    }
  }
}
