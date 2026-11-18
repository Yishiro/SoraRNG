import { identity, pool } from '../../../src/server/game';
import { guildOverview } from '../../../src/server/community';
import { rateLimit } from '../../../src/server/limits';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(await guildOverview(pool, user.id), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
