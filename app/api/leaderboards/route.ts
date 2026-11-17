import { pool, catalog } from '../../../src/server/game';
import {
  lastSettlement,
  seasonStandings,
  settleSeasons,
} from '../../../src/server/seasons';
import {
  seasonBounds,
  seasonId,
  seasonLabel,
  seasonRewards,
} from '../../../src/game/seasons';

export const dynamic = 'force-dynamic';

const visible = `COALESCE(state#>>'{moderation,suspended}','false')<>'true'`;
let cached: { at: number; body: unknown } | undefined;

export async function GET() {
  try {
    if (cached && Date.now() - cached.at < 30000)
      return Response.json(cached.body);
    const cards = await catalog();
    const now = new Date();
    await settleSeasons(pool, cards, now);
    const season = seasonId(now);
    const [standings, previous, collection] = await Promise.all([
      seasonStandings(pool, season, cards),
      lastSettlement(pool),
      pool.query(
        `SELECT id,name,
           jsonb_array_length(state->'copies') AS collection,
           (SELECT count(*) FROM jsonb_array_elements(state->'copies') c WHERE c->>'holo'='true')::int AS holos,
           jsonb_array_length(COALESCE(state->'discoveries','[]'::jsonb)) AS codex,
           (state->>'summons')::int AS summons
         FROM "Player" WHERE ${visible}`,
      ),
    ]);
    const rows = collection.rows as {
      id: string;
      name: string;
      collection: number;
      holos: number;
      codex: number;
      summons: number;
    }[];
    const top = (key: 'collection' | 'holos' | 'codex') =>
      [...rows]
        .filter((r) => r[key] > 0)
        .sort(
          (a, b) =>
            b[key] - a[key] ||
            b.summons - a.summons ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 50)
        .map((r) => ({ id: r.id, name: r.name, value: r[key] }));
    const body = {
      season: {
        id: season,
        label: seasonLabel(season),
        endsAt: seasonBounds(season).end.toISOString(),
        rewards: seasonRewards,
        standings: standings.slice(0, 50),
      },
      previous: previous
        ? {
            id: previous.id,
            label: seasonLabel(previous.id),
            winners: previous.standings.slice(0, 3),
          }
        : null,
      collection: top('collection'),
      holos: top('holos'),
      codex: top('codex'),
    };
    cached = { at: Date.now(), body };
    return Response.json(body);
  } catch {
    return Response.json({ error: 'Classement indisponible' }, { status: 503 });
  }
}
