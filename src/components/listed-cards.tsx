'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Auction } from '../server/auctions';
import type { Card } from '../game/core';
import GameCard from './game-card';
export default function ListedCards({
  cards,
  copyCount,
}: {
  cards: Card[];
  copyCount: number;
}) {
  const [rows, setRows] = useState<Auction[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => {
      if (!document.hidden)
        void fetch('/api/listed-cards')
          .then(async (r) => {
            const body = await r.json();
            if (!r.ok) throw new Error(body.error);
            return body;
          })
          .then((body) => {
            if (active) {
              setRows(Array.isArray(body) ? body : []);
              setError('');
            }
          })
          .catch(() => {
            if (active)
              setError(
                'Les cartes mises en vente sont temporairement indisponibles.',
              );
          });
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [copyCount]);
  if (error) return <p role="status">{error}</p>;
  if (!rows.length) return null;
  return (
    <section className="listed-cards" aria-label="Mes cartes aux enchères">
      <div className="section-title">
        <div>
          <h2>Mes cartes aux enchères</h2>
          <p>
            {rows.length} exemplaire(s) conservé(s) pour vos ventes,
            indisponible(s) pour les améliorations ou le recyclage.
          </p>
        </div>
        <Link href="/trade">Gérer mes ventes →</Link>
      </div>
      <div className="listed-grid">
        {rows.map((row) => {
          const card = cards.find((c) => c.id === row.copy.cardId);
          return (
            <div key={row.id} className="listed-card">
              <span className="listed-badge">Aux enchères</span>
              {card && (
                <GameCard card={card} copy={row.copy} showDetails={false} />
              )}
              <p>
                {row.bidderId
                  ? `Meilleure offre : ${row.bid.toLocaleString('fr-FR')} Munny`
                  : `Départ : ${row.startPrice.toLocaleString('fr-FR')} Munny`}
              </p>
              <small>
                Fin : {new Date(row.endsAt).toLocaleString('fr-FR')}
              </small>
              <Link href="/trade" className="outline">
                Voir ma vente
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
