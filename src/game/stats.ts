// Statistiques de combat des exemplaires, préparées pour le futur PvP.
// Les stats de base dépendent de la rareté, du niveau, de l'éveil et de la finition.
// Chaque fusion donne des points que le joueur répartit librement.
import type { Card, Copy } from './core';
import { rarities } from './config';

export const statKeys = ['hp', 'atk', 'def', 'spd'] as const;
export type StatKey = (typeof statKeys)[number];
export type Stats = Record<StatKey, number>;

export const statNames: Record<StatKey, string> = {
  hp: 'PV',
  atk: 'Attaque',
  def: 'Défense',
  spd: 'Vitesse',
};

export const fusion = {
  maxRank: 10,
  pointsPerRank: 3,
  // Coût en Munny de la fusion qui fait passer au rang suivant : 500 × rang visé.
  munnyPerRank: 500,
  // Gain par point réparti, PV plus élevés comme dans les jeux de combat classiques.
  pointValue: { hp: 5, atk: 2, def: 2, spd: 2 } satisfies Stats,
} as const;

const rarityBase = [40, 48, 56, 64, 72, 80];

// Profil propre à chaque carte, stable dans le temps (dérivé de son identifiant).
// FNV-1a 32 bits : identique côté serveur et navigateur.
function hashByte(text: string, salt: number) {
  let hash = 0x811c9dc5 ^ salt;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) & 0xff;
}
function profile(cardId: string): Stats {
  const weight = (salt: number) => 0.8 + (hashByte(cardId, salt) / 255) * 0.4;
  return { hp: weight(1), atk: weight(2), def: weight(3), spd: weight(4) };
}

export function fusionRank(copy: Pick<Copy, 'fusion'>) {
  return Math.max(0, Math.min(fusion.maxRank, copy.fusion ?? 0));
}

export function allocatedPoints(copy: Pick<Copy, 'bonus'>) {
  return statKeys.reduce((sum, key) => sum + (copy.bonus?.[key] ?? 0), 0);
}

export function unspentPoints(copy: Pick<Copy, 'fusion' | 'bonus'>) {
  return fusionRank(copy) * fusion.pointsPerRank - allocatedPoints(copy);
}

export function fusionCost(copy: Pick<Copy, 'fusion'>) {
  return (fusionRank(copy) + 1) * fusion.munnyPerRank;
}

export function copyStats(card: Card, copy: Copy): Stats {
  const base = rarityBase[Math.max(0, rarities.indexOf(card.rarity))];
  const growth =
    (1 + (copy.level - 1) * 0.02) *
    (1 + copy.awakening * 0.05) *
    (copy.holo ? 1.03 : 1);
  const weights = profile(card.id);
  const stats = {} as Stats;
  for (const key of statKeys) {
    const raw = base * weights[key] * growth * (key === 'hp' ? 2 : 1);
    stats[key] =
      Math.round(raw) + (copy.bonus?.[key] ?? 0) * fusion.pointValue[key];
  }
  return stats;
}

// Un doublon consommable : même modèle, exemplaire standard et non protégé.
export function fusionFodder(copy: Copy, target: Copy) {
  return (
    copy.id !== target.id &&
    copy.cardId === target.cardId &&
    !copy.locked &&
    !copy.favorite &&
    !copy.holo &&
    copy.level === 1 &&
    copy.awakening === 0 &&
    fusionRank(copy) === 0
  );
}
