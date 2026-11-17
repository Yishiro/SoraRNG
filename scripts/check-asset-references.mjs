import { readFile, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('card-assets.json', 'utf8'));
const urls = [
  ...new Set(
    manifest.flatMap((a) => [a.sourceUrl, a.imageReferenceUrl]).filter(Boolean),
  ),
];
const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const r = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        results.push({
          url,
          status: r.status,
          ok: r.ok,
          checkedAt: new Date().toISOString(),
          method: 'HEAD',
          bytesDownloaded: 0,
        });
      } catch (e) {
        results.push({
          url,
          status: null,
          ok: false,
          error: e.message,
          checkedAt: new Date().toISOString(),
          method: 'HEAD',
          bytesDownloaded: 0,
        });
      }
    }
  }),
);
await writeFile(
  'docs/assets/reference-health.json',
  JSON.stringify(results, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      references: results.length,
      successful: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
    },
    null,
    2,
  ),
);
if (results.some((r) => !r.ok)) process.exitCode = 1;
