import { z } from 'zod';
import { identity, pool } from '../../../src/server/game';
import { tradeAction } from '../../../src/server/trades';
import { rateLimit } from '../../../src/server/limits';
import { ForbiddenAccess } from '../../../src/server/permissions';
import {
  AuthenticationRequired,
  sameAuthOrigin,
} from '../../../src/server/auth-policy';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
export async function GET() {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'trade-read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(
      (
        await pool.query(
          `SELECT t.*,sender.name AS "aName",recipient.name AS "bName" FROM "Trade" t
           JOIN "Player" sender ON sender.id=t.a JOIN "Player" recipient ON recipient.id=t.b
           WHERE t.a=$1 OR t.b=$1
           ORDER BY (t."expiresAt">now() AND t.state->>'status' IN ('invited','open')) DESC,t."createdAt" DESC LIMIT 50`,
          [user.id],
        )
      ).rows,
      { headers: privateAuthHeaders },
    );
  } catch (error) {
    if (error instanceof ForbiddenAccess) return authApiError(error);
    return Response.json(
      {
        error:
          error instanceof AuthenticationRequired
            ? 'Connexion requise'
            : 'Service temporairement indisponible',
      },
      { status: error instanceof AuthenticationRequired ? 401 : 503 },
    );
  }
}
const schema = z.object({
  action: z.enum(['invite', 'accept', 'offer', 'lock', 'confirm', 'cancel']),
  id: z.uuid().optional(),
  target: z.string().min(1).max(30).optional(),
  copies: z.array(z.string()).max(50).optional(),
  revision: z.number().int().nonnegative().optional(),
});
export async function POST(request: Request) {
  if (!sameAuthOrigin(request))
    return Response.json({ error: 'Origine interdite' }, { status: 403 });
  try {
    const user = await identity();
    const input = schema.parse(await request.json());
    if (!(await rateLimit(user.id, 'trade-write', 30)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(await tradeAction(user.id, input.action, input), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
