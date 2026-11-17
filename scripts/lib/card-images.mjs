import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Reuse the sharp version already installed with Next.js; no new dependency.
export const sharp = createRequire(require.resolve('next/package.json'))(
  'sharp',
);
export async function optimizeCardImage(input) {
  const image = sharp(input, { limitInputPixels: 40000000 });
  const meta = await image.metadata();
  if (
    !['png', 'jpeg', 'webp'].includes(meta.format) ||
    !meta.width ||
    !meta.height
  )
    throw new Error('Unsupported image bytes');
  const main = await image
    .clone()
    .rotate()
    .resize({
      width: 960,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  const thumbnail = await image
    .clone()
    .rotate()
    .resize({
      width: 240,
      height: 320,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 72 })
    .toBuffer();
  return { main, thumbnail };
}
