import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import manifest from '../../card-assets.json';
import source from '../../data/kingdom_hearts_catalogue_150.json';
import {
  canPublishAsset,
  getCardAsset,
  type CardAsset,
} from '../../src/game/assets';
import GameCard from '../../src/components/game-card';
test('chaque carte possède une identité correspondante dans le manifeste', () => {
  expect(manifest).toHaveLength(150);
  expect(new Set(manifest.map((a) => a.id)).size).toBe(150);
  for (const c of source.cards) {
    const a = manifest.find((x) => x.id === c.id);
    expect(a).toMatchObject({
      name: c.personnage,
      version: c.version,
      origin: c.origine,
    });
    expect(Boolean(getCardAsset(c.id))).toBe(Boolean(a?.localPath));
  }
});
test('publication bloquée sans droits, preuve, vérification de version et provenance non IA', () => {
  const a = manifest[0] as CardAsset;
  expect(canPublishAsset(a)).toBe(false);
  const approved = {
    ...a,
    rightsStatus: 'permission_granted',
    aiStatus: 'verified_non_ai',
    validationStatus: 'approved_exact_match',
    rightsProof: {
      url: 'https://example.com/permission',
      license: 'Written permission',
      scope: 'This game',
      verifiedBy: 'Test only',
      verifiedAt: '2026-10-28',
    },
  };
  expect(canPublishAsset(approved)).toBe(true);
  expect(canPublishAsset({ ...approved, rightsProof: undefined })).toBe(false);
  expect(canPublishAsset({ ...approved, aiStatus: 'unknown' })).toBe(false);
  expect(
    canPublishAsset({
      ...approved,
      validationStatus: 'reference_only_version_review_required',
    }),
  ).toBe(false);
});
test('cadre neutre sans requête image pour une carte sans illustration', () => {
  const { container } = render(
    <GameCard
      card={{
        id: 'KH-089',
        name: 'Sora',
        version: 'Îles du Destin',
        origin: 'KH1',
        rarity: 'Commun',
        affinity: 'Lumière',
        type: 'Personnage',
        maxLevel: 20,
      }}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Sora' })).toBeInTheDocument();
  expect(screen.getByText('Illustration indisponible')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
});
test('publication demandée séparément des droits, images exactes et locales', () => {
  const asset = getCardAsset('KH-001')!;
  expect(asset.localPath).toBe('/assets/cards/KH-001.webp');
  expect(asset.rightsStatus).toBe('awaiting_permission');
  expect(canPublishAsset(asset)).toBe(false);
  expect(asset.ownerPublication?.status).toBe(
    'owner_requested_rights_unverified',
  );
});
