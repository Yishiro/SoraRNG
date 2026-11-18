import { pool } from '../../../src/server/game';
import { activeAnnouncements } from '../../../src/server/community';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(
      { announcements: await activeAnnouncements(pool) },
      { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15' } },
    );
  } catch {
    return Response.json(
      { error: 'Tableau d’annonces indisponible.' },
      { status: 503 },
    );
  }
}
