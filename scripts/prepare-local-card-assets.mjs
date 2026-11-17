import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { optimizeCardImage, sharp } from './lib/card-images.mjs';
const root = path.resolve('.local/card-assets');
await mkdir(path.join(root, 'images'), { recursive: true });
await mkdir(path.join(root, 'thumbnails'), { recursive: true });
const manifest = JSON.parse(await readFile('card-assets.json', 'utf8'));
const previous = JSON.parse(
  await readFile(path.join(root, 'receipts.json'), 'utf8').catch(() => '[]'),
);
const receipts = [];
const index = {};
const cached = new Map();
let next = 0;
const candidates = manifest.filter((a) => a.imageReferenceUrl);
async function download(a) {
  const existing = previous.find(
    (p) => p.id === a.id && p.source === a.imageReferenceUrl,
  );
  if (
    existing &&
    (await stat(path.join(root, 'images', `${a.id}.webp`)).catch(() => null)) &&
    (await stat(path.join(root, 'thumbnails', `${a.id}.webp`)).catch(
      () => null,
    ))
  )
    return existing;
  const source = new URL(a.imageReferenceUrl);
  if (
    source.protocol !== 'https:' ||
    source.hostname !== 'kh.wiki.gallery' ||
    !/^KH-\d{3}$/.test(a.id)
  )
    throw new Error('Unexpected source');
  let promise = cached.get(source.href);
  if (!promise) {
    promise = (async () => {
      const response = await fetch(source, {
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 20 * 1024 * 1024) throw new Error('Image exceeds 20 MiB');
        chunks.push(chunk);
      }
      const original = Buffer.concat(chunks);
      const optimized = await optimizeCardImage(original);
      return {
        ...optimized,
        sha256: createHash('sha256').update(original).digest('hex'),
        sourceBytes: original.length,
      };
    })();
    cached.set(source.href, promise);
  }
  const result = await promise;
  await writeFile(path.join(root, 'images', `${a.id}.webp`), result.main);
  await writeFile(
    path.join(root, 'thumbnails', `${a.id}.webp`),
    result.thumbnail,
  );
  const main = await sharp(result.main).metadata(),
    thumb = await sharp(result.thumbnail).metadata();
  if (
    main.format !== 'webp' ||
    thumb.format !== 'webp' ||
    thumb.width > 240 ||
    thumb.height > 320 ||
    Math.abs(main.width / main.height - thumb.width / thumb.height) > 0.02
  )
    throw new Error('Optimization validation failed');
  return {
    id: a.id,
    source: source.href,
    sourcePage: a.sourceUrl,
    sourceSha256: result.sha256,
    retrievedAt: new Date().toISOString(),
    sourceBytes: result.sourceBytes,
    imageBytes: result.main.length,
    thumbnailBytes: result.thumbnail.length,
    width: main.width,
    height: main.height,
    thumbnailWidth: thumb.width,
    thumbnailHeight: thumb.height,
    usage: 'local-development-preview-only',
    rightsStatus: a.rightsStatus,
    versionStatus: a.validationStatus,
  };
}
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < candidates.length) {
      const a = candidates[next++];
      try {
        const receipt = await download(a);
        receipts.push(receipt);
        index[a.id] = {
          image: `/api/local-card-assets/${a.id}`,
          thumbnail: `/api/local-card-assets/${a.id}?size=thumbnail`,
        };
      } catch (e) {
        receipts.push({
          id: a.id,
          error: e.message,
          source: a.imageReferenceUrl,
        });
      }
    }
  }),
);
receipts.sort((a, b) => a.id.localeCompare(b.id));
for (const a of manifest) {
  const receipt = receipts.find((r) => r.id === a.id && !r.error);
  if (receipt) {
    a.retrievedAt = receipt.retrievedAt;
    a.localPreview = {
      imagePath: `.local/card-assets/images/${a.id}.webp`,
      thumbnailPath: `.local/card-assets/thumbnails/${a.id}.webp`,
      retrievedAt: receipt.retrievedAt,
      sourceSha256: receipt.sourceSha256,
      usage: 'local-development-preview-only',
      publicPermissionGranted: false,
    };
  }
}
await writeFile('card-assets.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  path.join(root, 'receipts.json'),
  JSON.stringify(receipts, null, 2) + '\n',
);
await writeFile(
  path.join(root, 'index.json'),
  JSON.stringify(index, null, 2) + '\n',
);
const report = {
  checkedAt: new Date().toISOString(),
  localPreviews: Object.keys(index).length,
  missing: manifest.filter((a) => !index[a.id]).map((a) => a.id),
  failed: receipts.filter((a) => a.error),
  publicImagesAdded: 0,
  generatedAIImages: 0,
  storage: '.local/card-assets (ignored, outside public)',
  productionAccess: '404 regardless of stored files',
};
await writeFile(
  'docs/assets/local-preview-report.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;
