import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sharp, optimizeCardImage } from './lib/card-images.mjs';
import path from 'node:path';
const manifest = JSON.parse(await readFile('card-assets.json', 'utf8'));
const catalog = JSON.parse(
  await readFile('data/kingdom_hearts_catalogue_150.json', 'utf8'),
).cards;
const publicRoot = path.resolve('public');
const publishable = (a) =>
  a.aiStatus === 'verified_non_ai' &&
  ['licensed', 'public_domain', 'permission_granted'].includes(
    a.rightsStatus,
  ) &&
  ['approved_exact_match', 'published'].includes(a.validationStatus) &&
  a.rightsProof?.url &&
  a.rightsProof.license &&
  a.rightsProof.scope &&
  a.rightsProof.verifiedBy &&
  a.rightsProof.verifiedAt;
const displayable = (a) =>
  publishable(a) ||
  Boolean(
    a.ownerPublication?.status === 'owner_requested_rights_unverified' &&
    a.ownerPublication.scope === 'public_site' &&
    a.ownerPublication.requestedAt,
  );
const localFile = (id, thumbnail = false) =>
  path.join(
    publicRoot,
    'assets',
    'cards',
    ...(thumbnail ? ['thumbnails'] : []),
    `${id}.webp`,
  );
await mkdir(localFile('placeholder').replace(/placeholder.webp$/, ''), {
  recursive: true,
});
await mkdir(path.join(publicRoot, 'assets', 'cards', 'thumbnails'), {
  recursive: true,
});
if (manifest.length !== 150 || new Set(manifest.map((a) => a.id)).size !== 150)
  throw new Error('Manifest must cover 150 unique cards');
for (const card of catalog) {
  const a = manifest.find((x) => x.id === card.id);
  if (
    !a ||
    a.name !== card.personnage ||
    a.version !== card.version ||
    a.origin !== card.origine
  )
    throw new Error(`Identity mismatch ${card.id}`);
}
if (process.argv.includes('--prepare')) {
  for (const a of manifest) {
    if (!publishable(a)) continue;
    if (!/^KH-\d{3}$/.test(a.id) || !a.imageReferenceUrl)
      throw new Error('Invalid image identity');
    if (a.localPath) continue;
    const url = new URL(a.imageReferenceUrl);
    if (
      url.protocol !== 'https:' ||
      !['kh.wiki.gallery', 'www.khwiki.com'].includes(url.hostname)
    )
      throw new Error(
        'Source host must be explicitly reviewed before download',
      );
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    const limit = 20 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit)
      throw new Error('Image too large');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > limit) throw new Error('Image too large');
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks);
    const { main, thumbnail } = await optimizeCardImage(input);
    await writeFile(localFile(a.id), main);
    await writeFile(localFile(a.id, true), thumbnail);
    a.localPath = `/assets/cards/${a.id}.webp`;
    a.thumbnailPath = `/assets/cards/thumbnails/${a.id}.webp`;
    a.validationStatus = 'published';
    a.retrievedAt = new Date().toISOString();
    a.sourceSha256 = createHash('sha256').update(input).digest('hex');
  }
  await writeFile('card-assets.json', JSON.stringify(manifest, null, 2) + '\n');
}
const errors = [];
let illustrated = 0,
  awaiting = 0,
  missing = 0;
for (const a of manifest) {
  if (a.rightsStatus === 'awaiting_permission' && a.imageReferenceUrl)
    awaiting++;
  if (a.localPath || a.thumbnailPath) {
    if (!displayable(a)) {
      errors.push(`Missing publication decision: ${a.id}`);
      continue;
    }
    if (
      a.localPath !== `/assets/cards/${a.id}.webp` ||
      a.thumbnailPath !== `/assets/cards/thumbnails/${a.id}.webp`
    ) {
      errors.push(`Invalid paths: ${a.id}`);
      continue;
    }
    const main = await sharp(localFile(a.id)).metadata();
    const thumb = await sharp(localFile(a.id, true)).metadata();
    if (
      main.format !== 'webp' ||
      thumb.format !== 'webp' ||
      thumb.width > 240 ||
      thumb.height > 320 ||
      main.width > 960 ||
      main.height > 1280
    )
      errors.push(`Invalid optimization: ${a.id}`);
    if (Math.abs(main.width / main.height - thumb.width / thumb.height) > 0.02)
      errors.push(`Aspect ratio: ${a.id}`);
    const bytes = (await stat(localFile(a.id, true))).size;
    if (bytes > 150000) errors.push(`Thumbnail budget: ${a.id}`);
    illustrated++;
  } else if (!a.imageReferenceUrl) missing++;
}
for (const folder of ['assets/cards', 'assets/cards/thumbnails'])
  for (const file of await readdir(path.join(publicRoot, folder))) {
    if (!/\.(webp|png|jpe?g|gif|svg)$/i.test(file)) continue;
    const expected = '/' + folder + '/' + file;
    if (
      !manifest.some(
        (a) =>
          displayable(a) &&
          (a.localPath === expected || a.thumbnailPath === expected),
      )
    )
      errors.push(`Untracked published image: ${expected}`);
  }
const report = {
  checkedAt: new Date().toISOString(),
  total: manifest.length,
  illustrated,
  verifiedRightsIllustrations: manifest.filter(
    (a) => a.localPath && publishable(a),
  ).length,
  ownerRequestedUnverifiedPublication: manifest.filter(
    (a) => a.localPath && a.ownerPublication,
  ).length,
  awaitingPermission: awaiting,
  noImageIdentified: missing,
  errors,
  notes: [
    '135 existing illustrations published at explicit owner request. This is not evidence of rightsholder permission.',
    'Rights, exact version and non-AI verification statuses are unchanged. No AI images generated.',
    'Public cards load local static files, not external image URLs.',
  ],
};
await writeFile(
  'docs/assets/report.json',
  JSON.stringify(report, null, 2) + '\n',
);
await writeFile(
  'docs/assets/REPORT.md',
  `# Rapport des illustrations\n\nV�rification : ${report.checkedAt}\n\n- Cartes illustr�es sur le site : **${illustrated}**\n- Illustrations avec droits v�rifi�s : **${report.verifiedRightsIllustrations}**\n- Publications demand�es par le propri�taire, droits non v�rifi�s : **${report.ownerRequestedUnverifiedPublication}**\n- R�f�rences toujours en attente d�autorisation : **${awaiting}**\n- Sans illustration : **${missing}**\n- Erreurs techniques : **${errors.length}**\n\nLa demande explicite du propri�taire remplace la restriction ant�rieure aux aper�us locaux. Elle ne constitue pas une permission des ayants droit. Les statuts de droits, de provenance et de validation exacte du manifeste ne sont pas transform�s en autorisations. Aucune image IA g�n�r�e. Les images et miniatures WebP existantes ont �t� copi�es sans modification ; les r�f�rences et empreintes restent conserv�es.\n\n## Cartes sans illustration\n\n${manifest
    .filter((a) => !a.localPath)
    .map((a) => `- ${a.id} � ${a.name} / ${a.version}`)
    .join(
      '\n',
    )}\n\nLes d�tails historiques de recherche et conditions figurent dans WORKFLOW.md et card-assets.json.\n`,
);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
