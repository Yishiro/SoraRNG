'use client';
import Link from 'next/link';
import type { Card, Copy } from '../game/core';
import { openingSummary, type RevealBaseline } from '../game/collection-tools';
export default function OpeningSummary({
  copies,
  cards,
  baseline,
  onClose,
  demo,
}: {
  copies: Copy[];
  cards: Card[];
  baseline: RevealBaseline;
  onClose: () => void;
  demo: boolean;
}) {
  const summary = openingSummary(copies, baseline);
  return (
    <section className="opening-summary" aria-label="Bilan de l’ouverture">
      <h3>Votre ouverture, en un regard.</h3>
      <div className="opening-summary-stats">
        <div>
          <strong>{summary.total}</strong>
          <span>Cartes reçues</span>
        </div>
        <div>
          <strong>{summary.newModels.length}</strong>
          <span>Nouvelles découvertes</span>
        </div>
        <div>
          <strong>{summary.duplicateIds.length}</strong>
          <span>Doublons</span>
        </div>
        <div>
          <strong>{summary.holographics}</strong>
          <span>Holographiques</span>
        </div>
      </div>
      <details>
        <summary>Voir le détail des cartes reçues</summary>
        <ul>
          {copies.map((c) => {
            const card = cards.find((m) => m.id === c.cardId);
            return (
              <li key={c.id}>
                <div>
                  <strong>{card?.name ?? c.cardId}</strong>
                  <small>
                    {card?.version} · {c.holo ? 'Holographique' : 'Standard'}
                  </small>
                  <span>
                    {summary.duplicateIds.includes(c.id)
                      ? 'Doublon'
                      : summary.newModels.includes(c.cardId)
                        ? 'Nouvelle découverte'
                        : 'Retrouvée dans votre collection'}
                  </span>
                </div>
                {!demo && (
                  <Link
                    href={`/collection?copy=${encodeURIComponent(c.id)}`}
                    onClick={onClose}
                  >
                    Gérer / vendre →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      {!demo && (
        <Link className="outline" href="/collection" onClick={onClose}>
          Retrouver mes cartes dans la collection
        </Link>
      )}
      <p>
        Un doublon est un exemplaire supplémentaire d’un modèle déjà possédé, y
        compris dans ce booster. Les découvertes tiennent compte de votre Codex.
      </p>
    </section>
  );
}
