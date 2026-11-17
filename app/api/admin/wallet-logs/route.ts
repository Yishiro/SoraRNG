import { identity } from '../../../../src/server/game';
import { requireStaff } from '../../../../src/server/permissions';
import {
  authApiError,
  privateAuthHeaders,
} from '../../../../src/server/auth-api-errors';
import { rateLimit } from '../../../../src/server/limits';
import { walletLogs, walletLogQuery } from '../../../../src/server/wallet-logs';
export async function GET(request: Request) {
  try {
    const user = await identity();
    requireStaff(user.id);
    if (!(await rateLimit(user.id, 'staff-wallet-logs', 60)))
      return Response.json(
        { error: 'Trop de requêtes' },
        { status: 429, headers: privateAuthHeaders },
      );
    const parsed = walletLogQuery.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success)
      return Response.json(
        { error: 'Filtres invalides' },
        { status: 400, headers: privateAuthHeaders },
      );
    try {
      return Response.json(await walletLogs(user.id, parsed.data), {
        headers: privateAuthHeaders,
      });
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error && error.name === 'ZodError')
      )
        return Response.json(
          { error: 'Curseur invalide' },
          { status: 400, headers: privateAuthHeaders },
        );
      throw error;
    }
  } catch (error) {
    const response = authApiError(error);
    for (const [key, value] of Object.entries(privateAuthHeaders))
      response.headers.set(key, value);
    return response;
  }
}
