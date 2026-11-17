import { pool, catalog } from '../../../src/server/game';
import { recentDrops } from '../../../src/server/recent-drops';
import { lastSettlement } from '../../../src/server/seasons';
import { seasonLabel } from '../../../src/game/seasons';

export const dynamic = 'force-dynamic';

export type ActivityItem = {
  id: string;
  at: string;
  kind: 'drop' | 'sale' | 'season';
  text: string;
  cardId?: string;
};

export async function GET() {
  try {
    const cards = await catalog();
    const name = (id: string) => cards.find((c) => c.id === id)?.name ?? id;
    const [drops, sales, season] = await Promise.all([
      recentDrops(pool, cards),
      pool.query(
        `SELECT a.id,a.copy,a.bid,a."endsAt",s.name AS seller,b.name AS buyer
           FROM "CardAuction" a
           JOIN "Player" s ON s.id=a."sellerId"
           JOIN "Player" b ON b.id=a."bidderId"
          WHERE a.status='sold'
          ORDER BY a."endsAt" DESC LIMIT 15`,
      ),
      lastSettlement(pool),
    ]);
    const items: ActivityItem[] = [
      ...drops.map((d) => ({
        id: `drop:${d.id}`,
        at: d.openedAt,
        kind: 'drop' as const,
        cardId: d.card.id,
        text: `${d.playerName} a obtenu ${d.card.name} (${d.card.rarity}${d.holo ? ', holographique' : ''}).`,
      })),
      ...sales.rows.map((s) => ({
        id: `sale:${s.id}`,
        at: new Date(s.endsAt).toISOString(),
        kind: 'sale' as const,
        cardId: s.copy.cardId,
        text: `${s.buyer} a acheté ${name(s.copy.cardId)} à ${s.seller} pour ${Number(s.bid).toLocaleString('fr-FR')} Munny.`,
      })),
      ...(season
        ? [
            {
              id: `season:${season.id}`,
              at: new Date(season.createdAt).toISOString(),
              kind: 'season' as const,
              text: `Saison ${seasonLabel(season.id)} : ${season.standings
                .slice(0, 3)
                .map((w) => `${w.rank}. ${w.name}`)
                .join(', ')}.`,
            },
          ]
        : []),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30);
    return Response.json(
      { items },
      { headers: { 'Cache-Control': 'public, max-age=20, s-maxage=20' } },
    );
  } catch {
    return Response.json(
      { error: 'Fil d’activité indisponible' },
      { status: 503 },
    );
  }
}
