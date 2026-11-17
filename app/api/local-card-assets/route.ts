import {
  localAssetIndex,
  localAssetRequestAllowed,
  localAssetHeaders,
} from '../../../src/server/local-assets';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!localAssetRequestAllowed(request))
    return new Response(null, { status: 404, headers: localAssetHeaders });
  return Response.json(await localAssetIndex(), { headers: localAssetHeaders });
}
