import { identity } from '../../../src/server/game';
import { adminAction, adminOverview } from '../../../src/server/admin';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
import { sameAuthOrigin } from '../../../src/server/auth-policy';
import { requireStaff } from '../../../src/server/permissions';
import { rateLimit } from '../../../src/server/limits';
export async function GET(request: Request) {
  try {
    const user = await identity();
    requireStaff(user.id);
    if (!(await rateLimit(user.id, 'admin-read', 60)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    const url = new URL(request.url);
    return Response.json(
      await adminOverview(
        user.id,
        (url.searchParams.get('q') ?? '').slice(0, 80),
        (url.searchParams.get('cursor') ?? '').slice(0, 30),
      ),
      { headers: privateAuthHeaders },
    );
  } catch (error) {
    return authApiError(error);
  }
}
export async function POST(request: Request) {
  if (!sameAuthOrigin(request))
    return Response.json({ error: 'Origine interdite' }, { status: 403 });
  try {
    const user = await identity();
    requireStaff(user.id);
    if (!(await rateLimit(user.id, 'admin-write', 30)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(await adminAction(user.id, await request.json()), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
