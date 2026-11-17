import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  localAssetRoot,
  localAssetIndex,
  localAssetRequestAllowed,
  localAssetHeaders,
} from '../../../../src/server/local-assets';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!localAssetRequestAllowed(request))
    return new Response(null, { status: 404, headers: localAssetHeaders });
  const { id } = await params;
  if (!/^KH-\d{3}$/.test(id) || !(await localAssetIndex())[id])
    return new Response(null, { status: 404, headers: localAssetHeaders });
  const thumbnail =
    new URL(request.url).searchParams.get('size') === 'thumbnail';
  try {
    const bytes = await readFile(
      path.join(
        localAssetRoot,
        thumbnail ? 'thumbnails' : 'images',
        `${id}.webp`,
      ),
    );
    return new Response(bytes, {
      headers: { ...localAssetHeaders, 'Content-Type': 'image/webp' },
    });
  } catch {
    return new Response(null, { status: 404, headers: localAssetHeaders });
  }
}
