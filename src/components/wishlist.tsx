'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Card, Player } from '../game/core';
export default function Wishlist({
  cards,
  player,
  busy,
  onChange,
}: {
  cards: Card[];
  player: Player;
  busy: boolean;
  onChange: (cardId: string, wanted: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const wanted = new Set(player.wishlist ?? []);
  const owned = new Set(player.copies.map((copy) => copy.cardId));
  const matches = search.trim()
    ? cards
        .filter((card) =>
          `${card.name} ${card.version} ${card.id}`
            .toLocaleLowerCase('fr')
            .includes(search.trim().toLocaleLowerCase('fr')),
        )
        .slice(0, 12)
    : [];
  return (
    <section className="panel wishlist-panel">
      <span className="eyebrow">VOS PROCHAINES RENCONTRES</span>
      <h2>
        Ma wishlist <small>{wanted.size} cartes</small>
      </h2>
      <p>
        Retrouvez les cartes que vous recherchez. Cette liste est visible sur
        votre profil collectionneur.
      </p>
      <input
        aria-label="Rechercher pour la wishlist"
        placeholder="Rechercher un nom, une version, un identifiant…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {search.trim() && (
        <ul className="wishlist-list">
          {matches.map((card) => (
            <li key={card.id}>
              <span>
                {card.name}
                <small>
                  {card.version} · {card.id}
                </small>
              </span>
              <button
                className="outline"
                disabled={busy}
                onClick={() => onChange(card.id, !wanted.has(card.id))}
              >
                {wanted.has(card.id) ? 'Retirer' : 'Ajouter'}
              </button>
            </li>
          ))}
          {!matches.length && <li>Aucune carte trouvée.</li>}
        </ul>
      )}
      <ul className="wishlist-list">
        {cards
          .filter((card) => wanted.has(card.id))
          .map((card) => (
            <li key={card.id}>
              <span>
                <Link href={`/cards/${card.id}`}>{card.name}</Link>
                <Link className="text-link" href={`/trade?card=${card.id}`}>
                  Voir les offres
                </Link>
                <small>
                  {card.version} ·{' '}
                  {owned.has(card.id)
                    ? 'Déjà dans la collection'
                    : 'Recherchée'}
                </small>
              </span>
              <button
                className="text-link"
                disabled={busy}
                aria-label={`Retirer ${card.name} de la wishlist`}
                onClick={() => onChange(card.id, false)}
              >
                Retirer
              </button>
            </li>
          ))}
      </ul>
      {!wanted.size && (
        <p>Ajoutez votre première carte recherchée avec le champ ci-dessus.</p>
      )}
    </section>
  );
}
