import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Card, Player } from '../game/core';
import GameCard from './game-card';

const shown = 5;

// Les exemplaires sont ajoutés en fin d'inventaire : les derniers sont les plus récents.
export default function RecentCards({
  player,
  cards,
}: {
  player: Player;
  cards: Card[];
}) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const recent = player.copies
    .slice(-shown)
    .reverse()
    .flatMap((copy) => {
      const card = byId.get(copy.cardId);
      return card ? [{ card, copy }] : [];
    });
  if (!recent.length) return null;
  return (
    <section className="panel recent-cards" aria-labelledby="recent-cards">
      <div className="section-title">
        <h2 id="recent-cards">Vos dernières cartes</h2>
        <Link href="/collection">
          Toute ma collection <ChevronRight size={14} />
        </Link>
      </div>
      <div className="recent-cards-row">
        {recent.map(({ card, copy }) => (
          <GameCard key={copy.id} card={card} copy={copy} showDetails={false} />
        ))}
      </div>
    </section>
  );
}
