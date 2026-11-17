import { z } from 'zod';
import { identity, pool } from '../../../src/server/game';
import { AuctionService } from '../../../src/server/auctions';
import { sameAuthOrigin } from '../../../src/server/auth-policy';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';
import { rateLimit } from '../../../src/server/limits';
import { marketQuery } from '../../../src/game/market-query';
const service = new AuctionService(pool);
export async function GET(request: Request) {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'auction-read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    const params = new URL(request.url).searchParams;
    const result = params.has('page')
      ? await service.page(
          user.id,
          marketQuery.parse(Object.fromEntries(params)),
        )
      : await service.list(user.id);
    return Response.json(result, {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
const schema = z
  .object({
    action: z.enum(['create', 'bid', 'cancel', 'sync']),
    key: z.string().uuid(),
    id: z.string().uuid().optional(),
    copyId: z.string().min(1).max(100).optional(),
    amount: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();
export async function POST(request: Request) {
  if (!sameAuthOrigin(request))
    return Response.json({ error: 'Origine interdite' }, { status: 403 });
  try {
    const user = await identity(),
      input = schema.parse(await request.json());
    if (!(await rateLimit(user.id, 'auction-write', 30)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    return Response.json(await service.action(user.id, input), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}
