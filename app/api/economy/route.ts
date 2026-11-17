import { z } from 'zod';
import { identity, pool } from '../../../src/server/game';
import { FinanceService } from '../../../src/server/finance';
import { FinanceError } from '../../../src/game/finance';
import { sameAuthOrigin } from '../../../src/server/auth-policy';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
import { rateLimit } from '../../../src/server/limits';
export const dynamic = 'force-dynamic';
const finance = new FinanceService(pool);
const input = z.object({
  key: z.uuid(),
  kind: z.enum(['bonus', 'deposit', 'withdraw']),
  payload: z.record(z.string(), z.unknown()),
});
export async function GET() {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'economy-read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(await finance.view(user.id), {
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
    const user = await identity(),
      action = input.parse(await request.json());
    if (!(await rateLimit(user.id, 'economy', 60)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    await finance.expireDue();
    return Response.json(
      await finance.action(user.id, action.key, action.kind, action.payload),
      { headers: privateAuthHeaders },
    );
  } catch (error) {
    if (error instanceof FinanceError)
      return Response.json(
        { error: error.message },
        { status: 400, headers: privateAuthHeaders },
      );
    return authApiError(error);
  }
}
