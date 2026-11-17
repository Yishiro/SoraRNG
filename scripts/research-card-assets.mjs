import { readFile, writeFile, mkdir } from 'node:fs/promises';
const cards = JSON.parse(
  await readFile('data/kingdom_hearts_catalogue_150.json', 'utf8'),
).cards;
const targets = JSON.parse(
  await readFile('data/card-asset-targets.json', 'utf8'),
);
const existing = JSON.parse(
  await readFile('card-assets.json', 'utf8').catch(() => '[]'),
);
if (existing.some((a) => a.localPath || a.localPreview))
  throw new Error(
    'Published assets exist: merge research manually to preserve rights approvals.',
  );
const titles = [...new Set(Object.values(targets).filter(Boolean))];
const results = new Map();
const requests = [];
for (let i = 0; i < titles.length; i += 15) {
  const params = new URLSearchParams({
    action: 'query',
    titles: titles
      .slice(i, i + 15)
      .map((n) => `File:${n}`)
      .join('|'),
    prop: 'imageinfo|revisions',
    iiprop: 'url|size|extmetadata',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
  });
  const url = `https://www.khwiki.com/api.php?${params}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SoraRNG-AssetAudit/1.0 (metadata only; no image download)',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  requests.push({
    url,
    status: response.status,
    checkedAt: new Date().toISOString(),
  });
  for (const page of Object.values(body.query.pages)) {
    const content = page.revisions?.[0]?.slots?.main?.['*'] ?? '';
    const info = page.imageinfo?.[0];
    results.set(page.title.replace(/^File:/, '').replaceAll('_', ' '), {
      title: page.title,
      info,
      copyrightTags: [
        ...content.matchAll(
          /\{\{(copyright|fairuse|fair use|screenshot|artwork|game|Disney|Square Enix|render|official)[^}]*\}\}/gi,
        ),
      ]
        .map((m) => m[0])
        .slice(0, 6),
      pageId: page.pageid,
    });
  }
}
const checkedAt = new Date().toISOString();
const manifest = cards.map((card) => {
  const file = targets[card.id];
  const result = file ? results.get(file.replaceAll('_', ' ')) : null;
  const info = result?.info;
  return {
    id: card.id,
    name: card.personnage,
    version: card.version,
    origin: card.origine,
    sourceUrl: info?.descriptionurl ?? null,
    imageReferenceUrl: info?.url ?? null,
    knownRightsHolder: info
      ? 'Disney / Square Enix et éventuels autres ayants droit ; auteur individuel non confirmé'
      : null,
    rightsStatus: info ? 'awaiting_permission' : 'missing',
    rightsEvidenceUrl: 'https://www.khwiki.com/KHWiki:Copyrights',
    aiStatus: 'not_verified_reference_only',
    localPath: null,
    thumbnailPath: null,
    validationStatus: info
      ? 'reference_only_version_review_required'
      : 'no_image_identified',
    retrievedAt: null,
    metadataCheckedAt: checkedAt,
    matchNotes: info
      ? 'Candidat identifié par son nom de fichier et son jeu ; correspondance visuelle exacte non validée. Aucune autorisation de publication établie.'
      : 'Aucune illustration exacte confirmée pour cette version ; ne pas substituer une autre forme.',
    research: {
      targetFile: file ?? null,
      query: `Kingdom Hearts ${card.personnage} ${card.version} official artwork`,
      metadata: info
        ? {
            width: info.width,
            height: info.height,
            description: info.extmetadata?.ImageDescription?.value ?? null,
            credit: info.extmetadata?.Credit?.value ?? null,
            copyrightTags: result.copyrightTags,
          }
        : null,
    },
  };
});
const notes = {
  'KH-068':
    'Forme Souvenance et Forme Limite (KH-078) semblent désigner Limit Form ; deux cartes distinctes conservées. Ne pas inventer deux apparences.',
  'KH-078':
    'Même candidat Limit Form que KH-068 : synonymie à vérifier, sans changement du catalogue.',
  'KH-079':
    'Le candidat est étiqueté KH1, alors que la carte indique CoM. Costume Dark Mode candidat uniquement ; adéquation exacte non validée.',
  'KH-089':
    'La carte indique BBS ; Armored Ventus Nightmare est associé à DDD. Aucun remplacement par cette autre version.',
  'KH-095':
    'Forme Lumière : aucune forme canonique précise identifiée ; ne pas assimiler automatiquement à Ultimate Form.',
  'KH-099':
    'Lumière du Crépuscule : sous-titre de carte, aucune apparence distincte confirmée.',
  'KH-149':
    'Crépuscule : nom ambigu. Reflet correspond à Dusk et Armure Astrale à Twilight Thorn ; aucune substitution automatique.',
};
for (const a of manifest) if (notes[a.id]) a.matchNotes = notes[a.id];
const missingQueries = [];
for (const a of manifest.filter((x) => !x.imageReferenceUrl)) {
  const query =
    a.research.targetFile?.replace(/\.png$/, '') ?? `${a.name} ${a.version}`;
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '5',
    format: 'json',
  });
  const url = `https://www.khwiki.com/api.php?${params}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  missingQueries.push({
    id: a.id,
    query,
    url,
    status: response.status,
    titles: (body.query?.search ?? []).map((x) => x.title),
    checkedAt: new Date().toISOString(),
  });
}
await mkdir('docs/assets', { recursive: true });
await writeFile('card-assets.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  'docs/assets/research-requests.json',
  JSON.stringify(requests, null, 2) + '\n',
);
await writeFile(
  'docs/assets/missing-searches.json',
  JSON.stringify(missingQueries, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      cards: manifest.length,
      candidates: manifest.filter((a) => a.sourceUrl).length,
      missing: manifest
        .filter((a) => !a.sourceUrl)
        .map((a) => `${a.id}: ${a.research.targetFile}`),
    },
    null,
    2,
  ),
);
