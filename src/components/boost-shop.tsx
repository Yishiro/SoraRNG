import Link from 'next/link';
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
      <div className="action-row">
        {(['rare', 'holo'] as const).map((kind) => {
          const boost = boosts[kind];
          return (
            <div className="panel" key={kind}>
              <h3>{boost.name}</h3>
              <p>{boost.description}</p>
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
