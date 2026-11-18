// Atelier : coûts d'amélioration et choix des exemplaires recyclables.
// Les valeurs viennent de `economy` ; aucune n'est modifiée ici.
import type { Card, Copy, Player } from './core';
import { caps, economy, rarities } from './config';
import { fusionRank } from './stats';

export const recycleBatchLimit = 200;

export function levelCap(card: Card) {
  return caps[rarities.indexOf(card.rarity)] ?? card.maxLevel;
}

// Coût cumulé pour monter `levels` niveaux depuis `level` (100 Munny × niveau
// actuel et 2 fragments par niveau, comme une montée niveau par niveau).
export function upgradeCost(level: number, levels: number) {
  let munny = 0;
  for (let i = 0; i < levels; i++) munny += (level + i) * economy.levelCost;
  return { munny, fragments: levels * economy.levelFragments };
}

// Nombre de niveaux finançables avec les ressources actuelles.
export function affordableLevels(
  copy: Copy,
  card: Card,
  munny: number,
  fragments: number,
) {
  const room = Math.max(0, levelCap(card) - copy.level);
  let levels = 0;
  while (levels < room) {
    const next = upgradeCost(copy.level, levels + 1);
    if (next.munny > munny || next.fragments > fragments) break;
    levels++;
  }
  return levels;
}

// Doublon consommable par un éveil : exemplaire standard, jamais protégé.
export function awakeningFodder(copy: Copy, target: Copy) {
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

export function awakeningNeed(copy: Copy) {
  const needed = economy.awakeningDuplicates[copy.awakening] ?? 0;
  return {
    needed,
    munny: needed * economy.awakeningMunny,
    fragments: needed * economy.alternativeFragments,
  };
}

const worth = (c: Copy) =>
  fusionRank(c) * 1e6 + c.awakening * 1e4 + c.level * 10 + (c.holo ? 1 : 0);

// Un exemplaire peut être recyclé s'il n'est ni verrouillé, ni favori, ni en vitrine.
export function recyclable(copy: Copy, player: Pick<Player, 'showcase'>) {
  return (
    !copy.locked && !copy.favorite && !(player.showcase ?? []).includes(copy.id)
  );
}

// Suggestion de l'atelier : pour chaque modèle, on garde le meilleur exemplaire
// et tous les exemplaires protégés ou holographiques ; le reste est proposé.
export function suggestedRecycling(player: Player) {
  const byCard = new Map<string, Copy[]>();
  for (const copy of player.copies)
    byCard.set(copy.cardId, [...(byCard.get(copy.cardId) ?? []), copy]);
  const picks: Copy[] = [];
  for (const copies of byCard.values()) {
    if (copies.length < 2) continue;
    const best = [...copies].sort((a, b) => worth(b) - worth(a))[0];
    for (const copy of copies)
      if (
        copy.id !== best.id &&
        !copy.holo &&
        copy.level === 1 &&
        copy.awakening === 0 &&
        fusionRank(copy) === 0 &&
        recyclable(copy, player)
      )
        picks.push(copy);
  }
  return picks;
}
