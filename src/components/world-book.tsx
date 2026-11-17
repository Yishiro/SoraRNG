import Link from 'next/link';
import type { Card, Player } from '../game/core';
import { worlds } from '../game/worlds';

export default function WorldBook({
  cards,
  player,
}: {
  cards: Card[];
  player?: Player;
}) {
  const discovered = new Set([
    ...(player?.discoveries ?? []),
    ...(player?.copies.map((copy) => copy.cardId) ?? []),
  ]);
  return (
    <section className="panel">
      <h2>Pages du Carnet</h2>
      <p>
        Découvrez les cartes de chaque monde pour obtenir son insigne sur votre
        profil. Une carte découverte reste inscrite dans le Carnet après un
        échange ou une vente.
      </p>
      {worlds.map((world) => {
        const found = world.cards.filter((id) => discovered.has(id)).length;
        return (
          <details className="panel" key={world.name}>
            <summary>
              <strong>{world.name}</strong> · {found}/{world.cards.length}
              {found === world.cards.length ? ' · Insigne obtenu' : ''}
            </summary>
            <progress
              aria-label={`Progression · ${world.name}`}
              value={found}
              max={world.cards.length}
            />
            <ul className="wishlist-list">
              {world.cards.map((id) => {
                const card = cards.find((item) => item.id === id);
                return (
                  <li key={id}>
                    <Link href={`/cards/${id}`}>
                      {card?.name ?? id} · {card?.version}
                    </Link>
                    <span>
                      {discovered.has(id) ? 'Découverte' : 'À découvrir'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
