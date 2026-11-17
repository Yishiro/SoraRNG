import type { Copy, Player } from './core';

export const showcaseLimit = 5;

export function showcaseCopies(
  player: Pick<Player, 'showcase' | 'copies'>,
): Copy[] {
  if (!player.showcase)
    return player.copies
      .filter((copy) => copy.favorite)
      .slice(0, showcaseLimit);
  const owned = new Map(player.copies.map((copy) => [copy.id, copy]));
  return [...new Set(player.showcase)].slice(0, showcaseLimit).flatMap((id) => {
    const copy = owned.get(id);
    return copy ? [copy] : [];
  });
}
