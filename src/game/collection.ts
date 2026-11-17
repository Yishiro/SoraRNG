import type { Card, Player } from './core';
export function discoveryIds(player: Player | undefined, holographic = false) {
  return new Set([
    ...(!holographic ? (player?.holoDiscoveries ?? []) : []),
    ...(holographic
      ? (player?.holoDiscoveries ?? [])
      : (player?.discoveries ?? [])),
    ...(player?.copies
      .filter((c) => !holographic || c.holo)
      .map((c) => c.cardId) ?? []),
  ]);
}
export function collectionProgress(
  cards: Card[],
  player: Player | undefined,
  holographic = false,
) {
  const ids = discoveryIds(player, holographic);
  const group = (field: 'rarity' | 'origin') =>
    [...new Set(cards.map((c) => c[field]))].map((name) => {
      const pool = cards.filter((c) => c[field] === name);
      return {
        name,
        total: pool.length,
        discovered: pool.filter((c) => ids.has(c.id)).length,
      };
    });
  return {
    total: cards.length,
    discovered: cards.filter((c) => ids.has(c.id)).length,
    byRarity: group('rarity'),
    byOrigin: group('origin'),
  };
}
