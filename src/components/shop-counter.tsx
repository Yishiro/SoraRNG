import { Gem, Sparkles } from 'lucide-react';
import type { Player } from '../game/core';
import { economy } from '../game/config';

export default function ShopCounter({
  player,
  busy,
  onBuy,
}: {
  player?: Player;
  busy: boolean;
  onBuy: (item: 'ticket' | 'fragments') => void;
}) {
  return (
    <section className="panel">
      <h2>Le comptoir des voyageurs</h2>
      <p>
        Aucun achat en argent réel. Les objets du catalogue restent des cartes
        de collection.
      </p>
      <div className="shop-grid">
        <button
          className="purchase"
          disabled={!player || busy || player.munny < economy.summon}
          onClick={() => onBuy('ticket')}
        >
          <Sparkles />
          <strong>Ticket d’invocation</strong>
          <span>Ouvre un booster de cinq cartes.</span>
          <small>{economy.summon.toLocaleString('fr-FR')} Munny</small>
        </button>
        <button
          className="purchase"
          disabled={!player || busy || player.munny < economy.fragmentPackCost}
          onClick={() => onBuy('fragments')}
        >
          <Gem />
          <strong>{economy.fragmentPack} fragments</strong>
          <span>Pour monter le niveau de vos exemplaires.</span>
          <small>
            {economy.fragmentPackCost.toLocaleString('fr-FR')} Munny
          </small>
        </button>
      </div>
    </section>
  );
}
