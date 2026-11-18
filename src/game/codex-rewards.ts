// Récompenses de collection : une seule fois par palier de modèles découverts.
import type { Player } from './core';

export const codexMilestones = [
  { id: 'codex-25', target: 25, munny: 2000, title: null },
  { id: 'codex-50', target: 50, munny: 5000, title: null },
  { id: 'codex-100', target: 100, munny: 15000, title: null },
  { id: 'codex-150', target: 150, munny: 50000, title: 'Mémoire des mondes' },
] as const;

export const codexClaimKey = (id: string) => `codex-reward:${id}`;

export function discoveredCount(
  player: Pick<Player, 'discoveries' | 'copies'>,
) {
  return new Set([
    ...(player.discoveries ?? []),
    ...player.copies.map((copy) => copy.cardId),
  ]).size;
}

export function codexRewardStatus(player: Player) {
  const found = discoveredCount(player);
  const claimed = new Set(player.claimed ?? []);
  return codexMilestones.map((m) => {
    const isClaimed = claimed.has(codexClaimKey(m.id));
    return {
      ...m,
      progress: Math.min(found, m.target),
      claimed: isClaimed,
      claimable: !isClaimed && found >= m.target,
    };
  });
}
