import { readFile, writeFile, copyFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (!process.argv.includes('--owner-request'))
  throw new Error('Explicit owner request required');
const manifest = JSON.parse(await readFile('card-assets.json', 'utf8'));
const requestedAt = new Date().toISOString();
await mkdir('public/assets/cards/thumbnails', { recursive: true });
const pending = [];
for (const asset of manifest) {
  if (!asset.localPreview) continue;
  if (!/^KH-\d{3}$/.test(asset.id)) throw new Error('Invalid card identity');
  const image = `.local/card-assets/images/${asset.id}.webp`,
    thumbnail = `.local/card-assets/thumbnails/${asset.id}.webp`;
  await access(image);
  await access(thumbnail);
  pending.push({ asset, image, thumbnail });
}
for (const { asset, image, thumbnail } of pending) {
  await copyFile(image, `public/assets/cards/${asset.id}.webp`);
  await copyFile(thumbnail, `public/assets/cards/thumbnails/${asset.id}.webp`);
  asset.localPath = `/assets/cards/${asset.id}.webp`;
  asset.thumbnailPath = `/assets/cards/thumbnails/${asset.id}.webp`;
  asset.ownerPublication = {
    status: 'owner_requested_rights_unverified',
    scope: 'public_site',
    requestedAt,
  };
  asset.publishedFileSha256 = createHash('sha256')
    .update(await readFile(image))
    .digest('hex');
}
await writeFile('card-assets.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    copiedIllustrations: pending.length,
    missingIllustrations: manifest.length - pending.length,
    rightsStatusChanged: false,
    aiImagesGenerated: false,
  }),
);
