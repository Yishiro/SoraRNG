import type { Copy } from './core';
export type CopyFilters = {
  holo: boolean;
  favorites: boolean;
  duplicates: boolean;
  minLevel: number;
  minAwakening: number;
};
export function collectionCopies(copies: Copy[], filter: CopyFilters) {
  const counts = new Map<string, number>();
  for (const copy of copies)
    counts.set(copy.cardId, (counts.get(copy.cardId) ?? 0) + 1);
  return copies.filter(
    (c) =>
      (!filter.holo || c.holo) &&
      (!filter.favorites || c.favorite) &&
      (!filter.duplicates || (counts.get(c.cardId) ?? 0) > 1) &&
      c.level >= filter.minLevel &&
      c.awakening >= filter.minAwakening,
  );
}
export type RevealBaseline = {
  discoveries: string[];
  owned: Record<string, number>;
};
export function revealBaseline(
  copies: Copy[],
  discoveries: string[],
): RevealBaseline {
  const owned: Record<string, number> = {};
  for (const copy of copies) owned[copy.cardId] = (owned[copy.cardId] ?? 0) + 1;
  return { discoveries: [...discoveries], owned };
}
export function openingSummary(copies: Copy[], baseline: RevealBaseline) {
  const known = new Set(baseline.discoveries),
    owned = { ...baseline.owned },
    newModels = new Set<string>(),
    duplicates = new Set<string>();
  for (const c of copies) {
    if (!known.has(c.cardId)) newModels.add(c.cardId);
    if ((owned[c.cardId] ?? 0) > 0) duplicates.add(c.id);
    owned[c.cardId] = (owned[c.cardId] ?? 0) + 1;
  }
  return {
    newModels: [...newModels],
    duplicateIds: [...duplicates],
    holographics: copies.filter((c) => c.holo).length,
    total: copies.length,
  };
}
