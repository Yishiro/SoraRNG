import Image from 'next/image';
import Link from 'next/link';
import { Award } from 'lucide-react';
import type { Card, Player } from '../game/core';
import { worlds } from '../game/worlds';
import { getCardAsset } from '../game/assets';

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
  const byId = new Map(cards.map((card) => [card.id, card]));
  const done = worlds.filter((w) =>
    w.cards.every((id) => discovered.has(id)),
  ).length;
  return (
    <section className="panel" aria-labelledby="world-book">
      <div className="section-title">
        <h2 id="world-book">Pages du Carnet</h2>
        <span className="quest-summary">
          {done} / {worlds.length} insignes
        </span>
      </div>
      <p>
        Découvrez toutes les cartes d’un monde pour obtenir son insigne sur
        votre profil. Une carte découverte reste inscrite après un échange ou
        une vente.
      </p>
      <div className="world-grid">
        {worlds.map((world) => {
          const found = world.cards.filter((id) => discovered.has(id)).length;
          const complete = found === world.cards.length;
          return (
            <article
              key={world.name}
              className={`world-tile ${complete ? 'complete' : ''}`}
            >
              <header>
                <h3>{world.name}</h3>
                {complete && <Award size={18} aria-label="Insigne obtenu" />}
              </header>
              <p className="world-meta">
                {found}/{world.cards.length} cartes
                {complete ? ' · Insigne obtenu' : ''}
              </p>
              <span className="meter-track" aria-hidden="true">
                <i
                  style={{ width: `${(found / world.cards.length) * 100}%` }}
                />
              </span>
              <ul className="world-cards">
                {world.cards.map((id) => {
                  const card = byId.get(id);
                  const seen = discovered.has(id);
                  const image = getCardAsset(id)?.thumbnailPath;
                  return (
                    <li key={id} className={seen ? 'seen' : ''}>
                      <Link
                        href={`/cards/${id}`}
                        aria-label={`${card?.name ?? id} · ${seen ? 'découverte' : 'à découvrir'}`}
                        title={card?.name ?? id}
                      >
                        {image ? (
                          <Image
                            src={image}
                            alt=""
                            fill
                            unoptimized
                            sizes="64px"
                            style={{ objectFit: 'contain' }}
                          />
                        ) : (
                          <span aria-hidden="true">
                            {(card?.name ?? id).slice(0, 1)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
