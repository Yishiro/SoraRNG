import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sharp } from './lib/card-images.mjs';
const root = path.resolve('.local/card-assets');
const receipts = JSON.parse(
  await readFile(path.join(root, 'receipts.json'), 'utf8'),
);
const manifest = JSON.parse(await readFile('card-assets.json', 'utf8'));
const groups = new Map();
const outputGroups = new Map();
for (const receipt of receipts.filter((r) => !r.error)) {
  groups.set(receipt.sourceSha256, [
    ...(groups.get(receipt.sourceSha256) ?? []),
    receipt.id,
  ]);
  const bytes = await readFile(path.join(root, 'images', `${receipt.id}.webp`));
  const hash = createHash('sha256').update(bytes).digest('hex');
  outputGroups.set(hash, [...(outputGroups.get(hash) ?? []), receipt.id]);
}
const report = {
  checkedAt: new Date().toISOString(),
  localCards: receipts.filter((r) => !r.error).length,
  distinctSources: groups.size,
  distinctOptimizedImages: outputGroups.size,
  duplicateGroups: [...outputGroups.values()]
    .filter((g) => g.length > 1)
    .map((ids) =>
      ids.map((id) => {
        const a = manifest.find((a) => a.id === id);
        return { id, name: a.name, version: a.version };
      }),
    ),
  changedReferences: JSON.parse(
    await readFile('docs/assets/deduplication-research.json', 'utf8'),
  ).changes.map((c) => c.id),
};
await writeFile(
  'docs/assets/duplicate-report.json',
  JSON.stringify(report, null, 2) + '\n',
);
if (process.argv.includes('--contact-sheet')) {
  const cells = [];
  let i = 0;
  for (const id of report.changedReferences) {
    const art = await sharp(path.join(root, 'images', `${id}.webp`))
      .resize({
        width: 235,
        height: 300,
        fit: 'contain',
        background: '#121b32',
      })
      .png()
      .toBuffer();
    const left = (i % 5) * 240,
      top = Math.floor(i / 5) * 340;
    cells.push({ input: art, left, top });
    const label = Buffer.from(
      `<svg width="235" height="35"><rect width="235" height="35" fill="#080d1c"/><text x="8" y="23" fill="#e6bc68" font-size="18">${id}</text></svg>`,
    );
    cells.push({ input: label, left, top: top + 300 });
    i++;
  }
  await mkdir(path.join(root, 'qa'), { recursive: true });
  await sharp({
    create: {
      width: 1200,
      height: Math.ceil(i / 5) * 340,
      channels: 4,
      background: '#080d1c',
    },
  })
    .composite(cells)
    .png()
    .toFile(path.join(root, 'qa', 'deduplication.png'));
}
console.log(JSON.stringify(report, null, 2));
