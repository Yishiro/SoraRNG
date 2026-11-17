import { pool } from '../../../src/server/game';
export async function GET() {
  try {
    return Response.json(
      (
        await pool.query(
          `SELECT id,name, jsonb_array_length(state->'copies') AS collection, (state->>'summons')::int AS summons FROM "Player" ORDER BY collection DESC, summons DESC, id LIMIT 50`,
        )
      ).rows,
    );
  } catch {
    return Response.json({ error: 'Classement indisponible' }, { status: 503 });
  }
}
