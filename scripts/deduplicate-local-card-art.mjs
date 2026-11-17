import { readFile, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('card-assets.json', 'utf8'));
const targets = JSON.parse(
  await readFile('data/card-asset-targets.json', 'utf8'),
);
const replacements = {
  'KH-019': [
    'Sora (KH) (Art).png',
    'https://www.khwiki.com/Gallery:Sora',
    'Illustration officielle de Sora KH1, même tenue, pose distincte du rendu de KH-001.',
  ],
  'KH-020': [
    'Riku (KH) (Art).png',
    'https://www.khwiki.com/Gallery:Riku',
    'Illustration officielle de Riku KH1 dans sa tenue jaune et bleue. Arme non représentée. Le rendu Battle avec épée en bois a été écarté au contrôle visuel.',
  ],
  'KH-004': [
    'Roxas (Art).png',
    'https://www.khwiki.com/Gallery:Roxas',
    'Illustration de Roxas en tenue de Twilight Town, sans utiliser le manteau Organisation.',
  ],
  'KH-024': [
    'Xion 2 KHD.png',
    'https://www.khwiki.com/Gallery:Xion',
    'Xion humaine, sans capuche, autre pose ; aucune substitution par une forme de boss.',
  ],
  'KH-049': [
    'Ventus (Battle) KHBBS.png',
    'https://www.khwiki.com/Gallery:Ventus',
    'Rendu de combat BBS, même tenue et âge ; pas de changement de forme.',
  ],
  'KH-050': [
    'Terra (Battle) KHBBS.png',
    'https://www.khwiki.com/Gallery:Terra',
    'Rendu de combat BBS, aucune substitution par Terra-Xehanort.',
  ],
  'KH-051': [
    'Aqua (Battle) KHBBS.png',
    'https://www.khwiki.com/Gallery:Aqua',
    'Rendu de combat BBS, même tenue ; pas de changement vers Anti-Aqua.',
  ],
  'KH-077': [
    'Mickey Mouse (Battle) KHII.png',
    'https://www.khwiki.com/Gallery:Mickey_Mouse',
    'Rendu de combat KH2, même version.',
  ],
  'KH-100': [
    'Versus Master Xehanort 1 KHIII.png',
    'https://www.khwiki.com/Game:Master_Xehanort',
    'Capture du combat final KH3 avec χ-blade ; aucun remplacement par une incarnation plus jeune.',
  ],
  'KH-098': [
    'Sora and Yozora 02 KHIIIRM.png',
    'https://www.khwiki.com/Gallery:Yozora',
    'Capture Re Mind où Yozora se prépare au combat secret.',
  ],
};
const params = new URLSearchParams({
  action: 'query',
  titles: Object.values(replacements)
    .map((x) => `File:${x[0]}`)
    .join('|'),
  prop: 'imageinfo',
  iiprop: 'url|size|extmetadata',
  format: 'json',
});
const url = 'https://www.khwiki.com/api.php?' + params;
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
const result = await response.json();
const pages = Object.values(result.query.pages);
const changes = [];
for (const [id, [file, evidence, note]] of Object.entries(replacements)) {
  const page = pages.find(
    (p) => p.title.replaceAll('_', ' ') === `File:${file}`,
  );
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Missing candidate ${file}`);
  const asset = manifest.find((a) => a.id === id);
  if (asset.localPath)
    throw new Error('Do not modify published assets with this local-only tool');
  const previous = {
    sourceUrl: asset.sourceUrl,
    imageReferenceUrl: asset.imageReferenceUrl,
    localPreview: asset.localPreview,
    replacedAt: new Date().toISOString(),
  };
  if (asset.imageReferenceUrl !== info.url) {
    asset.previousReferences = [...(asset.previousReferences ?? []), previous];
    asset.sourceUrl = info.descriptionurl;
    asset.imageReferenceUrl = info.url;
    asset.retrievedAt = null;
    delete asset.localPreview;
  }
  asset.research = {
    ...asset.research,
    targetFile: file,
    versionEvidenceUrl: evidence,
    metadata: {
      width: info.width,
      height: info.height,
      description: info.extmetadata?.ImageDescription?.value ?? null,
      credit: info.extmetadata?.Credit?.value ?? null,
    },
  };
  asset.matchNotes =
    note + ' Aperçu local uniquement ; aucun droit de publication accordé.';
  asset.metadataCheckedAt = new Date().toISOString();
  targets[id] = file;
  changes.push({ id, file, evidence, note });
}
await writeFile('card-assets.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  'data/card-asset-targets.json',
  JSON.stringify(targets, null, 2) + '\n',
);
await writeFile(
  'docs/assets/deduplication-research.json',
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      metadataRequest: url,
      changes,
      retained: [
        {
          ids: ['KH-068', 'KH-078'],
          reason:
            'Souvenance et Limite correspondent à Limit Form : pas de changement de monde ou de forme pour créer une différence artificielle.',
          source: 'https://kingdomhearts.fandom.com/fr/wiki/Forme_Souvenance',
        },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `${changes.length} local reference replacements prepared; publication rights unchanged.`,
);
