import { z } from 'zod';
import {
  ensurePlayer,
  identity,
  mutate,
  snapshot,
  pool,
  catalog,
} from '../../../src/server/game';
import { settleSeasons } from '../../../src/server/seasons';
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
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await identity();
    await ensurePlayer(user.id, user.name);
    if (!(await rateLimit(user.id, 'read', 120)))
      return Response.json(
        { error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429 },
      );
    try {
      await settleSeasons(pool, await catalog());
    } catch {
      /* Le règlement de saison sera retenté à la prochaine lecture. */
    }
    return Response.json(await snapshot(user.id), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    if (error instanceof ForbiddenAccess) return authApiError(error);
    return Response.json(
      {
        error:
          error instanceof AuthenticationRequired
            ? 'Connexion Discord requise'
            : 'Service temporairement indisponible',
      },
      { status: error instanceof AuthenticationRequired ? 401 : 503 },
    );
  }
}
const actionSchema = z.object({
  key: z.uuid(),
  kind: z.enum([
    'daily',
    'summon',
    'shop',
    'mission',
    'settings',
    'lock',
    'favorite',
    'wishlist',
    'showcase',
    'recycle',
    'recycle-many',
    'upgrade',
    'awaken',
    'quest',
    'fuse',
    'allocate',
    'streak',
    'codex-reward',
    'announce',
    'announce-remove',
    'guild-create',
    'guild-join',
    'guild-leave',
    'guild-kick',
    'guild-reward',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export async function POST(request: Request) {
  if (!sameAuthOrigin(request))
    return Response.json({ error: 'Origine interdite' }, { status: 403 });
  try {
    const user = await identity();
    const action = actionSchema.parse(await request.json());
    if (!(await rateLimit(user.id, 'mutate', 60)))
      return Response.json(
        { error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429 },
      );
    return Response.json(
      await mutate(user.id, action.key, action.kind, action.payload),
      { headers: privateAuthHeaders },
    );
  } catch (error) {
    return authApiError(error);
  }
}
