export const discordId = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{17,20}$/.test(value);
export class AuthenticationRequired extends Error {
  constructor() {
    super('Connexion Discord requise');
    this.name = 'AuthenticationRequired';
  }
}
export function sameAuthOrigin(
  request: Request,
  canonical = process.env.NEXTAUTH_URL,
) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const expected = new URL(canonical ?? request.url);
    const actual = new URL(origin);
    return (
      ['http:', 'https:'].includes(actual.protocol) &&
      actual.origin === expected.origin &&
      actual.href === `${actual.origin}/`
    );
  } catch {
    return false;
  }
}
export function safeAuthRedirect(url: string, baseUrl: string) {
  try {
    const base = new URL(baseUrl);
    const target = new URL(url, base);
    return target.origin === base.origin &&
      ['http:', 'https:'].includes(target.protocol)
      ? target.href
      : base.href;
  } catch {
    return baseUrl;
  }
}
export function safeAuthLogCode(code: string) {
  return new Set([
    'OAUTH_CALLBACK_ERROR',
    'SIGNIN_OAUTH_ERROR',
    'JWT_SESSION_ERROR',
    'SESSION_ERROR',
    'SIGNIN_CALLBACK_ERROR',
    'NO_SECRET',
    'NEXTAUTH_URL',
    'DEBUG_ENABLED',
    'CLIENT_FETCH_ERROR',
  ]).has(code)
    ? code
    : 'AUTH_ERROR';
}
