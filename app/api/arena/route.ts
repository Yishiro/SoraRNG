import { z } from 'zod';
import { identity } from '../../../src/server/game';
import {
  ArenaConflict,
  arenaOverview,
  attack,
  battleView,
  forfeit,
  playTurn,
  replaceFighter,
  saveTeam,
  settleArena,
} from '../../../src/server/arena';
import { rateLimit } from '../../../src/server/limits';
import { sameAuthOrigin } from '../../../src/server/auth-policy';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../src/server/auth-api-errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'read', 120)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    const battle = new URL(request.url).searchParams.get('battle');
    if (battle)
      return Response.json(await battleView(user.id, battle), {
        headers: privateAuthHeaders,
      });
    try {
      await settleArena();
    } catch {
      /* Le règlement mensuel sera retenté à la prochaine lecture. */
    }
    return Response.json(await arenaOverview(user.id), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    return authApiError(error);
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('team'),
    copyIds: z.array(z.string().max(80)).max(3),
  }),
  z.object({
    action: z.literal('attack'),
    battleId: z.uuid(),
    defenderId: z.string().max(80),
  }),
  z.object({
    action: z.literal('turn'),
    battleId: z.uuid(),
    turn: z.number().int().min(0),
    move: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('move'),
        index: z.number().int().min(0).max(3),
      }),
      z.object({
        type: z.literal('switch'),
        to: z.number().int().min(0).max(2),
      }),
    ]),
  }),
  z.object({
    action: z.literal('replace'),
    battleId: z.uuid(),
    to: z.number().int().min(0).max(2),
  }),
  z.object({ action: z.literal('forfeit'), battleId: z.uuid() }),
]);

export async function POST(request: Request) {
  if (!sameAuthOrigin(request))
    return Response.json({ error: 'Origine interdite' }, { status: 403 });
  try {
    const user = await identity();
    if (!(await rateLimit(user.id, 'mutate', 60)))
      return Response.json({ error: 'Trop de requêtes' }, { status: 429 });
    const input = actionSchema.parse(await request.json());
    if (input.action === 'team')
      return Response.json(await saveTeam(user.id, input.copyIds), {
        headers: privateAuthHeaders,
      });
    const id =
      input.action === 'attack'
        ? await attack(user.id, input.battleId, input.defenderId)
        : input.action === 'turn'
          ? await playTurn(user.id, input.battleId, input.turn, input.move)
          : input.action === 'replace'
            ? await replaceFighter(user.id, input.battleId, input.to)
            : await forfeit(user.id, input.battleId);
    return Response.json(await battleView(user.id, id), {
      headers: privateAuthHeaders,
    });
  } catch (error) {
    if (error instanceof ArenaConflict)
      return Response.json(
        { error: error.message },
        { status: 409, headers: privateAuthHeaders },
      );
    return authApiError(error);
  }
}
