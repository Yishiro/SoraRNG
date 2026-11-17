import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const localAssetRoot = path.join(process.cwd(), '.local', 'card-assets');
export function allowLocalAssets(
  environment: string | undefined,
  url: string,
  host: string | null,
  forwarded: boolean,
) {
  if (environment !== 'development' || forwarded || !host) return false;
  const loopback = (name: string) =>
    ['localhost', '127.0.0.1', '[::1]'].includes(name);
  try {
    return (
      loopback(new URL(url).hostname) &&
      loopback(new URL(`http://${host}`).hostname)
    );
  } catch {
    return false;
  }
}
export function localAssetRequestAllowed(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const externalForward =
    Boolean(request.headers.get('forwarded')) ||
    Boolean(
      forwardedFor
        ?.split(',')
        .some(
          (ip) => !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip.trim()),
        ),
    ) ||
    Boolean(
      forwardedHost &&
      !allowLocalAssets('development', request.url, forwardedHost, false),
    );
  return allowLocalAssets(
    process.env.NODE_ENV,
    request.url,
    request.headers.get('host'),
    externalForward,
  );
}
export async function localAssetIndex(): Promise<
  Record<string, { image: string; thumbnail: string }>
> {
  try {
    return JSON.parse(
      await readFile(path.join(localAssetRoot, 'index.json'), 'utf8'),
    );
  } catch {
    return {};
  }
}
export const localAssetHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
};
