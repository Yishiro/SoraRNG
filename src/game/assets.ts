import manifest from '../../card-assets.json';

export type CardAsset = {
  id: string;
  name: string;
  version: string;
  origin: string;
  sourceUrl: string | null;
  imageReferenceUrl: string | null;
  knownRightsHolder: string | null;
  rightsStatus: string;
  rightsEvidenceUrl: string;
  localPath: string | null;
  aiStatus?: string;
  thumbnailPath: string | null;
  validationStatus: string;
  retrievedAt: string | null;
  ownerPublication?: {
    status: 'owner_requested_rights_unverified';
    requestedAt: string;
    scope: 'public_site';
  };
  rightsProof?: {
    url: string;
    license: string;
    scope: string;
    verifiedBy: string;
    verifiedAt: string;
  };
};
export function canPublishAsset(asset: CardAsset) {
  return (
    ['licensed', 'public_domain', 'permission_granted'].includes(
      asset.rightsStatus,
    ) &&
    asset.aiStatus === 'verified_non_ai' &&
    ['approved_exact_match', 'published'].includes(asset.validationStatus) &&
    Boolean(
      asset.rightsProof?.url &&
      asset.rightsProof.license &&
      asset.rightsProof.scope &&
      asset.rightsProof.verifiedBy &&
      asset.rightsProof.verifiedAt,
    )
  );
}
// Explicit display request is recorded separately from a verified rights grant.
export function canDisplayAsset(asset: CardAsset) {
  return (
    canPublishAsset(asset) ||
    Boolean(
      asset.ownerPublication?.status === 'owner_requested_rights_unverified' &&
      asset.ownerPublication.scope === 'public_site' &&
      asset.ownerPublication.requestedAt,
    )
  );
}
const index = new Map<string, CardAsset>(
  (manifest as CardAsset[]).map((asset) => [asset.id, asset]),
);
export function getCardAsset(id: string) {
  const asset = index.get(id);
  if (
    !asset ||
    !canDisplayAsset(asset) ||
    asset.localPath !== `/assets/cards/${id}.webp` ||
    asset.thumbnailPath !== `/assets/cards/thumbnails/${id}.webp`
  )
    return null;
  return asset;
}
