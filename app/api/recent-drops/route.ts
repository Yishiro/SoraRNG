import { pool } from '../../../src/server/postgres';
import { catalog } from '../../../src/server/game';
import { recentDrops } from '../../../src/server/recent-drops';

export async function GET() {
  try {
    return Response.json(
      { drops: await recentDrops(pool, await catalog()) },
      {
        headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15' },
      },
    );
  } catch {
    return Response.json(
      { error: 'Dernières découvertes indisponibles.' },
      { status: 503 },
    );
  }
}
