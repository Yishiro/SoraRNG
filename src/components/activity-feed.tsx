'use client';
import { useEffect, useState } from 'react';
import { Gavel, Sparkles, Trophy } from 'lucide-react';
import type { Card } from '../game/core';

type Item = {
  id: string;
  at: string;
  kind: 'drop' | 'sale' | 'season';
  text: string;
};
const icons = { drop: Sparkles, sale: Gavel, season: Trophy };

export default function ActivityFeed({ cards }: { cards: Card[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch('/api/activity')
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body?.error ?? 'Fil indisponible');
          if (active && Array.isArray(body?.items)) setItems(body.items);
        })
        .catch((e) => active && setError(e.message));
    void load();
    const timer = setInterval(() => !document.hidden && void load(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [cards.length]);
  return (
    <section className="panel activity-feed" aria-labelledby="activity-title">
      <h2 id="activity-title">Fil d’activité du royaume</h2>
      <p>Grandes découvertes, ventes conclues et podiums de saison.</p>
      {error && <p role="alert">{error}</p>}
      {items.length ? (
        <ul>
          {items.map((item) => {
            const Icon = icons[item.kind];
            return (
              <li key={item.id} className={`activity-${item.kind}`}>
                <Icon size={16} aria-hidden="true" />
                <span>{item.text}</span>
                <time dateTime={item.at}>
                  {new Date(item.at).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
              </li>
            );
          })}
        </ul>
      ) : (
        !error && <p>Le royaume est calme pour l’instant.</p>
      )}
    </section>
  );
}
