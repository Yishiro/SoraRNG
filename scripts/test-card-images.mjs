import assert from 'node:assert/strict';
import { sharp, optimizeCardImage } from './lib/card-images.mjs';
// Solid-color buffers are geometry test fixtures, not card illustrations.
for (const [width, height] of [
  [600, 1000],
  [2000, 1000],
  [100, 200],
]) {
  const fixture = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const { main, thumbnail } = await optimizeCardImage(fixture);
  const full = await sharp(main).metadata(),
    thumb = await sharp(thumbnail).metadata();
  assert.equal(full.format, 'webp');
  assert.equal(thumb.format, 'webp');
  assert.ok(
    full.width <= 960 &&
      full.height <= 1280 &&
      full.width <= width &&
      full.height <= height,
  );
  assert.ok(
    thumb.width <= 240 &&
      thumb.height <= 320 &&
      thumb.width <= width &&
      thumb.height <= height,
  );
  assert.ok(Math.abs(full.width / full.height - width / height) < 0.01);
  assert.ok(Math.abs(thumb.width / thumb.height - width / height) < 0.01);
  assert.ok(thumbnail.length < 150000);
}
await assert.rejects(optimizeCardImage(Buffer.from('not an image')));
console.log(
  'PASS: WebP, main/thumbnail dimensions, aspect ratio, no enlargement, thumbnail budget, invalid bytes rejected. Memory-only fixtures; no published image.',
);
