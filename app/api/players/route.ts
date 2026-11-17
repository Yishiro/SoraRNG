import { identity } from '../../../src/server/game';
import { pool } from '../../../src/server/postgres';
import { rateLimit } from '../../../src/server/limits';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
export async function GET(request: Request) {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'directory', 30)))
      return Response.json({ error: 'Trop de recherches' }, { status: 429 });
    const q = (new URL(request.url).searchParams.get('q') ?? '')
      .trim()
      .slice(0, 80);
    if (q.length < 2) return Response.json([], { headers: privateAuthHeaders });
    return Response.json(
      (
        await pool.query(
          "SELECT id,name FROM \"Player\" WHERE id<>$1 AND (id ILIKE $2 OR name ILIKE $2) AND COALESCE(state#>>'{moderation,suspended}','false')<>'true' ORDER BY name,id LIMIT 20",
          [user.id, `%${q}%`],
        )
      ).rows,
      { headers: privateAuthHeaders },
    );
  } catch (error) {
    return authApiError(error);
  }
}
