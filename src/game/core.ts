import { randomInt } from 'node:crypto';
import { z } from 'zod';

import { rarities, rates, caps, holoRate } from './config';
export { rarities, rates, caps } from './config';
export const cardSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    rarity: z.enum(rarities),
    type: z.string().min(1),
    origin: z.string().min(1),
    affinity: z.string().min(1),
    maxLevel: z.number().int().positive(),
  })
  .passthrough();
export type Card = z.infer<typeof cardSchema>;
export type Copy = {
  id: string;
  cardId: string;
  holo: boolean;
  level: number;
  awakening: number;
  locked: boolean;
  favorite: boolean;
  // Fusion : rang (0 à 10) et points de statistiques répartis par le joueur.
  fusion?: number;
  bonus?: Partial<import('./stats').Stats>;
};
export type Player = {
  auctionNotifications?: boolean;
  wishlist?: string[];
  showcase?: string[];
  boost?: import('./boosts').Boost;
  finance?: import('./finance').FinanceState;
  munny: number;
  tickets: number;
  fragments: number;
  freeAt: number;
  daily: string;
  copies: Copy[];
  summons: number;
  claimed: string[];
  reducedMotion: boolean;
  discoveries: string[];
  holoDiscoveries: string[];
  moderation?: {
    suspended: boolean;
    reason: string;
    updatedAt: string;
    actor: string;
  };
};
export const initialPlayer = (): Player => ({
  munny: 0,
  tickets: 0,
  fragments: 0,
  freeAt: 0,
  daily: '',
  copies: [],
  summons: 0,
  claimed: [],
  reducedMotion: false,
  discoveries: [],
  holoDiscoveries: [],
});
export function validateCatalog(input: unknown) {
  const cards = z.array(cardSchema).length(150).parse(input);
  if (new Set(cards.map((c) => c.id)).size !== 150)
    throw new Error('Identifiants dupliqués');
  const counts = [38, 43, 29, 22, 14, 4];
  rarities.forEach((r, i) => {
    if (cards.filter((c) => c.rarity === r).length !== counts[i])
      throw new Error(`Répartition invalide : ${r}`);
    if (cards.some((c) => c.rarity === r && c.maxLevel !== caps[i]))
      throw new Error(`Niveau maximum invalide : ${r}`);
  });
  return cards;
}
export function draw(
  cards: Card[],
  rng = randomInt,
  odds = { rates, holoRate },
) {
  let roll = rng(10000),
    index = 0;
  while (roll >= odds.rates[index]) {
    roll -= odds.rates[index];
    index++;
  }
  const pool = cards.filter((c) => c.rarity === rarities[index]);
  if (!pool.length) throw new Error('Catalogue incomplet');
  return {
    cardId: pool[rng(pool.length)].id,
    holo: rng(10000) < odds.holoRate,
  };
}
export function requireFunds(player: Player, cost: number) {
  if (player.munny < cost) throw new Error('Munny insuffisants');
  player.munny -= cost;
}
