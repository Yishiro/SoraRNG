import { test, expect } from '@playwright/test';
test('private preview route remains loopback-only alongside owner-requested static images', async ({
  request,
}) => {
  // 270 requests can exceed 30 seconds while the development server compiles.
  test.setTimeout(90000);
  const response = await request.get('/api/local-card-assets');
  expect(response.status()).toBe(200);
  const index = await response.json();
  expect(Object.keys(index)).toHaveLength(135);
  const entries = Object.values(index) as {
    image: string;
    thumbnail: string;
  }[];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < entries.length) {
        const asset = entries[next++];
        for (const url of [asset.image, asset.thumbnail]) {
          const r = await request.get(url);
          expect(r.status(), url).toBe(200);
          expect(r.headers()['content-type']).toBe('image/webp');
          expect(r.headers()['cache-control']).toContain('no-store');
        }
      }
    }),
  );
  expect((await request.get('/assets/cards/KH-001.webp')).status()).toBe(200);
  expect((await request.get('/assets/cards/KH-089.webp')).status()).toBe(404);
  expect((await request.get('/api/local-card-assets/KH-999')).status()).toBe(
    404,
  );
  expect(
    (
      await request.get('/api/local-card-assets', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      })
    ).status(),
  ).toBe(404);
});
