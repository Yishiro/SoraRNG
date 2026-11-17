import { identity, pool } from '../../../src/server/game';
import { rateLimit } from '../../../src/server/limits';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
export async function GET() {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'listed-read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(
      (
        await pool.query(
          'SELECT * FROM "CardAuction" WHERE "sellerId"=$1 AND status=\'open\' ORDER BY "endsAt"',
          [user.id],
        )
      ).rows,
      { headers: privateAuthHeaders },
    );
  } catch (error) {
    return authApiError(error);
  }
}
