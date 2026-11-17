import { ZodError } from 'zod';
import { AuthenticationRequired } from './auth-policy';
import { ForbiddenAccess } from './permissions';
export const privateAuthHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
};
export function authApiError(error: unknown) {
  if (error instanceof ForbiddenAccess)
    return Response.json(
      { error: error.message },
      { status: 403, headers: privateAuthHeaders },
    );
  if (error instanceof AuthenticationRequired)
    return Response.json({ error: error.message }, { status: 401 });
  if (error instanceof ZodError)
    return Response.json({ error: 'Requête invalide' }, { status: 400 });
  if (error && typeof error === 'object' && 'code' in error)
    return Response.json(
      { error: 'Service temporairement indisponible' },
      { status: 503 },
    );
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Service temporairement indisponible',
    },
    { status: 400 },
  );
}
