import { randomUUID } from 'node:crypto';
import { draw, type Card } from '../game/core';
import { economy } from '../game/config';
// Preview IDs never become owned copies or recorded summons.
export function previewBooster(cards: Card[]) {
  if (cards.length !== 150) throw new Error('Catalogue indisponible');
  return {
    demo: true as const,
    boosterCount: 1,
    cardsPerBooster: economy.cardsPerBooster,
    copies: Array.from({ length: economy.cardsPerBooster }, () => ({
      ...draw(cards),
      id: randomUUID(),
      level: 1,
      awakening: 0,
      locked: false,
      favorite: false,
    })),
  };
}
