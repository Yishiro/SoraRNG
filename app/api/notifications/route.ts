import { z } from 'zod';
import { identity, pool } from '../../../src/server/game';
import { inbox, readInbox } from '../../../src/server/inbox';
import { sameAuthOrigin } from '../../../src/server/auth-policy';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
import { rateLimit } from '../../../src/server/limits';
export async function GET() {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'inbox-read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(await inbox(pool, user.id), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
export async function POST(request: Request) {
  if (!sameAuthOrigin(request))
    return Response.json({ error: 'Origine interdite' }, { status: 403 });
  try {
    const user = await identity();
    const input = z
      .union([
        z.object({ all: z.literal(true) }).strict(),
        z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }).strict(),
      ])
      .parse(await request.json());
    if (!(await rateLimit(user.id, 'inbox-write', 60)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    await readInbox(pool, user.id, 'id' in input ? input.id : undefined);
    return Response.json(await inbox(pool, user.id), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
