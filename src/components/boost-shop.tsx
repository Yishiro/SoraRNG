import Link from 'next/link';
import { Clover, Sparkle } from 'lucide-react';
import type { Player } from '../game/core';
import { boosts, summonOdds, type BoostKind } from '../game/boosts';

export default function BoostShop({
  player,
  busy,
  now,
  onBuy,
}: {
  player?: Player;
  busy: boolean;
  now: number;
  onBuy: (kind: BoostKind) => void;
}) {
  const { active } = summonOdds(player?.boost, now);
  return (
    <section className="panel">
      <h2>Boosts temporaires</h2>
      <p>
        Chaque boost s’active à l’achat pour 30 minutes et s’applique à vos
        ouvertures pendant cette période. Un seul boost peut être actif à la
        fois.
      </p>
      {active && (
        <p role="status">
          {boosts[active.kind].name} actif encore{' '}
          {Math.ceil((active.expiresAt - now) / 60000)} min.
        </p>
      )}
      <div className="shop-grid">
        {(['rare', 'holo'] as const).map((kind) => {
          const boost = boosts[kind];
          const Icon = kind === 'rare' ? Clover : Sparkle;
          return (
            <div
              className={`purchase boost-tile${active?.kind === kind ? ' active' : ''}`}
              key={kind}
            >
              <Icon aria-hidden="true" />
              <strong>{boost.name}</strong>
              <span>{boost.description}</span>
              <button
                className="outline"
                disabled={
                  !player ||
                  busy ||
                  Boolean(active) ||
                  player.munny < boost.cost
                }
                onClick={() => onBuy(kind)}
              >
                Activer pour {boost.cost.toLocaleString('fr-FR')} Munny
              </button>
            </div>
          );
        })}
      </div>
      <Link href="/summon" className="text-link">
        Voir les probabilités d’ouverture
      </Link>
    </section>
  );
}
