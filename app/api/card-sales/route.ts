import { z } from 'zod';
import { pool } from '../../../src/server/postgres';
import { saleHistory } from '../../../src/server/auction-history';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = z
    .object({
      cardId: z.string().regex(/^KH-\d{3}$/),
      finish: z.enum(['all', 'holo', 'standard']),
    })
    .safeParse({
      cardId: url.searchParams.get('cardId'),
      finish: url.searchParams.get('finish') ?? 'all',
    });
  if (!query.success)
    return Response.json(
      { error: 'Carte ou finition invalide.' },
      { status: 400 },
    );
  try {
    return Response.json(
      await saleHistory(pool, query.data.cardId, query.data.finish),
      { headers: { 'Cache-Control': 'public, max-age=30' } },
    );
  } catch {
    return Response.json(
      { error: 'Historique temporairement indisponible.' },
      { status: 503 },
    );
  }
}
