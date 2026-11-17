import { Award } from 'lucide-react';
import type { Card, Player } from '../game/core';
import { achievements } from '../game/achievements';

export default function Achievements({
  player,
  cards,
  title = 'Succès',
}: {
  player: Player;
  cards: Card[];
  title?: string;
}) {
  const list = achievements(player, cards);
  const done = list.filter((a) => a.done).length;
  return (
    <section
      className="panel achievements"
      aria-labelledby="achievements-title"
    >
      <div className="section-title">
        <h2 id="achievements-title">{title}</h2>
        <span className="quest-summary">
          {done} / {list.length} obtenus
        </span>
      </div>
      <ul className="achievement-grid">
        {list.map((a) => (
          <li key={a.id} className={a.done ? 'done' : ''}>
            <Award size={20} aria-hidden="true" />
            <div>
              <strong>{a.name}</strong>
              <span>{a.description}</span>
              {!a.done && (
                <small>
                  {a.progress.toLocaleString('fr-FR')} /{' '}
                  {a.target.toLocaleString('fr-FR')}
                </small>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
